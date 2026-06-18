import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard Vite v6 configuration
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
})