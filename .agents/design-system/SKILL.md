---
name: design-system
description: Audit, document, or extend a design system. Use when checking for naming inconsistencies or hardcoded values (colors, spacing, font sizes) across components, writing documentation for a component's variants and states, or designing a new UI pattern that must fit an existing visual system. Trigger this whenever a codebase has more than a few components sharing visual language, even if no formal design system exists yet.
---

# Design System

A skill for keeping visual decisions consistent and reusable across a codebase, instead of every component reinventing spacing/color/type choices.

## When there's no design system yet

If the codebase has hardcoded hex colors, arbitrary px values, and inconsistent font sizes scattered across components, the first job is extraction, not audit:

1. Scan all component files for hardcoded colors, spacing, font-size, border-radius, and shadow values.
2. Cluster near-duplicate values (e.g. #6B7280, #6C7280, #6A7180 are probably meant to be one gray).
3. Propose a token set: colors, spacing scale, type scale, radius scale, shadow scale.
4. Replace hardcoded values with token references (CSS variables or Tailwind theme extension).

## Token categories to define

- **Color**: primary, neutral (5-9 steps), semantic (success/warning/error/info), surface/background levels for layering
- **Spacing**: a consistent scale, typically 4px-based (4/8/12/16/24/32/48/64/96)
- **Typography**: font families, a type scale (not arbitrary sizes), weight scale, line-height pairs
- **Radius**: 2-4 values max (e.g. sm/md/lg), applied consistently by component category
- **Shadow/elevation**: 2-4 levels tied to actual z-index/layering meaning, not decoration
- **Motion**: standard duration/easing values so animations feel consistent app-wide

## Auditing an existing system

Check for:
- **Naming drift**: same concept named differently across files (`primaryColor` vs `brandColor` vs `accentColor`)
- **Hardcoded overrides**: components that bypass tokens with inline styles or magic numbers
- **Orphaned variants**: button/badge/input variants that exist in code but are unused or undocumented
- **Inconsistent states**: hover/focus/disabled/active states defined for some components but missing on others of the same type
- **Accessibility gaps in tokens**: color pairs that don't meet contrast requirements at the token level (fix once at the token, not per-component)

## Documenting a component

For each component, document:
- **Variants**: what visual variants exist and when to use each (e.g. button: primary/secondary/ghost/destructive)
- **States**: default, hover, focus, active, disabled, loading, error
- **Props/API**: what's configurable vs fixed
- **Composition rules**: what it can/can't be nested inside
- **Accessibility notes**: required ARIA attributes, keyboard behavior, focus management

## Designing a new pattern that fits the system

1. Check if an existing component/pattern already solves 80% of the need — extend rather than duplicate.
2. Use only existing tokens; if a genuinely new token is needed, add it to the system deliberately (not as a one-off).
3. Match the density/spacing conventions already established, not a generic default.
4. Define all states (not just default) before considering it done.

## Output format for an audit

Table: Component | Issue | Instances found | Proposed fix

Then apply fixes directly for anything unambiguous (replacing hardcoded values with tokens); flag anything that would visibly change existing UI for review before applying.
