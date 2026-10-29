import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.test.{js,jsx}'],
    globals: true,
  },
})
