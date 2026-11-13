/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#11196d',
        secondary: '#3c4142',
        light: '#f0f0f0',
        oro: '#D4AF37',
      },
      fontFamily: {
        palace: ['Palace Script MT', 'Palace Script', 'cursive'],
        oswald: ['Oswald', 'sans-serif'],
      },
      boxShadow: {
        primary: '0 10px 15px -3px rgba(17, 25, 109, 0.45)',
        'primary-lg': '0 4px 14px rgba(17, 25, 109, 0.55)',
        oro: '0 0 0 1px rgba(212, 175, 55, 0.35), 0 8px 30px -6px rgba(212, 175, 55, 0.45)',
      },
      transitionTimingFunction: {
        suave: 'cubic-bezier(0.22, 1, 0.36, 1)',
        rebote: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'entrar-arriba': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'entrar-escala': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'estrella-pop': {
          '0%': { opacity: '0', transform: 'scale(0) rotate(-35deg)' },
          '60%': { opacity: '1', transform: 'scale(1.18) rotate(6deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'aviso-entrar': {
          '0%': { opacity: '0', transform: 'translateY(-16px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        brillo: {
          '0%': { transform: 'translateX(-120%) skewX(-20deg)' },
          '100%': { transform: 'translateX(220%) skewX(-20deg)' },
        },
        latido: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.0)' },
          '50%': { boxShadow: '0 0 0 6px rgba(212, 175, 55, 0.22)' },
        },
        sacudir: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-5px)' },
          '40%, 80%': { transform: 'translateX(5px)' },
        },
        flotar: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        esqueleto: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'entrar-arriba': 'entrar-arriba 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'entrar-escala': 'entrar-escala 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'estrella-pop': 'estrella-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'aviso-entrar': 'aviso-entrar 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        brillo: 'brillo 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        latido: 'latido 2.4s ease-in-out infinite',
        sacudir: 'sacudir 0.4s ease-in-out',
        flotar: 'flotar 4s ease-in-out infinite',
        esqueleto: 'esqueleto 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
