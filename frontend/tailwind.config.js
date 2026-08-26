/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        github: {
          dark: '#000000',
          darker: '#09090b',
          card: '#0c0c0e',
          cardHover: '#141417',
          border: '#202024',
          borderSubtle: '#18181b',
          hover: '#141417',
          muted: '#71717a',
          text: '#e4e4e7',
          textBright: '#ffffff',
          accent: '#3b82f6',
          accentHover: '#60a5fa',
          green: '#22c55e',
          red: '#ef4444',
          purple: '#a855f7',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}

