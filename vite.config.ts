import react from '@vitejs/plugin-react'
import stylex from '@stylexjs/unplugin/vite'
import { defineConfig } from 'vitest/config'

// StyleX compile chỉ mã của repo này (xem `astryx docs styling-overview`); style của Astryx đến từ astryx.css dựng sẵn.
export default defineConfig({
  plugins: [stylex(), react()],
  test: {
    // Mặc định node. Test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file: đặt 'jsdom' ở đây thì
    // vitest dò gói jsdom ngoài thư mục repo và bị cổng kiểm (sandbox) chặn đọc (EPERM).
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
})
