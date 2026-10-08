import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts: tests exercise plain modules and need neither
// the React plugin nor the Pages base path.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
