/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        traffic: {
          free: '#22c55e',
          light: '#84cc16',
          moderate: '#eab308',
          heavy: '#f97316',
          severe: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
