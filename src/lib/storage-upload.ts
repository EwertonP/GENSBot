import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export interface UploadResult {
  url: string;
  nome: string;
  tipo: 'imagem' | 'video';
  tamanho?: number;
}

/**
 * Remove caracteres especiais e acentos do nome do arquivo para garantir URL limpa e segura no Supabase Storage.
 */
export function sanitizeFileName(fileName: string): string {
  const parts = fileName.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  const base = parts.join('.');

  const cleanBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_') // caracteres seguros
    .replace(/_+/g, '_')
    .slice(0, 80);

  const cleanExt = (ext || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase;
}

/**
 * Faz upload de um arquivo diretamente para o Supabase Storage (bucket 'post-media') pelo navegador.
 * Não passa por funções serverless da Vercel (evita limites de 4.5MB da Vercel).
 * Retorna a URL pública permanente e garantida.
 */
export async function uploadMediaFile(
  file: File,
  folder: string = 'uploads'
): Promise<UploadResult> {
  if (file.size > 50 * 1024 * 1024) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `O arquivo "${file.name}" tem ${sizeMb} MB e excede o limite de 50 MB do Supabase. Use o "Comprimir_Reels.bat" na Área de Trabalho para otimizar o vídeo antes de enviar.`
    );
  }

  const supabase = createSupabaseBrowserClient();
  const isVideo = file.type.startsWith('video') || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
  const cleanName = sanitizeFileName(file.name);
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${cleanName}`;

  const { error } = await supabase.storage.from('post-media').upload(path, file, {
    cacheControl: '31536000',
    upsert: true,
  });

  if (error) {
    console.error('Erro no upload para Supabase Storage:', error);
    throw new Error(`Falha no upload de "${file.name}": ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);

  return {
    url: publicUrl,
    nome: file.name,
    tipo: isVideo ? 'video' : 'imagem',
    tamanho: file.size,
  };
}

/**
 * Remove arquivos do Supabase Storage bucket 'post-media' a partir da lista de arquivos da demanda.
 * Libera espaço no plano Free assim que o post é publicado.
 */
export async function cleanupStorageMedia(
  supabaseClient: any,
  arquivos: any[] | null | undefined
): Promise<string[]> {
  if (!arquivos || !Array.isArray(arquivos) || arquivos.length === 0) return [];

  const pathsToDelete: string[] = [];
  for (const item of arquivos) {
    if (!item?.url || typeof item.url !== 'string') continue;
    // URL ex.: https://ecahlegiaqikxnkdifhn.supabase.co/storage/v1/object/public/post-media/uploads/123.png
    const match = item.url.match(/\/post-media\/(.+)$/);
    if (match && match[1]) {
      pathsToDelete.push(decodeURIComponent(match[1]));
    }
  }

  if (pathsToDelete.length > 0) {
    try {
      const { error } = await supabaseClient.storage.from('post-media').remove(pathsToDelete);
      if (error) {
        console.error('Erro ao remover mídias do storage:', error);
      } else {
        console.log(`[Storage Cleanup] ${pathsToDelete.length} arquivo(s) removido(s) do bucket post-media:`, pathsToDelete);
      }
    } catch (err) {
      console.error('Exceção ao limpar mídias do storage:', err);
    }
  }

  return pathsToDelete;
}

