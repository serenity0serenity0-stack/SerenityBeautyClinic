/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Serenity Beauty Clinic - Pink & Women Theme Colors
        'primary-pink': '#EC4899',      // Main Pink
        'hot-pink': '#E91E63',          // Hot Pink (Primary Actions)
        'deep-pink': '#C2185B',         // Deep Pink (Secondary)
        'light-pink': '#F06292',        // Light Pink (Hover/Accents)
        'soft-pink': '#F48FB1',         // Soft Pink (Lighter accents)
        'rose-pink': '#EC407A',         // Rose Pink (Alternative)
        'pale-pink': '#F8BBD0',         // Pale Pink (Backgrounds)
        'blush': '#FBE9E7',             // Blush (Soft backgrounds)
        'lavender': '#F3E5F5',          // Light lavender
        'soft-purple': '#CE93D8',       // Purple accent
        'magenta': '#D946EF',           // Magenta highlight
        'rose': {
          50: '#FFF5F7',
          100: '#FFE0E6',
          200: '#FFC0D9',
          300: '#FF9FCC',
          400: '#FF7EB9',
          500: '#EC4899',
          600: '#DB2777',
          700: '#BE185D',
          800: '#9D174D',
          900: '#831843',
        },
        'midnight': '#2D2D2D',
        'charcoal': '#1a1a1a',
        'glass': 'rgba(255, 255, 255, 0.1)',
        'glass-pink': 'rgba(236, 72, 153, 0.1)',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
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
          '0%, 100%': { boxShadow: '0 0 5px rgba(236, 72, 153, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(236, 72, 153, 0.8)' },
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}
