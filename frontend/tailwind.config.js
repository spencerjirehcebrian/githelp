/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Follow the OS. There is no in-app toggle, so no class strategy is needed
  // and theming costs zero JavaScript.
  darkMode: 'media',
  theme: {
    extend: {
      // A near-monochrome semantic palette driven by CSS variables in
      // index.css. Greyscale carries the entire hierarchy; `accent` is
      // reserved exclusively for the action line, so the one thing that is
      // coloured is the one thing you are meant to do.
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        // A deliberately short scale. Four sizes is enough for a document.
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.09em' }],
        meta: ['0.75rem', { lineHeight: '1.125rem' }],
        body: ['0.8125rem', { lineHeight: '1.3125rem' }],
        title: ['0.875rem', { lineHeight: '1.375rem' }],
      },
      maxWidth: {
        brief: '46rem',
      },
    },
  },
  plugins: [],
}
