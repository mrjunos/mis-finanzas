/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#13ecda",
        "primary-dark": "#0ebcb0",
        "secondary": "#ff8c73",
        "background-light": "#f8fafc",
        "background-dark": "#102220",
        "surface-glass": "rgba(255, 255, 255, 0.7)",
        "surface-glass-dark": "rgba(16, 34, 32, 0.7)",
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "sans": ["Inter", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "1rem",
        "xl": "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        "full": "9999px"
      },
      boxShadow: {
        "soft": "0 10px 40px -10px rgba(19, 236, 218, 0.15)",
        "glass": "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
      }
    },
  },
  plugins: [],
}
