export default async function handler(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  
  if (path === '/test-simple') {
    return new Response(JSON.stringify({ status: 'ok', message: 'simple test works' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }
  
  return new Response('Not Found', { status: 404 });
}
