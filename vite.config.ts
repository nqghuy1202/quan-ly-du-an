import react from '@vitejs/plugin-react'
import stylex from '@stylexjs/unplugin/vite'
import { defineConfig } from 'vitest/config'

// StyleX compile chỉ mã của repo này (xem `astryx docs styling-overview`); style của Astryx đến từ astryx.css dựng sẵn.
export default defineConfig({
  plugins: [stylex(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
})
