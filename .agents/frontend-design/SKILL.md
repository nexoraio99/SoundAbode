---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping existing UI. Use whenever the user is building a landing page, dashboard, admin panel, marketing site, or any new frontend component, even if they don't explicitly ask for "design help." Also use when a UI feels generic, templated, or "AI-made" and needs a stronger visual point of view. Covers typography, color, spacing, layout density, and avoiding default framework aesthetics.
---

# Frontend Design

A skill for making deliberate visual design decisions instead of falling back on generic defaults (centered hero, blue gradient, rounded-xl everything, Inter font, evenly-spaced cards).

## Core principle

Every UI has a point of view. Before writing any component, decide:
1. What should this feel like? (premium/utilitarian, playful/serious, dense/spacious)
2. What 1-2 reference products does this aesthetic match? (e.g. Stripe, Linear, Vercel, Arc, Notion)
3. What's the ONE visual element that will make this feel intentional rather than templated?

If the user gives a reference (e.g. "Stripe/Linear/Vercel-level design density"), treat that as the source of truth for spacing scale, type scale, and information density — not generic "clean modern SaaS" defaults.

## Typography

- Pick a type scale and stick to it (e.g. 12/14/16/20/24/32/48). Don't let component library defaults dictate this.
- Avoid defaulting to Inter for everything. Consider pairing a distinct display font for headings with a neutral body font.
- Line height and letter spacing matter more than font choice for a "designed" feel — tight letter-spacing on large headings, generous line-height on body text.
- Font weight contrast (400 body / 600 headings) reads more premium than color contrast alone.

## Color

- Never use default Tailwind blue-500 as a primary brand color unless the brand actually is that blue.
- Build from a real palette: 1 primary, 1-2 neutrals (not pure black/white — slightly warm or cool grays), 1 accent for state (success/error/warning).
- Dark mode is not "invert the colors" — recompute contrast ratios and desaturate slightly for dark backgrounds.
- Density references like Linear/Stripe use near-black (#0A0A0B style) rather than pure #000, and off-white rather than pure #FFF.

## Spacing & density

- Decide information density explicitly. Stripe/Linear-level density means smaller padding (8-12px, not 16-24px), tighter row heights, more information visible without scrolling.
- Use a consistent spacing scale (4/8/12/16/24/32/48/64) — never arbitrary pixel values.
- Whitespace should group related elements, not just pad everything evenly — proximity implies relationship.

## Layout

- Avoid the "centered hero + 3 feature cards + centered CTA" template unless it's genuinely the right structure for the content.
- Asymmetry and off-grid elements often read as more intentional than perfectly centered/symmetric layouts — use deliberately, not by default.
- For admin panels/dashboards specifically: prioritize scannable tables/lists over card grids when displaying more than ~6 items of the same type.

## Anti-patterns to actively avoid

- Generic gradient backgrounds (purple-to-blue) with no relation to brand
- Overuse of rounded-xl/rounded-2xl on every element — vary corner radius intentionally (sharp for data-dense UI, soft for marketing/consumer)
- Drop shadows on everything — use shadow only to indicate elevation/interactivity, not decoration
- Icon + heading + paragraph repeated 3x in a row as the default "features" pattern
- Placeholder-feeling copy ("Lorem ipsum," "Feature description goes here")

## Workflow

1. Before writing code, state the design direction in 2-3 sentences (aesthetic, density, reference).
2. Build the type scale and color tokens first, as CSS variables or a Tailwind config extension — not ad hoc per-component.
3. Build one representative component fully polished before scaling the pattern across the app.
4. After building, do a pass specifically checking against the anti-patterns list above.

## When working on Soundabode / admin panels

Target Stripe/Linear/Vercel density: compact rows, monospace for numeric/ID columns, subtle hover states (not full color inversion), and restrained use of color — most of the UI should be grayscale with color reserved for status/action.
