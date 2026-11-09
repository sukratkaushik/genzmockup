# Agent instructions (Antigravity / Claude Code / any coding agent)

Read `README.md` first, then the relevant file in `docs/`.

## Non-negotiables
1. Never put an API key, service-role key or Stripe secret in client code or in git.
2. Gemini calls go through a server-side Edge Function that verifies the Supabase JWT and consumes quota atomically.
3. Derive `userId` and `stripe_customer_id` from the verified JWT, never from the request body.
4. Plan comes from Stripe price ID, mapped server-side in the webhook. Verify webhook signatures. Make the handler idempotent.
5. RLS: users get SELECT-only on their own rows. All writes use the service role.
6. No invented testimonials, ratings, user counts or logos. Use clearly marked placeholders.
7. Keep the verified product list (9 products). Do not add caps, posters or stickers without adding them in code.

## Working style
- Small, reviewable commits. Explain what changed and why.
- When giving terminal commands, state the folder to run them in.
- Run `npm run build` before declaring a task done.
- If a requirement conflicts with these rules, stop and ask.

## Stack
Vite 5, TypeScript 5, `@google/genai`, `jszip` today. Planned: Supabase (Auth, Postgres, Edge Functions), Stripe, Vercel.
