# Design System Steering

## Brand Direction

Linqsy UI should feel:

- premium
- calm
- modern
- uncluttered
- fast and responsive

Theme direction:

- dark-first
- layered surfaces
- restrained but clear accent color usage

## Token System

Define design tokens before component implementation.

Token categories:

- color: background, surface, border, text, accent, success, warning, danger
- spacing: fixed scale for paddings, gaps, and layout rhythm
- radius: limited set (for example `sm`, `md`, `lg`, `xl`)
- shadow: soft depth scale, not hard drop shadows
- motion: duration and easing tokens
- z-index: fixed layer scale

Token naming should be semantic, not raw values.

## Typography

Use expressive but readable typography:

- heading family: Sora or equivalent geometric sans
- body family: Manrope or equivalent humanist sans
- mono family: JetBrains Mono for codes and technical strings

Rules:

- defined type scale for headings/body/captions
- consistent line-height per scale step
- avoid mixed random font families

## Component Visual Rules

- use consistent corner radii and spacing rhythm
- keep status indicators explicit and color-safe
- avoid overloaded card designs
- preserve clear visual hierarchy across session, transfers, and presence

## Motion Rules

- motion must explain state changes
- use short entrance and status transitions
- avoid decorative motion loops that distract from transfers
- reduce motion for users requesting reduced motion

## Layout Rules

- mobile-first spacing and touch targets
- avoid dense desktop-only layouts
- preserve readable widths for transfer lists and activity streams
- keep primary controls in stable locations

## Banned Patterns

- generic off-the-shelf dashboard look
- random one-off colors not tied to tokens
- over-animated UI elements
- pure flat monochrome surfaces with no hierarchy cues
- hidden core actions behind nested interactions

## Frozen Decisions

- Dark-first custom design system is mandatory for v1
- Atomic Design layers consume design tokens, never hardcoded style chaos

## Requires ADR

- Replacing typography families or token model
- Switching to external component library as primary visual language
