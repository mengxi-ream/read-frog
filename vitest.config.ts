import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { WxtVitest } from 'wxt/testing'

export default defineConfig({
  // TODO: remove any
  plugins: [WxtVitest() as any, react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: 'vitest.setup.ts',
    watch: false,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov'],
      // include: ['src/**/*.{ts,tsx}'],
      // exclude: ['src/**/*.spec.ts']
    },
  },
})
