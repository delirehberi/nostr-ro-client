export default {
  async fetch(request, env) {
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Nostr Client SPA', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
  async scheduled(_event, env) {
    if (env && env.CACHE) {
      await env.CACHE.delete('homepage:v5');
      if (env.PUBKEY) {
        await env.CACHE.delete(`theme:${env.PUBKEY}`);
      }
    }
  },
};
