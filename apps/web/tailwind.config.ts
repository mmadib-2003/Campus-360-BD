// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';

// TRUE DARK (Campus360 BD): the `slate` scale is repointed from blue-tinted
// stops to neutral, true-black-based grays. In dark mode the app now renders
// page backgrounds at #000000, cards at #0a0a0a and raised surfaces/borders at
// #1c1c1c–#2e2e2e — depth comes from subtle lightness steps and hairline
// borders instead of blue tints. Light mode remains visually neutral
// (near-identical grays to before). Contrast on black is AA-compliant:
// slate-400 #a3a3a3 ≈ 8.3:1, slate-300 #d4d4d4 ≈ 12:1, slate-100+ ≥ 14:1.
const trueDarkSlate = {
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#e5e5e5',
  300: '#d4d4d4',
  400: '#a3a3a3',
  500: '#8a8a8a',
  600: '#525252',
  700: '#2e2e2e',
  800: '#1c1c1c',
  900: '#0a0a0a',
  950: '#000000',
} as const;

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-noto-bengali)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        slate: trueDarkSlate,
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
