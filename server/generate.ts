// Server-side Gemini proxy. Framework-agnostic (Web Request/Response).
// Used by api/generate.ts (Vercel) and by the Vite dev middleware.
// The Gemini key is read from the SERVER environment only and never reaches the browser.

const MODEL = 'gemini-2.5-flash-image'; // fixed server-side: clients cannot choose the model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_BODY_BYTES = 4 * 1024 * 1024; // Vercel function body limit is ~4.5 MB
const MAX_PARTS = 3;
const MAX_PROMPT_CHARS = 8000;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Best-effort per-instance rate limit. Real quotas come with Supabase (docs/TECH_SPEC.md).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 10);
const hits = new Map<string, number[]>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

// Returns an identity string if the caller is allowed, otherwise null.
// Fails closed: if no auth method is configured, nobody gets in.
async function authenticate(req: Request): Promise<string | null> {
  const supaUrl = process.env.SUPABASE_URL;
  const supaAnon = process.env.SUPABASE_ANON_KEY;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (supaUrl && supaAnon) {
    if (!bearer) return null;
    const r = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${bearer}`, apikey: supaAnon },
    });
    if (!r.ok) return null;
    const user = (await r.json()) as { id?: string };
    return user.id ? `user:${user.id}` : null;
  }

  const code = process.env.APP_ACCESS_CODE;
  if (code) {
    const given = req.headers.get('x-access-code') ?? '';
    return timingSafeEqual(given, code) ? 'access-code' : null;
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function handleGenerate(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'Server is not configured' }, 500);
  if (!process.env.APP_ACCESS_CODE && !(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)) {
    return json({ error: 'Server auth is not configured' }, 500);
  }

  const identity = await authenticate(req);
  if (!identity) return json({ error: 'Unauthorized' }, 401);
  if (rateLimited(identity)) return json({ error: 'Too many requests, slow down' }, 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);

  let parts: unknown;
  try {
    parts = (JSON.parse(raw) as { parts?: unknown }).parts;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > MAX_PARTS) {
    return json({ error: 'Invalid parts' }, 400);
  }

  // Whitelist the shape: only text and inline images. Nothing else is forwarded.
  const clean: unknown[] = [];
  for (const p of parts as Record<string, any>[]) {
    if (typeof p?.text === 'string') {
      if (p.text.length > MAX_PROMPT_CHARS) return json({ error: 'Prompt too long' }, 400);
      clean.push({ text: p.text });
    } else if (p?.inlineData && ALLOWED_MIME.has(p.inlineData.mimeType) && typeof p.inlineData.data === 'string') {
      clean.push({ inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } });
    } else {
      return json({ error: 'Unsupported part' }, 400);
    }
  }

  const upstream = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: clean }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  if (!upstream.ok) {
    console.error('Gemini error', upstream.status); // never log the key or the body of the user's image
    return json({ error: 'Generation failed' }, upstream.status === 429 ? 429 : 502);
  }

  const data: any = await upstream.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
  if (!img) return json({ error: 'No image returned' }, 502);
  return json({ mimeType: img.inlineData.mimeType, data: img.inlineData.data });
}
