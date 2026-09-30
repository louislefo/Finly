---
name: Premium FinTech Design System
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f22'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb3ad'
  on-tertiary: '#68000a'
  tertiary-container: '#ff5451'
  on-tertiary-container: '#5c0008'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.05em
  caption-xs:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '300'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  grid_columns: '12'
  gutter: 16px
  margin_mobile: 20px
  margin_desktop: 40px
  bento_gap: 12px
---

## Brand & Style

This design system is engineered for high-net-worth individual wealth management and sophisticated retail banking, drawing inspiration from the minimal, purposeful aesthetics of Apple, Linear, and Finary.

The aesthetic follows a **Modern Minimalist** philosophy with heavy **Bento Grid** modularity. It prioritizes information density and typographic hierarchy over visual ornamentation. The interface achieves a luxury digital feel through generous negative space, crisp typography, subtle micro-borders, and disciplined visual restraint.

Key attributes:
- **Sobriety & Restraint:** No visual noise, no superfluous filler icons, no wordy explanatory subtitles under card headers.
- **Precision:** Every component conforms strictly to a consistent geometric grid.
- **Data-First:** Financial figures, balances, and trends take precedence with high-contrast typography.
- **Privacy:** Native support for obfuscated data states across all financial indicators.

## Iconography & Visual Restraint

A defining principle of the Finly visual language is **iconographic restraint**. Icons must serve an unambiguous functional purpose rather than decorative filler.

- **No Decorative Title Icons:** Card headers, modal titles, and section titles must rely on clean typography. Do not prepend decorative icons to titles (e.g., avoid icons beside "Security", "Preferences", or "Automatic Rules" headers).
- **Functional Icons Only:** Icons are strictly reserved for:
  - Direct interactive controls (e.g., Close `X`, Back `ArrowLeft`, Search magnifying glass, Plus for adding resources, Edit pencil, Trash for deletion).
  - Primary navigation links where spatial economy demands clear wayfinding.
- **No Icon Clutter in Badges:** Avoid packing icons inside badges or status pills when concise text suffices.
- **No Filter Chips / Tag Pills:** Filter chips and tag pills are banned from the design system to prevent visual fragmentation.
- **Subtle Visual Weight:** When functional icons are rendered, use a light-to-medium stroke (`w-4 h-4` or `w-5 h-5`) in muted tones (`text-zinc-400` or `text-zinc-500`) that do not distract from numerical data.

## Colors

The palette is optimized for OLED displays and low-light environments, emphasizing a "Deep Space" dark hierarchy.

- **Background:** True-black Slate / Zinc 950 (`#09090B`) to maximize contrast and power efficiency.
- **Surfaces:** Cards and containers use Zinc 900 (`#18181B`). Interactive surfaces use a subtle hover gradient from `white/5` to `transparent`.
- **Accents:** 
    - **Primary (Indigo):** Used for primary buttons, active navigation states, and focal highlights.
    - **Success (Emerald / Green):** Reserved for positive portfolio performance and completed sync/validations.
    - **Danger (Rose / Red):** Used for outflows, negative balances, and destructive actions.
- **Borders:** All cards utilize a 1px solid border at `rgba(255, 255, 255, 0.1)`.

## Typography

The system utilizes **Inter** for its systematic, utilitarian clarity. The hierarchy relies on extreme weight contrast—pairing heavy, tight-tracked display titles with light, airy sub-captions.

- **Privacy Mode:** When "Privacy Masking" is toggled, sensitive financial values (balances, account numbers) are replaced by the `masked_content_char` token without layout shift.
- **Alignment:** Financial figures use tabular lining (`font-mono` / `tnum`) to ensure decimal points and currency symbols align across lists and tables.
- **Subtitles & Descriptions:** Card titles are concise and direct; avoid redundant explanatory text beneath titles.

## Layout & Spacing

The layout is governed by a **Bento Grid** philosophy, where content is grouped into discrete, high-radius containers of varying sizes.

- **The Bento Logic:** On desktop, use a 12-column grid. Components span 3, 4, 6, or 12 columns. On mobile, components default to full-width or a 2-column masonry layout.
- **Spacing Rhythm:** Base-4 increment. `12px` to `16px` standard gap between Bento cards.
- **Safe Areas:** Respect the iOS Home Indicator safe area on mobile devices with at least 34px bottom padding.

## Elevation & Depth

Depth is created through **Tonal Layering** and **Glassmorphism** rather than heavy drop shadows.

- **Level 0 (Base):** Background (`#09090B`).
- **Level 1 (Cards):** Surface (`#18181B`) with 1px border (`border-white/10`).
- **Level 2 (Modals / Overlays):** `backdrop-blur-md` with background `rgba(24, 24, 27, 0.8)`.
- **Glass Effects:** Translucent top navigation bars and bottom tab bars for seamless scroll depth.

## Shapes & Radius

- **Containers:** Bento cards utilize `24px` (`rounded-3xl`) radius.
- **Modals & Dialogs:** Rounded `24px` to `32px` on desktop; bottom sheets on mobile use `32px` on top corners.
- **Inputs & Buttons:** Rounded `12px` to `16px` (`rounded-xl` / `rounded-2xl`) for sharp micro-interactions.

## Components & Shadcn UI

- **Buttons:** Primary buttons use solid Indigo (`bg-indigo-600 hover:bg-indigo-500`). Secondary buttons use zinc surface (`bg-zinc-900 border border-white/10 hover:bg-zinc-800`).
- **Bento Cards:** Standard padding `20px` or `24px`. Card titles use concise `title-md`.
- **Lists:** Clean borderless lists with subtle `1px` inset dividers (`border-white/5`).
- **Inputs:** Dark inset fields (`#09090B` or `bg-zinc-900`) with subtle `border-white/10` and Indigo focus ring.

## Visual Reference Examples

For UI and mockup references, static HTML prototype pages are available in `docs/visuals/`. These serve as structural layout guides for components and styling patterns.
