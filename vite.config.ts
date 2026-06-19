import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages builds pass an explicit base; locally serve from root.
  base: process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/destovky/' : '/'),
})
