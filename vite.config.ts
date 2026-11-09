import { defineConfig, loadEnv, type Plugin } from 'vite';

// Dev only: serves /api/generate from the same handler Vercel uses, so the
// Gemini key stays in the Node process and is NOT bundled into client code.
function apiDev(): Plugin {
  return {
    name: 'genz-api-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      server.middlewares.use('/api/generate', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const request = new Request('http://localhost/api/generate', {
          method: req.method,
          headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
        });
        const { handleGenerate } = await server.ssrLoadModule('/server/generate.ts');
        const response: Response = await handleGenerate(request);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
}

export default defineConfig({ plugins: [apiDev()] });
