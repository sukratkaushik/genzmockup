# Known issues and launch blockers

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | Blocker | Gemini API key is read in client code (`index.tsx`, `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`) and would be bundled for any visitor | Server-side proxy Edge Function |
| 2 | High | `vite.config.ts` is `defineConfig({})`, so the key is never injected and generation fails locally | Use `loadEnv` + `define` for local only (see README) |
| 3 | High | Cost metrics assume a hardcoded `$0.05` per image | Confirm real pricing, log real usage |
| 4 | High | "Unlimited" Brand tier has unbounded cost | Fair-use cap |
| 5 | Medium | Landing copy drafts included invented stats / testimonials | Replace with real data or remove |
| 6 | Medium | No legal pages (Impressum, privacy, terms) | Required before public launch in Germany / EU |
| 7 | Medium | Gallery and presets only in localStorage | Persist per user after auth |
| 8 | Low | Gallery capped at 100, collage at 9 | Raise after storage design |
| 9 | Info | Etsy / TikTok Shop APIs need approval, can take weeks | Plan export first, publishing later |
