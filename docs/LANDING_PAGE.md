# Landing page spec (SEO + AEO)

## Goal
Convert visitors to a waitlist signup (phase 1), then to free trial.

## Positioning
"Lifestyle mockups for Gen Z sellers. Upload your design, get listing-ready photos in seconds."

## Sections
1. Hero: headline, subhead, primary CTA, before/after visual.
2. Problem: expensive photoshoots, generic mockups.
3. How it works: upload, choose vibe, download (3 steps).
4. Gen Z styling features (poses, locations, lighting, Surprise Me).
5. Use cases: POD sellers, marketers, designers.
6. Pricing (marked "proposed" until final).
7. FAQ (also as FAQPage JSON-LD).
8. Final CTA + footer with legal links.

## SEO / AEO
- Target queries: AI mockup generator for Etsy, print on demand mockups, Gen Z product photos, hoodie mockup generator.
- JSON-LD: `SoftwareApplication`, `Organization`, `FAQPage`.
- Core Web Vitals: LCP < 2.5 s, INP < 200 ms, CLS < 0.1.
- Allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot) in `robots.txt`.
- Clear, quotable answers in the FAQ for answer engines.

## Rules
- **No fabricated proof.** Any testimonial, rating, user count or logo in drafts is a placeholder and must be replaced with real data or removed before launch. Do not include `aggregateRating` or `Review` schema until real.
- Show real generated examples, labelled as AI-generated.
- Germany: Impressum and privacy policy links in the footer.
