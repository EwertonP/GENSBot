import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Proxy de download para mídias de aprovação (Imagens e Vídeos).
 * Força o cabeçalho 'Content-Disposition: attachment' na mesma origem da aplicação,
 * garantindo que navegadores mobile (iOS Safari, Android Chrome) e desktop
 * realizem o download do arquivo diretamente para o dispositivo, sem abrir outra guia.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url')?.trim();
    const rawFilename = searchParams.get('filename')?.trim();

    if (!targetUrl) {
      return NextResponse.json({ error: 'URL do arquivo não fornecida' }, { status: 400 });
    }

    // Valida protocolo seguro
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: 'Protocolo de URL inválido' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    // Sanitiza o nome do arquivo para o cabeçalho Content-Disposition
    const extMatch = parsedUrl.pathname.match(/\.(jpg|jpeg|png|webp|gif|mp4|mov|webm)$/i);
    const extPadrao = extMatch ? extMatch[1].toLowerCase() : 'png';

    const safeFilename =
      (rawFilename || 'arte-hd')
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '-')
        .trim() || `arte-hd.${extPadrao}`;

    const nomeFinal = safeFilename.includes('.') ? safeFilename : `${safeFilename}.${extPadrao}`;

    // Busca o arquivo na origem (Supabase Storage, Cloudflare R2, CDN)
    const upstreamRes = await fetch(targetUrl, {
      signal: AbortSignal.timeout(30000),
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      return NextResponse.json(
        { error: `Não foi possível carregar o arquivo na origem (HTTP ${upstreamRes.status})` },
        { status: upstreamRes.status === 404 ? 404 : 502 }
      );
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstreamRes.headers.get('content-length');

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    // Garante que o navegador trate como download e nunca abra em visualizador de aba
    headers.set(
      'Content-Disposition',
      `attachment; filename="${nomeFinal}"; filename*=UTF-8''${encodeURIComponent(nomeFinal)}`
    );
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new Response(upstreamRes.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error('[API Download] Erro ao servir arquivo para download:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar download do arquivo.' },
      { status: 500 }
    );
  }
}
