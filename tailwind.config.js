/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark:   '#1A1A2E',
        mid:    '#16213E',
        accent: '#0F3460',
        gold:   '#E94560',
      }
    }
  },
  plugins: []
}
