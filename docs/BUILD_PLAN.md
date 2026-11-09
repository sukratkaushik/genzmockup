# Build plan (agent-ready)

Work through phases in order. Each task should end with `npm run build` passing and a short summary.

## Phase 0: Fix the prototype
1. Fix `vite.config.ts` env handling (see README).
2. Remove the client-side key path; stub generation behind an interface `generateMockup(req)`.
3. Add ESLint / Prettier, basic tests for prompt building and quota logic.

## Phase 1: Validate demand
1. Ship the landing page (`docs/LANDING_PAGE.md`) with a waitlist (email only).
2. Run the prototype privately with 10 sellers; record what they generate and keep.
3. Gate: 100 signups or 10 active testers, plus 3 stated willingness-to-pay.

## Phase 2: Accounts and money
1. Supabase project, schema and RLS from `docs/TECH_SPEC.md`.
2. Auth UI (email + Google).
3. `generate-mockup` Edge Function with atomic quota.
4. Stripe products, Checkout, Portal, webhook.
5. Usage meter and upgrade prompts in the UI.
6. Gate: first 3 paying customers.

## Phase 3: Redesign and onboarding
1. Implement `docs/DESIGN_SYSTEM.md`.
2. First-run onboarding: upload, pick marketplace, one-click result.
3. Presets by marketplace and niche.

## Phase 4: Growth features
1. Marketplace export sizes, listing helper, brand kit, batch runs.
2. Referral loop and shareable mockup pages.
3. Etsy / Shopify integrations when API access is approved.

## Legal before public launch
Impressum, privacy policy, terms, cookie consent, AI-content disclosure, image rights.
