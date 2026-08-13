import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/src/**/*.{js,jsx,ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        // NOTE: --primary etc. are COMMA-separated ("59, 130, 246") so use
        // rgba(var(--x), <alpha-value>). Using rgb(var(--x) / <alpha-value>)
        // with comma-separated values produces invalid CSS (rgb(59, 130, 246 / 1))
        // which silently drops the color and renders transparent.
        primary: 'rgba(var(--primary), <alpha-value>)',
        'primary-light': 'rgba(var(--primary-light), <alpha-value>)',
        'primary-dark': 'rgba(var(--primary-dark), <alpha-value>)',
        sidebar: 'rgba(var(--sidebar-bg), <alpha-value>)',
        'card-bg': 'rgba(var(--card-bg), <alpha-value>)',
        'text-primary': 'rgba(var(--text-primary), <alpha-value>)',
        'text-secondary': 'rgba(var(--text-secondary), <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Microsoft YaHei"', '"PingFang SC"', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
