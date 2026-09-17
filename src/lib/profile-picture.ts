import { put } from '@vercel/blob';

/**
 * A Meta devolve `profile_picture_url` como um link assinado do CDN deles, que
 * expira em poucos dias (confirmado: um link salvo há 8 dias já respondia 403).
 * Guardar esse link direto no banco significa que a foto some sozinha sem
 * nenhuma mudança na conta. Baixa a imagem e reenvia pro nosso Blob, num
 * caminho fixo por conta (`allowOverwrite`) — o link resultante é permanente,
 * então basta chamar de novo periodicamente pra manter a cópia atualizada.
 */
export async function cacheProfilePicture(instagramUserId: string, sourceUrl: string | null | undefined): Promise<string | null> {
  if (!sourceUrl) return null;

  try {
    const imageRes = await fetch(sourceUrl);
    if (!imageRes.ok) return null;

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imageRes.arrayBuffer();

    const blob = await put(`avatars/${instagramUserId}.jpg`, Buffer.from(buffer), {
      access: 'public',
      contentType,
      allowOverwrite: true,
    });

    return blob.url;
  } catch (err) {
    console.error('Erro ao cachear foto de perfil:', instagramUserId, err);
    return null;
  }
}
