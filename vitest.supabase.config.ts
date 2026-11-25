// Lệnh riêng để chủ dự án chạy bộ test hợp đồng và bảng ca dùng chung trên Supabase THẬT:
//
//   npx vitest run --config vitest.supabase.config.ts
//
// Không nằm trong `npm test` (cổng không có mạng, không có DB). Đọc SUPABASE_TEST_* từ biến môi
// trường hoặc từ .env.test.local (đã nằm trong .gitignore); xem supabase/README.md.
// Thiếu cấu hình thì lệnh thất bại với lý do "CHƯA KIỂM", không bao giờ báo là đạt.
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/kho/khoSupabase.test.ts'],
    env: {
      ...loadEnv(mode, process.cwd(), 'SUPABASE_TEST_'),
      CHAY_TEST_SUPABASE: '1',
    },
    // Gọi mạng thật: mỗi ca đăng ký vài tài khoản; chạy tuần tự cho dễ đọc lỗi.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
}))
