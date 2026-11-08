import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [vue()],
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
