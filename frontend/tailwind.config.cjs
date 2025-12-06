/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Sora"', 'system-ui', 'sans-serif']
      },
      colors: {
        woy: {
          bg: '#020617',
          surface: '#050816',
          soft: '#0b1220',
          accent: '#22c55e',
          accentSoft: '#4ade80',
          danger: '#f97373'
        }
      },
      borderRadius: {
        '2xl': '1.25rem'
      },
      boxShadow: {
        'woy-soft': '0 18px 60px rgba(0,0,0,0.65)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(18px) scale(0.98)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards'
      }
    }
  },
  plugins: []
};
