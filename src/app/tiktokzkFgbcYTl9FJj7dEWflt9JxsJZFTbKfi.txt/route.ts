export async function GET() {
  return new Response('tiktok-developers-site-verification=zkFgbcYTl9FJj7dEWflt9JxsJZFTbKfi', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
