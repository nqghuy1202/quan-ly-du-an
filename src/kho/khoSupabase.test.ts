// Bộ test hợp đồng và bảng ca dùng chung cho bản Supabase, chạy trên Supabase THẬT.
//
// - `npm test` (cổng): không bao giờ gọi mạng. Ca duy nhất bị bỏ qua và mang tên "CHƯA KIỂM ...":
//   bản Supabase chưa được kiểm, không phải đã đạt.
// - Lệnh riêng của chủ dự án: `npx vitest run --config vitest.supabase.config.ts`, với các biến
//   SUPABASE_TEST_* (xem supabase/README.md). Thiếu hay sai cấu hình thì lệnh này THẤT BẠI với lý
//   do "CHƯA KIỂM ...", để không ai đọc nhầm là đạt.
import { describe, it } from 'vitest'
import { chayBangCaQuyen, chayBoTestHopDong } from './hopDong'
import { chayHopDongDuAnKemSoLieu } from './hopDongDuAnKemSoLieu'
import { chayHopDongLienKet } from './hopDongLienKet'
import { chayHopDongMaDuAn } from './hopDongMaDuAn'
import { chayHopDongMucUuTienTask } from './hopDongMucUuTienTask'
import { chayHopDongNgayDuAn } from './hopDongNgayDuAn'
import { chayHopDongRepo } from './hopDongRepo'
import { chayHopDongSuaTask } from './hopDongSuaTask'
import { chayHopDongThongTinNhanSu } from './hopDongThongTinNhanSu'
import { chayHopDongUuTienPhuTrach } from './hopDongUuTienPhuTrach'
import { chayHopDongVaiTroTrongDuAn } from './hopDongVaiTroTrongDuAn'
import { chayHopDongChuyenTrangThai } from './hopDongChuyenTrangThai'
import { cauHinhTestSupabase, taoBoBanCaiSupabase } from './hopDongSupabase'

// Đọc biến môi trường của tiến trình test mà không cần kiểu của Node trong mã ứng dụng.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const ketQua = cauHinhTestSupabase(env)

switch (ketQua.trangThai) {
  case 'CHAY': {
    const { taoBanCai, tuyChon } = taoBoBanCaiSupabase(ketQua.cauHinh)
    chayBoTestHopDong('bản Supabase', taoBanCai, tuyChon)
    chayBangCaQuyen('bản Supabase', taoBanCai, tuyChon)
    // Repo GitHub của Dự án (ticket 15) trên bản Supabase (ticket 17: khoSupabaseGitHub.ts, migration lát 4).
    chayHopDongRepo('bản Supabase', taoBanCai, tuyChon)
    chayHopDongSuaTask('bản Supabase', taoBanCai, tuyChon)
    // Vòng duyệt (ticket 11, 14): hàm chuyển trạng thái và lịch sử đã có trên bản Supabase.
    chayHopDongChuyenTrangThai('bản Supabase', taoBanCai, tuyChon)
    // Link issue hoặc PR trên Task (ticket 16) trên bản Supabase (ticket 17).
    chayHopDongLienKet('bản Supabase', taoBanCai, tuyChon)
    // Mã Dự án và Khách hàng (truong-moi 01): cần migration trường mới của ticket truong-moi 09.
    chayHopDongMaDuAn('bản Supabase', taoBanCai, tuyChon)
    // Ngày bắt đầu, Ngày kết thúc dự kiến (truong-moi 02): cần migration trường mới của ticket truong-moi 09.
    chayHopDongNgayDuAn('bản Supabase', taoBanCai, tuyChon)
    // Mức ưu tiên và Người phụ trách (truong-moi 03): cần migration trường mới của ticket truong-moi 09.
    chayHopDongUuTienPhuTrach('bản Supabase', taoBanCai, tuyChon)
    // Mức ưu tiên của Task (truong-moi 04): cần cột muc_uu_tien và dòng lịch sử đổi mức của ticket truong-moi 10.
    chayHopDongMucUuTienTask('bản Supabase', taoBanCai, tuyChon)
    // Thông tin nhân sự trong hồ sơ (truong-moi 05): cần cột so_dien_thoai, chuc_danh, phong_ban và quyền xem
    // ép ở phía cơ sở dữ liệu của ticket truong-moi 10.
    chayHopDongThongTinNhanSu('bản Supabase', taoBanCai, tuyChon)
    // Vai trò trong Dự án và số Task đang giữ (truong-moi 06): cần cột vai_tro của bảng nguoi_trong_du_an và quyền
    // ghi cột đó của ticket truong-moi 10.
    chayHopDongVaiTroTrongDuAn('bản Supabase', taoBanCai, tuyChon)
    // Dự án kèm Tiến độ, số Trễ hạn, cờ Quá hạn dự kiến (truong-moi 07): bản Supabase đọc theo lô và tính phía
    // client (khoSupabaseDocLo.ts, toi-uu-hieu-nang 02); cần migration trường mới của ticket truong-moi 09 và 10.
    chayHopDongDuAnKemSoLieu('bản Supabase', taoBanCai, tuyChon)
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
