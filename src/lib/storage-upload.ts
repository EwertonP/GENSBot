import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export interface UploadResult {
  url: string;
  nome: string;
  tipo: 'imagem' | 'video';
  tamanho?: number;
}

/**
 * Remove caracteres especiais e acentos do nome do arquivo para garantir URL limpa e segura no Storage.
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
 * Faz upload de um arquivo para o Storage disponível.
 * 1. Primeiro verifica se o Cloudflare R2 está configurado (aceita arquivos grandes > 50MB e 10GB grátis).
 * 2. Se o R2 não estiver configurado, usa o Supabase Storage (com trava de segurança de 50MB do plano Free).
 */
export async function uploadMediaFile(
  file: File,
  folder: string = 'uploads'
): Promise<UploadResult> {
  const isVideo = file.type.startsWith('video') || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);

  // 1. Tenta obter Presigned URL para Cloudflare R2 via API
  try {
    const presignRes = await fetch('/api/storage/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        folder,
        size: file.size,
      }),
    });

    if (presignRes.ok) {
      const data = await presignRes.json();
      if (data.provider === 'r2' && data.uploadUrl && data.publicUrl) {
        // Upload direto via HTTP PUT para Cloudflare R2 (sem limites de 4.5MB da Vercel nem 50MB do Supabase)
        const putRes = await fetch(data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });

        if (!putRes.ok) {
          throw new Error(`Falha no upload direto para o Cloudflare R2 (${putRes.status} ${putRes.statusText})`);
        }

        console.log(`[Storage] Upload para Cloudflare R2 realizado com sucesso: ${data.publicUrl}`);
        return {
          url: data.publicUrl,
          nome: file.name,
          tipo: isVideo ? 'video' : 'imagem',
          tamanho: file.size,
        };
      }
    }
  } catch (r2Error) {
    console.warn('[Storage] Não foi possível fazer upload via Cloudflare R2, utilizando Supabase Storage:', r2Error);
  }

  // 2. Fallback: Supabase Storage (bucket 'post-media')
  if (file.size > 50 * 1024 * 1024) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `O arquivo "${file.name}" tem ${sizeMb} MB e excede o limite de 50 MB do Supabase. Configure o Cloudflare R2 nas variáveis de ambiente para uploads sem limite ou use o "Comprimir_Reels.bat" na Área de Trabalho.`
    );
  }

  const supabase = createSupabaseBrowserClient();
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
 * Remove arquivos de mídia do Storage (Cloudflare R2 ou Supabase Storage) a partir da lista de arquivos da demanda.
 * Libera espaço de armazenamento assim que o post é publicado.
 */
export async function cleanupStorageMedia(
  supabaseClient: any,
  arquivos: any[] | null | undefined
): Promise<string[]> {
  if (!arquivos || !Array.isArray(arquivos) || arquivos.length === 0) return [];

  const supabasePathsToDelete: string[] = [];
  const r2UrlsToDelete: string[] = [];

  for (const item of arquivos) {
    if (!item?.url || typeof item.url !== 'string') continue;

    // Detecta se o arquivo está no bucket post-media do Supabase
    const supabaseMatch = item.url.match(/\/post-media\/(.+)$/);
    if (supabaseMatch && supabaseMatch[1]) {
      supabasePathsToDelete.push(decodeURIComponent(supabaseMatch[1]));
    } else if (
      item.url.includes('.r2.dev') ||
      item.url.includes('.r2.cloudflarestorage.com') ||
      item.url.includes('r2.')
    ) {
      r2UrlsToDelete.push(item.url);
    } else {
      // Caso genérico: se não é do Supabase, tenta deletar no R2
      r2UrlsToDelete.push(item.url);
    }
  }

  const allDeleted: string[] = [];

  // 1. Limpeza no Supabase Storage
  if (supabasePathsToDelete.length > 0 && supabaseClient) {
    try {
      const { error } = await supabaseClient.storage.from('post-media').remove(supabasePathsToDelete);
      if (error) {
        console.error('Erro ao remover mídias do Supabase Storage:', error);
      } else {
        console.log(`[Storage Cleanup] ${supabasePathsToDelete.length} arquivo(s) removido(s) do Supabase:`, supabasePathsToDelete);
        allDeleted.push(...supabasePathsToDelete);
      }
    } catch (err) {
      console.error('Exceção ao limpar mídias do Supabase Storage:', err);
    }
  }

  // 2. Limpeza no Cloudflare R2
  if (r2UrlsToDelete.length > 0) {
    try {
      if (typeof window === 'undefined') {
        // Ambiente servidor (API routes / cron jobs)
        const { deleteR2Objects } = await import('@/lib/r2');
        const deleted = await deleteR2Objects(r2UrlsToDelete);
        allDeleted.push(...deleted);
      } else {
        // Ambiente navegador
        const res = await fetch('/api/storage/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: r2UrlsToDelete }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.deleted) {
            allDeleted.push(...data.deleted);
          }
        }
      }
    } catch (r2Err) {
      console.error('Exceção ao limpar mídias do Cloudflare R2:', r2Err);
    }
  }

  return allDeleted;
}
