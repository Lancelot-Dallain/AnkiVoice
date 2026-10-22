/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `base: './'` keeps every asset path relative, so the same build works on
// GitHub Pages (https://<user>.github.io/AnkiVoice/) and on any static host.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 600 },
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
