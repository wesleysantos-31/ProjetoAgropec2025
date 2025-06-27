/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{html,js}", // Procura por arquivos .html e .js na pasta principal
    "./src/**/*.{html,js}" // Procura por arquivos .html e .js na pasta src e suas subpastas
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

