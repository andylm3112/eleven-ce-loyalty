/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#11196d',
        secondary: '#3c4142',
        light: '#f0f0f0',
      },
      fontFamily: {
        palace: ['Palace Script MT', 'Palace Script', 'cursive'],
        oswald: ['Oswald', 'sans-serif'],
      },
      boxShadow: {
        primary: '0 10px 15px -3px rgba(17, 25, 109, 0.45)',
        'primary-lg': '0 4px 14px rgba(17, 25, 109, 0.55)',
      },
    },
  },
  plugins: [],
}
