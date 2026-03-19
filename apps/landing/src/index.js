export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'landing' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Serve static assets
    const response = await env.ASSETS.fetch(request);

    // For /app/* routes: if the asset isn't found, serve /app/index.html (SPA fallback)
    if (response.status === 404 && url.pathname.startsWith('/app')) {
      const spaFallback = await env.ASSETS.fetch(new Request(new URL('/app/index.html', request.url)));
      if (spaFallback.status === 200) {
        return new Response(spaFallback.body, {
          status: 200,
          headers: spaFallback.headers,
        });
      }
    }

    // General 404
    if (response.status === 404) {
      const notFound = await env.ASSETS.fetch(new Request(new URL('/404.html', request.url)));
      return new Response(notFound.body, {
        status: 404,
        headers: notFound.headers,
      });
    }

    return response;
  },
};
