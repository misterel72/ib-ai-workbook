/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // This tells Tailwind to scan your main HTML file
    "./src/**/*.{js,ts,jsx,tsx}", // This tells Tailwind to scan all .js, .ts, .jsx, and .tsx files within your src folder and its subfolders
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

