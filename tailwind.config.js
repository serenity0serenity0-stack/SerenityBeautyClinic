/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Serenity Beauty Clinic - Lavender & Pastel Design System
        // Palette: Lavender #CDB4DB, Soft Pink #FFC8DD, Rose Pink #FFAFCC,
        //          Light Sky Blue #BDE0FE, Soft Blue #A2D2FF
        'primary-pink': '#8A5FB0',      // Primary accent (deep lavender)
        'hot-pink': '#B794CE',          // Bright lavender (accents on dark)
        'deep-pink': '#744D99',         // Deep lavender (secondary)
        'light-pink': '#DCCBED',        // Light lavender
        'soft-pink': '#FFC8DD',         // Palette: Soft Pink
        'rose-pink': '#FFAFCC',         // Palette: Rose Pink
        'pale-pink': '#F8E0F0',         // Pale pink tint
        'blush': '#FBEFF5',             // Blush tint
        'lavender': '#CDB4DB',          // Palette: Lavender (primary)
        'soft-purple': '#B89AD1',       // Soft purple accent
        'magenta': '#D9C6EE',           // Light lavender highlight
        'sky-blue': '#BDE0FE',          // Palette: Light Sky Blue
        'soft-blue': '#A2D2FF',         // Palette: Soft Blue
        'dark': '#111827',              // Dark ink (used for text on gradient buttons)
        // `gold` token keeps its name for compatibility but now renders as
        // the lavender accent ramp (active nav, spinners, badges, CTAs).
        'gold': {
          50: '#FAF6FC',
          100: '#F4ECFA',
          200: '#E9DDF5',
          300: '#CDB4DB',              // Palette: Lavender
          400: '#C9AEE0',              // Bright lavender (accent on dark)
          500: '#A983C9',              // Deep lavender
          600: '#8A5FB0',
          700: '#6F5290',
          800: '#4D3463',
          900: '#332244',
        },
        // Default Tailwind `pink` utilities are remapped to the lavender ramp
        // so primary buttons, chips, borders and focus states stay consistent.
        'pink': {
          50: '#FAF6FC',
          100: '#F4ECFA',
          200: '#E9DDF5',
          300: '#DCCBED',
          400: '#B794CE',
          500: '#8A5FB0',
          600: '#744D99',
          700: '#5B367F',
          800: '#40244F',
          900: '#2B1635',
        },
        'rose': {
          50: '#FFF5FB',
          100: '#FFE7F4',
          200: '#FFD2EA',
          300: '#FFC8DD',
          400: '#FFAFCC',
          500: '#F49BBE',
          600: '#E07CA6',
          700: '#B85C83',
          800: '#8F4566',
          900: '#6B2E4B',
        },
        'midnight': '#0F172A',          // Dark background
        'charcoal': '#1E293B',          // Dark surface
        'glass': 'rgba(255, 255, 255, 0.06)',
        'glass-pink': 'rgba(139, 92, 176, 0.14)',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
      screens: {
        xs: '480px',
      },
      backdropFilter: {
        'blur-20': 'blur(20px)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(139, 92, 176, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(139, 92, 176, 0.8)' },
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}
