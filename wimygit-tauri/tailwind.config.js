/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'git-added': '#28a745',
        'git-modified': '#ffc107',
        'git-deleted': '#dc3545',
        'git-untracked': '#6c757d',
        'git-renamed': '#17a2b8',
      },
    },
  },
  plugins: [],
}
