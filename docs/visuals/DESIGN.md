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

This design system is engineered for high-net-worth individual wealth management and sophisticated retail banking. The brand personality is authoritative yet approachable, blending the precision of institutional finance with the fluidity of modern consumer technology. 

The aesthetic follows a **Modern Minimalist** approach with heavy **Bento Grid** influences. It prioritizes information density through structured modularity, utilizing high-end materials like frosted glass and micro-borders to create a sense of digital craftsmanship. The interface should feel "expensive"—achieved through generous negative space, crisp typography, and restrained use of color. 

Key attributes:
- **Precision:** Every element is aligned to a strict grid.
- **Privacy:** Native support for obfuscated data states.
- **Tactility:** Physicality is conveyed through subtle gradients and depth, rather than heavy shadows.

## Colors

The palette is optimized for OLED displays and low-light environments, emphasizing a "Deep Space" hierarchy.

- **Background:** The base layer uses a true-black Slate (#09090B) to maximize contrast.
- **Surfaces:** Cards and containers use Zinc 900 (#18181B). For interactive states, apply a linear gradient from `white/5` to `transparent`.
- **Accents:** 
    - **Primary (Indigo):** Used for primary actions, active navigation states, and brand-defining moments.
    - **Success (Green):** Specifically for positive portfolio performance and completed transactions.
    - **Danger (Red):** Used for outflows, budget overages, and critical alerts.
- **Borders:** All cards must utilize a 1px solid border at `rgba(255, 255, 255, 0.1)`.

## Typography

The system utilizes **Inter** for its systematic, utilitarian clarity. The hierarchy relies on extreme weight contrast—pairing heavy, tight-tracked display titles with light, airy sub-captions.

- **Privacy Mode:** When "Privacy Masking" is toggled, sensitive financial values (balances, account numbers) are replaced by the `masked_content_char` token. The font weight should remain consistent with the original value to prevent layout shift.
- **Alignment:** Financial figures should ideally use tabular lining (tnum) to ensure decimal points and currency symbols align perfectly in lists.
- **Captions:** Use `caption-xs` with reduced opacity (50%) for metadata to maintain visual hierarchy.

## Layout & Spacing

The layout is governed by a **Bento Grid** philosophy, where content is grouped into discrete, high-radius containers of varying sizes.

- **The Bento Logic:** On desktop, use a 12-column grid. Components should span 3, 4, 6, or 12 columns. On mobile, components default to full-width but can be arranged in a 2-column masonry style for smaller stats.
- **Spacing Rhythm:** Use a base-4 increment. `12px` is the standard gap between Bento cards to maintain a tight, integrated feel.
- **Safe Areas:** Ensure all bottom-sheet components respect the iOS Home Indicator safe area, providing at least 34px of bottom padding.

## Elevation & Depth

Depth in this design system is created through **Tonal Layering** and **Glassmorphism** rather than traditional drop shadows.

- **Level 0 (Base):** Background (#09090B).
- **Level 1 (Cards):** Surface (#18181B) with a 1px border (`white/10`).
- **Level 2 (Overlays/Modals):** Use `backdrop-blur-md` with a background of `rgba(24, 24, 27, 0.8)`. 
- **Glass Effects:** Top navigation bars and bottom tab bars must be translucent to allow content to peek through during scroll, creating an "iOS-native" feeling of continuity.
- **Shadows:** Use only for high-level floating elements (e.g., Action Buttons). If used, they should be "Ambient Shadows": Black, 25% opacity, 20px blur, 0px offset.

## Shapes

The shape language is sophisticated and friendly, utilizing large corner radii to soften the data-heavy nature of finance.

- **Containers:** Bento cards utilize a `24px` (rounded-3xl) radius.
- **Interactions:** Bottom sheets use a more aggressive `32px` radius on top corners only to signal their status as temporary overlays.
- **Input/Buttons:** Smaller elements use a `12px` radius to maintain a distinct visual identity from the layout containers they sit within.
- **Drag Handles:** Bottom sheets must include a center-aligned, rounded-pill handle (width: 36px, height: 4px, color: `white/20`).

## Components

- **Buttons:** Primary buttons use a solid Indigo background. Secondary buttons use the card surface color with a `white/10` border. Labels are always semi-bold.
- **Bento Cards:** Every card must have a padding of `20px` or `24px`. Headlines within cards should use `title-md`.
- **Lists:** Transaction lists should be borderless, separated by subtle `1px` lines of `white/5` that don't touch the container edges (inset dividers).
- **Bottom Tabs:** Use a glass-morphic blur background. Active icons use the Primary Indigo color; inactive icons use `white/40`.
- **Inputs:** Fields are dark (#09090B), inset into the card surface, with a `white/10` border that glows slightly (Indigo) when focused.
- **Haptic feedback:** All primary actions (transfer, buy, sell) should be documented as triggering a "Medium" haptic impact on mobile devices.