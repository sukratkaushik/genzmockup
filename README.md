# GenZ Mockup Studio

> Upload a flat design. Get scroll-stopping, on-model lifestyle photos for your Etsy / Shopify / TikTok Shop listing in seconds, styled for the Gen Z buyer. No photoshoot, no model, no Photoshop.

**Status:** working front-end prototype (Vite + TypeScript). Not yet a product: no accounts, no payments, no server. See [Honest status](#honest-status) and [Roadmap](#roadmap).

---

## 1. What we are building

**GenZ Mockup Studio is an AI mockup generator built specifically for Gen Z sellers**, i.e. young print-on-demand (POD) and small-brand sellers who sell apparel and lifestyle products on Etsy, Shopify and TikTok Shop, and who sell *to* Gen Z.

A seller uploads a flat PNG design, picks products, a vibe (pose, action, expression, location, lighting) and gets realistic lifestyle mockups they can list immediately. Then they turn those mockups into collages and social posts without leaving the app.

### The problem
- Lifestyle photos sell products; flat designs on a white background do not. A real photoshoot costs money and time per design.
- Generic mockup tools (Placeit, Printful generator, Canva) produce stock-looking, templated results that look like every other listing.
- Gen Z buyers respond to authentic, trend-aware, social-native imagery, not studio catalogue shots.
- New sellers do not know *what* to shoot (which pose, setting, lighting). They need taste built into the tool.

### The wedge (why this can win)
1. **Niche focus.** Built for Gen Z sellers and Gen Z aesthetics, not "everyone who needs a mockup".
2. **Taste as a feature.** Curated Gen Z poses, actions, expressions, locations, lighting and accessories, plus a "Surprise Me" mode, so a beginner gets a good result in one click.
3. **Seller workflow, not just image generation.** Gallery, collage maker, bulk ZIP export, saved presets, cost tracking.
4. **Marketing built in** (planned): listing-ready sizes, social-post templates, and caption / SEO-title helpers.

### Who it is for (ICP)
| Segment | Pain | Win |
|---|---|---|
| POD / Etsy / Shopify sellers (primary) | Expensive, slow lifestyle photos per design | Listing-ready photos in seconds |
| Social media marketers / brand managers | Constant fresh Gen Z-targeted content | Demographic styling + collage maker |
| Apparel / graphic designers | Clients cannot visualise flat designs | Pitch-ready on-model concepts |

### Value proposition
- **Speed:** minutes instead of days per design.
- **Cost:** cents per image instead of a photoshoot.
- **Conversion:** lifestyle imagery that matches how Gen Z shops.
- **Simplicity:** one upload, a few taps, done.

---

## 2. What exists today (verified against the code)

All of this is in `index.tsx` and runs entirely in the browser.

- Drag-and-drop design upload.
- **9 products:** t-shirt (Gildan 5000), oversized tee, hoodie (Gildan 18500), sweatshirt (Gildan 18000), mug, phone case, tote bag, notebook, pillow; garment colour palettes for the Gildan items.
- **Gen Z style controls:** 10 poses, 10 actions, 8 expressions, 10 locations, 5 lighting setups, 8 accessories.
- "Surprise Me" random variation mode.
- Quality presets and saved presets (localStorage).
- Image generation with Gemini (`gemini-2.5-flash-image`).
- Gallery (capped at 100 images), collage maker (up to 9 images), bulk ZIP export (`jszip`).
- Dashboard: mockups today / lifetime, success and failure rate, and a cost tracker.
- Undo / redo history, dark / light theme, sidebar navigation (Dashboard, Create, Gallery, Collage).

## 3. What we will add (the product)

| Area | Planned |
|---|---|
| Accounts | Supabase Auth (email + Google), profiles, plan status |
| Payments | Stripe Checkout + Billing + Customer Portal + Stripe Tax |
| Backend | Server-side Gemini proxy (Edge Function), atomic quota, usage ledger |
| Tiers | Starter free (watermark), Pro, Brand (see pricing) |
| Marketing site | SEO / AEO landing page (see `docs/LANDING_PAGE.md`) |
| Redesign | Distinctive Gen Z UI (see `docs/DESIGN_SYSTEM.md`) |
| Seller tools | Marketplace-ready export sizes, caption and title helper, brand kits, batch generation |

### Proposed pricing (to validate, not final)
| Plan | Price | Mockups / month | Notes |
|---|---|---|---|
| Starter | €0 | 15 | Watermarked |
| Pro | €19 | 200 | No watermark |
| Brand | €49 | Fair-use cap (e.g. 1,000) | Brand kits, priority queue. Do **not** sell as truly unlimited. |

Margins must be checked against real model pricing. The prototype's `$0.05 / image` is a hardcoded placeholder, not a confirmed price. At that figure 200 images costs about $10 of a €19 plan, before Stripe fees and tax. See `docs/TECH_SPEC.md`.

---

## 4. Directions and principles

1. **Validate before building more.** Get 10 real sellers to use the prototype and 3 to pay before the full stack is built (gate in the roadmap).
2. **Distribution is the product.** Marketing is the founder's weakest area, so it is planned as work, not an afterthought. See `docs/GO_TO_MARKET.md`.
3. **Never ship the API key to the browser.** All model calls go through a server proxy with auth and quota.
4. **No fake social proof.** Testimonials, ratings and user counts only appear when real.
5. **Honest AI.** Mockups are AI-generated visualisations; print fidelity must be communicated clearly.
6. **Ship small, measure, repeat.**

## 5. Roadmap

| Phase | Goal | Exit gate |
|---|---|---|
| 0. Fix the prototype | Env bug fixed, key off the client, repo clean | Runs locally, no key in the bundle |
| 1. Validate | Landing page + waitlist + 10 seller trials | 100 signups or 10 active testers |
| 2. Monetise | Supabase auth + Stripe + server proxy | First 3 paying customers |
| 3. Redesign | New UI, onboarding, presets by marketplace | Activation rate tracked |
| 4. Grow | SEO content, TikTok / Etsy community, referral | Repeatable acquisition channel |

Detail in `docs/BUILD_PLAN.md`.

---

## 6. Run it locally

Requirements: Node 18+ and a Gemini API key.

Run all commands from the **repository root** (the folder that contains `package.json`).

```bash
# in: <repo root>/
npm install
cp .env.example .env.local     # then put your key in .env.local
npm run dev
```

**Known issue:** `vite.config.ts` currently does not inject the key, although `index.tsx` reads `process.env.GEMINI_API_KEY`. For local use only, replace the file `<repo root>/vite.config.ts` with:

```ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
  };
});
```

> **Warning:** this bundles your key into the client JavaScript. Use it on your own machine only. Never deploy this publicly. The fix is the server proxy in `docs/TECH_SPEC.md`.

## 7. Repository map

```
README.md              this file: what and why
AGENTS.md              rules for AI coding agents (Antigravity, Claude Code)
.env.example           environment variable template
index.html / index.tsx / index.css   prototype app
docs/PRODUCT.md        users, use cases, features
docs/ARCHITECTURE.md   system design and flows
docs/TECH_SPEC.md      Supabase + Stripe spec, SQL, security
docs/BUILD_PLAN.md     phased plan and agent task order
docs/DESIGN_SYSTEM.md  visual direction
docs/LANDING_PAGE.md   SEO / AEO landing page spec
docs/GO_TO_MARKET.md   distribution plan
docs/KNOWN_ISSUES.md   defects and launch blockers
```

## 8. Honest status

- **Launch blocker:** the Gemini key would be exposed in the browser. No public deploy until the server proxy exists.
- No auth, payments or persistence beyond localStorage.
- Cost figures in the dashboard are hardcoded estimates.
- Legal not done: German Impressum, privacy policy, terms (the founder is in Germany), and a clear stance on rights to uploaded designs and generated images.
- Marketplace API approvals (Etsy, TikTok Shop) take weeks. Do not plan on direct publishing for the first release.
