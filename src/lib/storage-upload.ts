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
