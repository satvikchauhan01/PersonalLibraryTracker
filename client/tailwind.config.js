/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // Phase 13: class-based, not media-query-based — ThemeContext toggles a
  // `dark` class on <html> itself, so a manual choice can override the OS
  // preference instead of just mirroring it.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        // Neumorphic redesign ("Tactile Bibliotheca", via Stitch): headings
        // use Plus Jakarta Sans, body/labels stay on Inter.
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      // Neumorphic redesign color tokens — CSS custom properties (defined in
      // index.css under :root and .dark) so a component writes `bg-surface`
      // /`text-on-surface` ONCE and it adapts with the existing dark-mode
      // toggle automatically, instead of doubling every className with a
      // `dark:` pair the way the rest of the app's plain Tailwind colors do.
      // Scoped to components actually rebuilt for the redesign — untouched
      // screens keep using gray-50/white/indigo etc. exactly as before.
      colors: {
        surface: 'var(--neu-surface)',
        'surface-dim': 'var(--neu-surface-dim)',
        'surface-bright': 'var(--neu-surface-bright)',
        'surface-container-lowest': 'var(--neu-surface-container-lowest)',
        'surface-container-low': 'var(--neu-surface-container-low)',
        'surface-container': 'var(--neu-surface-container)',
        'surface-container-high': 'var(--neu-surface-container-high)',
        'surface-container-highest': 'var(--neu-surface-container-highest)',
        'on-surface': 'var(--neu-on-surface)',
        'on-surface-variant': 'var(--neu-on-surface-variant)',
        'inverse-surface': 'var(--neu-inverse-surface)',
        'inverse-on-surface': 'var(--neu-inverse-on-surface)',
        outline: 'var(--neu-outline)',
        'outline-variant': 'var(--neu-outline-variant)',
        primary: 'var(--neu-primary)',
        'on-primary': 'var(--neu-on-primary)',
        'primary-container': 'var(--neu-primary-container)',
        'on-primary-container': 'var(--neu-on-primary-container)',
        'inverse-primary': 'var(--neu-inverse-primary)',
        secondary: 'var(--neu-secondary)',
        'on-secondary': 'var(--neu-on-secondary)',
        'secondary-container': 'var(--neu-secondary-container)',
        'on-secondary-container': 'var(--neu-on-secondary-container)',
        tertiary: 'var(--neu-tertiary)',
        'on-tertiary': 'var(--neu-on-tertiary)',
        'tertiary-container': 'var(--neu-tertiary-container)',
        'on-tertiary-container': 'var(--neu-on-tertiary-container)',
        'neu-error': 'var(--neu-error)',
        'on-neu-error': 'var(--neu-on-error)',
        'neu-error-container': 'var(--neu-error-container)',
        'on-neu-error-container': 'var(--neu-on-error-container)',
        'neu-background': 'var(--neu-background)',
        'on-neu-background': 'var(--neu-on-background)',
      },
      // Same var()-driven trick for the neumorphic shadow recipes themselves
      // — each name below is one "tactile" state from the design system
      // (see UI_CONTEXT/design tokens pulled from Stitch): extruded surfaces
      // at three sizes, one hover-lifted variant, and four inset/pressed
      // depths (including a focus-ring version for inputs).
      boxShadow: {
        'neu-xs': 'var(--neu-shadow-xs)', // avatars, tiny circular badges
        'neu-sm': 'var(--neu-shadow-sm)', // 36px icon badges
        neu: 'var(--neu-shadow)', // buttons, pills, nav links
        'neu-md': 'var(--neu-shadow-md)', // primary CTA buttons
        'neu-lg': 'var(--neu-shadow-lg)', // cards / panels (resting)
        'neu-lg-hover': 'var(--neu-shadow-lg-hover)', // cards / panels (hover-lifted)
        'neu-xl': 'var(--neu-shadow-xl)', // book cards / wide list rows (resting)
        'neu-xl-hover': 'var(--neu-shadow-xl-hover)', // book cards / wide list rows (hover-lifted)
        'neu-inset-xs': 'var(--neu-shadow-inset-xs)', // thin dividers
        'neu-inset-sm': 'var(--neu-shadow-inset-sm)', // small pressed icon badges
        'neu-inset': 'var(--neu-shadow-inset)', // active/pressed pills & buttons
        'neu-inset-lg': 'var(--neu-shadow-inset-lg)', // inputs / search bars (resting)
        'neu-inset-focus': 'var(--neu-shadow-inset-focus)', // inputs (focused — adds a primary-tinted ring)
      },
      borderRadius: {
        neu: '0.5rem',
        'neu-lg': '1rem',
        'neu-xl': '1.5rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
