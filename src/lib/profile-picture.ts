import { supabase } from '@/lib/supabase';

/**
 * A Meta devolve `profile_picture_url` como um link assinado do CDN deles, que
 * expira em poucos dias. Baixa a imagem e reenvia pro Supabase Storage (`post-media`),
 * num caminho fixo por conta (`avatars/${instagramUserId}.jpg`) — o link resultante é
 * permanente e não expira.
 */
export async function cacheProfilePicture(instagramUserId: string, sourceUrl: string | null | undefined): Promise<string | null> {
  if (!sourceUrl) return null;

  try {
    const imageRes = await fetch(sourceUrl);
    if (!imageRes.ok) return null;

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imageRes.arrayBuffer();
    const filePath = `avatars/${instagramUserId}.jpg`;

    const { error } = await supabase.storage.from('post-media').upload(filePath, Buffer.from(buffer), {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error('Erro ao salvar avatar no Supabase Storage:', instagramUserId, error);
      return null;
    }

    const { data } = supabase.storage.from('post-media').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.error('Erro ao cachear foto de perfil:', instagramUserId, err);
    return null;
  }
}

