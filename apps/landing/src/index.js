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

    // If asset not found, serve 404 page
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
