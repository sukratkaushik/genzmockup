# Known issues and launch blockers

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | Resolved | Gemini key was read in client code | Server proxy `server/generate.ts` + `api/generate.ts`; key is server-only, verified absent from `dist/` |
| 2 | Resolved | `vite.config.ts` never injected the key | Dev middleware serves `/api/generate` |
| 2b | High | Interim auth is a single shared access code and an in-memory per-instance rate limit; it is not per-user and resets on cold starts | Replace with Supabase JWT + `consume_quota` (code path already present, enabled by `SUPABASE_URL` + `SUPABASE_ANON_KEY`) |
| 3 | High | Cost metrics assume a hardcoded `$0.05` per image | Confirm real pricing, log real usage |
| 4 | High | "Unlimited" Brand tier has unbounded cost | Fair-use cap |
| 5 | Medium | Landing copy drafts included invented stats / testimonials | Replace with real data or remove |
| 6 | Medium | No legal pages (Impressum, privacy, terms) | Required before public launch in Germany / EU |
| 7 | Medium | Gallery and presets only in localStorage | Persist per user after auth |
| 8 | Low | Gallery capped at 100, collage at 9 | Raise after storage design |
| 9 | Info | Etsy / TikTok Shop APIs need approval, can take weeks | Plan export first, publishing later |
