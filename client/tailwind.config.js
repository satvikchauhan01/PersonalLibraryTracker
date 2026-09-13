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
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

