// Bộ test hợp đồng và bảng ca dùng chung cho bản Supabase, chạy trên Supabase THẬT.
//
// - `npm test` (cổng): không bao giờ gọi mạng. Ca duy nhất bị bỏ qua và mang tên "CHƯA KIỂM ...":
//   bản Supabase chưa được kiểm, không phải đã đạt.
// - Lệnh riêng của chủ dự án: `npx vitest run --config vitest.supabase.config.ts`, với các biến
//   SUPABASE_TEST_* (xem supabase/README.md). Thiếu hay sai cấu hình thì lệnh này THẤT BẠI với lý
//   do "CHƯA KIỂM ...", để không ai đọc nhầm là đạt.
import { describe, it } from 'vitest'
import { chayBangCaQuyen, chayBoTestHopDong } from './hopDong'
import { cauHinhTestSupabase, taoBoBanCaiSupabase } from './hopDongSupabase'

// Đọc biến môi trường của tiến trình test mà không cần kiểu của Node trong mã ứng dụng.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const ketQua = cauHinhTestSupabase(env)

switch (ketQua.trangThai) {
  case 'CHAY': {
    const { taoBanCai, tuyChon } = taoBoBanCaiSupabase(ketQua.cauHinh)
    chayBoTestHopDong('bản Supabase', taoBanCai, tuyChon)
    chayBangCaQuyen('bản Supabase', taoBanCai, tuyChon)
    break
  }
  case 'THIEU_CAU_HINH': {
    const lyDo = ketQua.lyDo
    describe('Kho dữ liệu — bản Supabase', () => {
      it('có đủ cấu hình test Supabase', () => {
        throw new Error(lyDo)
      })
    })
    break
  }
  case 'BO_QUA': {
    const lyDo = ketQua.lyDo
    describe('Kho dữ liệu — bản Supabase', () => {
      it.skip(lyDo, () => {})
    })
    break
  }
}
