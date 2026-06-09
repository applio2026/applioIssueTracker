/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0052cc',
          light: '#4c9aff',
          dark: '#091e42',
        },
        accent: '#6554c0',
      },
    },
  },
  plugins: [],
};
