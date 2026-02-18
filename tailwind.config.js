/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          300: '#C8F560',
          400: '#B8E550',
        }
      }
    },
  },
  plugins: [],
}
