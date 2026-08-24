/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--icu-text-rgb) / <alpha-value>)',
        canvas: 'rgb(var(--icu-canvas-rgb) / <alpha-value>)',
        navy: 'rgb(var(--icu-navy-rgb) / <alpha-value>)',
        midnight: 'rgb(var(--icu-midnight-rgb) / <alpha-value>)',
        teal: 'rgb(var(--icu-teal-rgb) / <alpha-value>)',
        brandblue: 'rgb(var(--icu-blue-rgb) / <alpha-value>)',
        violet: 'rgb(var(--icu-violet-rgb) / <alpha-value>)',
        muted: 'rgb(var(--icu-muted-rgb) / <alpha-value>)',
        line: 'rgb(var(--icu-border-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
