/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'eleven-gold': '#D4AF37',
      },
      fontFamily: {
        'oswald': ['Oswald', 'sans-serif'],
      }
    },
  },
  plugins: [],
}