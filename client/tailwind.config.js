/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#e94560',
        secondary: '#ff6b6b',
        dark: {
          100: '#1a1a2e',
          200: '#16213e',
          300: '#0f0f1a',
          400: '#0f3460',
        },
      },
    },
  },
  plugins: [],
}
