/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta da marca: rampa preto → dourado (tema preto, cinza e dourado).
        // Tons claros = dourado suave/creme; tons escuros = quase preto quente.
        brand: {
          50: '#faf6ea',
          100: '#f3e7c6',
          200: '#e7d097',
          300: '#d6b45a',
          400: '#c79b2c',
          500: '#b58a1d',
          600: '#8a6912',
          700: '#6b4f14',
          800: '#2b2415',
          900: '#15110a',
        },
      },
    },
  },
  plugins: [],
}
