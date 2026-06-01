---
name: Timeless Heritage
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#5d3f3c'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#926f6b'
  outline-variant: '#e7bdb8'
  surface-tint: '#c00014'
  primary: '#ba0013'
  on-primary: '#ffffff'
  primary-container: '#e31e24'
  on-primary-container: '#fffafa'
  inverse-primary: '#ffb4ab'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#5c5b5b'
  on-tertiary: '#ffffff'
  tertiary-container: '#757474'
  on-tertiary-container: '#fffbfb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#93000d'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  headline-lg:
    fontFamily: Work Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Work Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Work Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Work Sans
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  label-lg:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  touch-target-min: 56px
  stack-gap: 20px
---

## Brand & Style

The design system is built on the pillars of **Trust, Simplicity, and Premium Heritage**. It caters specifically to a demographic that values traditional reliability but requires modern, accessible interfaces. The brand personality is that of a "trusted family advisor"—knowledgeable, clear, and dignified.

The visual style is **Corporate Modern with a Minimalist focus**. By utilizing heavy white space and a high-contrast palette, we ensure the UI is not only premium but also highly legible for senior users. We avoid complex gestures and hidden menus in favor of explicit, large-scale interface elements that provide immediate clarity and confidence in every interaction.

## Colors

The color strategy uses a high-contrast white base to ensure maximum readability and a "gallery" feel for jewelry products.

*   **Primary (Deep Red):** Used for critical actions, branding, and highlighting important status updates. It evokes the traditional auspiciousness of the brand.
*   **Secondary (Gold):** Reserved for premium accents, decorative dividers, and "success" or "reward" states in saving schemes.
*   **Neutral/Text:** We use a deep Charcoal (#1A1A1A) instead of pure black for body text to reduce eye strain while maintaining a high contrast ratio (minimum 7:1) against the white background.
*   **Surface:** Backgrounds remain strictly off-white or white to keep the interface feeling open and clean.

## Typography

The system exclusively uses **Work Sans** for its exceptional legibility and professional, grounded character. 

To accommodate senior users, the base body size is set to **18px/20px**, significantly larger than standard web defaults. We use generous line-heights (1.5x) to prevent text lines from crowding. All headlines use a bold weight to establish a clear information hierarchy. Letter spacing is slightly tightened for headlines to maintain a premium feel, while labels are slightly tracked out for clarity.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop (max-width 1200px) and a **Fluid Grid** on mobile to maximize tap areas.

*   **Accessibility First:** A minimum touch target of **56px** is enforced for all interactive elements (buttons, inputs, links) to support users with limited dexterity.
*   **Vertical Rhythm:** We use a 20px stack gap between major content blocks to ensure the UI never feels cluttered.
*   **Mobile Layout:** A single-column layout is preferred for all data-heavy views (like saving schemes) to prevent horizontal scanning difficulties. Margins are generous (24px) to keep content away from the screen edges where it might be harder to read or tap.

## Elevation & Depth

To maintain a "simple and trustworthy" feel, the system avoids complex shadows or heavy blurs. 

1.  **Low-Contrast Outlines:** Most containers use a 1px solid border in a soft light-grey rather than a shadow. This creates a clear boundary for tap targets without adding visual noise.
2.  **Tonal Stacking:** We use subtle grey backgrounds (#F3F3F3) to differentiate "sections" within a page.
3.  **Functional Elevation:** A single, soft ambient shadow (0px 4px 20px rgba(0,0,0,0.05)) is used exclusively for the primary "Action Card" (e.g., current gold rate or payment due card) to draw immediate attention.

## Shapes

The shape language uses **Rounded (0.5rem)** corners. This strike a balance between the precision of the jewelry industry and the friendliness required for an accessible consumer app. 

Buttons use a more pronounced `rounded-lg` (1rem) to make them look distinct and "clickable." Image containers for jewelry items use the standard 0.5rem radius to frame the products elegantly without distracting from the craftsmanship.

## Components

*   **Buttons:** Must be full-width on mobile with a minimum height of 56px. Primary buttons use the Deep Red background with White text. Secondary buttons use a Gold border with Gold text.
*   **Input Fields:** Use a 16pt font size minimum to prevent iOS zoom-on-focus and ensure legibility. Labels must always be visible (no floating labels that disappear).
*   **Saving Scheme Visualization:** Use simplified progress bars in Gold (#D4AF37) against a light grey track. Avoid complex charts; use large "Amount Saved" vs "Goal" text pairings.
*   **Clear Icons:** Every icon must be accompanied by a text label in `label-lg`. Icons should use a 2px stroke weight for high visibility.
*   **Cards:** Used for Gold/Silver rates. These should feature a "hero" number (32px+) for the price, with a clear Up/Down indicator using semantic colors (Green/Red) alongside the percentage.
*   **Navigation:** Use a fixed bottom navigation bar with large icons and labels for the core features: Home, Schemes, Store, and Profile.