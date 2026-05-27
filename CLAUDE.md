# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Marketing + ordering site for **3WildFlour's**, a small bakery run by Kate. The "3" is her three kids — Brooke, Caden, Dylan. The wordplay (flour ↔ flower) drives the visual direction: wildflower / cottagecore / slow-living, sage + cream palette.

Phased plan: Phase 1 (scaffold + design) ✅, **Phase 3 (Shopify headless integration) ✅**, Phase 2 (Formspree custom-orders form) and Phase 4 (SEO, analytics, deploy) still pending.

## Commands

```sh
npm run dev      # http://localhost:4321
npm run build    # → ./dist/
npm run preview  # serve ./dist/
```

When verifying changes visually, prefer the **Claude Preview MCP** (`.claude/launch.json` already defines `astro-dev`). The dev server is fine to leave running while editing — Astro HMR handles updates.

## Stack & key conventions

- **Astro 6 + Tailwind CSS 4 (Vite plugin)**. Tailwind v4 uses the new `@theme { ... }` syntax in CSS, **not** a `tailwind.config.js`. All custom tokens (sage/cream/earth/bloom palette, fonts, etc.) live in [src/styles/global.css](src/styles/global.css).
- **TypeScript strict** is enabled but most files are `.astro` with minimal TS. Page frontmatter exports use plain `Props` interfaces.
- **No React/Vue/etc.** Components are server-rendered Astro. The header's mobile menu toggle is a small inline `<script>` — keep client JS minimal.
- **Google Fonts** are loaded in [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro). The trio is: Cormorant Garamond (headings), Inter (body), Caveat (script accents). Don't add a new font without updating both the `<link>` and the `@theme` block.

## Design system (where to look before reinventing)

Theme tokens are defined in [src/styles/global.css](src/styles/global.css):

- **`sage-*`** — primary accent (CTAs, links, prices, dividers, eyebrow text). Sage 700 is the workhorse.
- **`earth-*`** — body text and the footer's previous brown energy.
- **`cream-*`** — backgrounds and inverse text on dark sections.
- **`bloom-*`** — dusty rose, reserved for future wildflower-pop moments.
- Utility classes: `.font-script` (Caveat) and `.eyebrow` (tracked uppercase sage label) — use these instead of re-stating the same Tailwind classes.

Reusable bits in `src/components/`:
- **`Wildflower.astro`** — the inline SVG sprig that replaces what would otherwise be an emoji or icon font. Use `currentColor` and a Tailwind text color class for tinting. Don't bring in an icon library for one or two icons.
- **Header / Footer** are global — change the nav schema in `Header.astro` rather than per-page.

## Shopify integration (headless)

The menu page is **headless against Shopify Storefront API**. There is **no hardcoded product list** — Shopify is the single source of truth.

- **Env vars** in `.env` (gitignored, mirrored in `.env.example`):
  - `PUBLIC_SHOPIFY_DOMAIN` — e.g. `3wildflours.myshopify.com`
  - `PUBLIC_SHOPIFY_STOREFRONT_TOKEN` — public Storefront API token (32 hex chars). Safe to ship to client; it's designed to be public.
  - `PUBLIC_SHOPIFY_API_VERSION` — defaults to `2026-04`.
- **Client** wrapper: [src/lib/shopify.ts](src/lib/shopify.ts). Use this for any new Storefront API call; don't instantiate the client elsewhere.
- **Products** are fetched at build time in [src/pages/menu.astro](src/pages/menu.astro) via `getCollections()` in [src/lib/products.ts](src/lib/products.ts). The page filters to a known section order (`["Breads", "Pastries"]`) — to add a third section, update both this array AND create a Shopify collection with that exact title.
- **Cart** is client-side via [src/lib/cart.ts](src/lib/cart.ts). Cart ID is persisted in `localStorage` under key `3wf_cart_id`. Calls to `addToCart` / `updateLineQuantity` / `removeFromCart` dispatch a `cart-updated` event; the drawer listens and re-renders.
- **Drawer architecture**: [CartIcon.astro](src/components/CartIcon.astro) (button) lives in the Header; [CartDrawer.astro](src/components/CartDrawer.astro) (overlay + panel + script) lives in [BaseLayout.astro](src/layouts/BaseLayout.astro). **Don't move the drawer back into the Header** — the header's `backdrop-blur` creates a CSS containing block that breaks `position: fixed` + `h-full` for descendants. There's a comment in CartDrawer.astro explaining this.
- **Checkout** is Shopify-hosted. The drawer's "Checkout on Shopify" anchor pulls `cart.checkoutUrl` from the Cart API response — don't try to build a custom checkout.

## Other placeholder protocol

- **`[edit: ...]` brackets** in copy mark exact spots where Kate needs to provide real text (see [src/pages/about.astro](src/pages/about.astro)). Don't silently fill these with invented details — either ask, or leave the bracket.
- **Custom-order form** in [src/pages/custom-orders.astro](src/pages/custom-orders.astro) is currently a disabled stub with an explicit "form not yet active" label. Phase 2 will wire it to Formspree.
- **Photos** — hero/section images are Unsplash placeholders. The About page hero has an explicit on-image badge marking it as a placeholder. Real photos will live in `public/images/` and the URLs swap in place. The menu page falls back to a "no photo yet" tile when Shopify products lack a `featuredImage`.

## Brand voice

If you're writing or revising copy, the tone is **earthy · honest · soulful** (also the literal site eyebrow). Concrete signals:
- Short sentences. Sentence fragments are fine.
- Concrete sensory detail beats marketing-speak ("48-hour fermentation, deeply crackling crust" > "artisanal techniques").
- Script-font accents (`.font-script`) are for short poetic lines — *"flour + water = bread magic"*, *"in bloom this week"*. Don't use the script for paragraphs.
- The kids' names appear **only on the About page** by design — not in product copy or commerce-adjacent pages.

## Expenses

[EXPENSES.md](EXPENSES.md) tracks domain, hosting, Shopify, etc. Update it whenever a new paid service is added or a renewal date changes. The user explicitly asked for this — don't let it drift.
