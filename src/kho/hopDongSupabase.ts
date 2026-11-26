// Dựng bản cài Supabase cho bộ test hợp đồng và bảng ca dùng chung, chạy trên Supabase thật.
// CHỈ dùng trong test chạy bằng Node (src/kho/khoSupabase.test.ts, lệnh riêng
// `npx vitest run --config vitest.supabase.config.ts`); ứng dụng không import file này.
//
// Khoá service chỉ dùng ở đây, để làm những việc ngoài luồng ứng dụng mà bộ test cần: thay cho
// việc bấm đường dẫn xác nhận email, đọc mã đặt lại mật khẩu, và đặt vai PM (như chủ dự án làm tay).
// Biến của khoá này không có tiền tố VITE_ nên Vite không bao giờ đưa nó vào bản dựng.
import { createClient } from '@supabase/supabase-js'
import { phanLoaiKhoa } from './cauHinh'
import type { BanCaiHopDong, TuyChonHopDong } from './hopDong'
import { thanhCong } from './ketQua'
import { taoKhoSupabase } from './khoSupabase'
import { THONG_BAO, chuanHoaEmail } from '../luat/taiKhoan'
import type { TrangThaiTask } from '../luat/task'

/** Cờ do vitest.supabase.config.ts đặt: chỉ lệnh riêng mới chạy test trên Supabase thật. */
export const CO_CHAY_TEST_SUPABASE = 'CHAY_TEST_SUPABASE'
export const BIEN_TEST_URL = 'SUPABASE_TEST_URL'
export const BIEN_TEST_KHOA_CONG_KHAI = 'SUPABASE_TEST_ANON_KEY'
export const BIEN_TEST_KHOA_SERVICE = 'SUPABASE_TEST_SERVICE_ROLE_KEY'
/** Tuỳ chọn: tên miền cho email test (mặc định example.com). */
export const BIEN_TEST_TEN_MIEN = 'SUPABASE_TEST_EMAIL_DOMAIN'
/** Tuỳ chọn: thời hạn mã đặt lại cấu hình trên Supabase, tính bằng giây (mặc định 3600). */
export const BIEN_TEST_THOI_HAN_MA = 'SUPABASE_TEST_THOI_HAN_MA_GIAY'

export const LENH_TEST_SUPABASE = 'npx vitest run --config vitest.supabase.config.ts'

export interface CauHinhTestSupabase {
  url: string
  khoaCongKhai: string
  khoaService: string
  tenMien: string
  thoiHanMaDatLaiMs: number
}

export type KetQuaCauHinhTest =
  /** Có cờ và đủ cấu hình: chạy bộ test trên Supabase thật. */
  | { trangThai: 'CHAY'; cauHinh: CauHinhTestSupabase }
  /** Lệnh test mặc định (không có cờ): bỏ qua, báo "chưa kiểm". */
  | { trangThai: 'BO_QUA'; lyDo: string }
  /** Lệnh riêng nhưng thiếu hay sai cấu hình: không được báo là đạt. */
  | { trangThai: 'THIEU_CAU_HINH'; lyDo: string }

/**
 * Quyết định có chạy bộ test trên Supabase thật không. Thuần: biến môi trường truyền vào.
 * Lệnh test mặc định không bao giờ gọi mạng, dù máy có sẵn cấu hình test.
 */
export function cauHinhTestSupabase(env: Readonly<Record<string, string | undefined>>): KetQuaCauHinhTest {
  if (env[CO_CHAY_TEST_SUPABASE] !== '1') {
    return {
      trangThai: 'BO_QUA',
      lyDo: `CHƯA KIỂM: bản Supabase không chạy trong lệnh test mặc định; chủ dự án chạy tay bằng \`${LENH_TEST_SUPABASE}\`.`,
    }
  }
  const lay = (ten: string) => (env[ten] ?? '').trim()
  const url = lay(BIEN_TEST_URL)
  const khoaCongKhai = lay(BIEN_TEST_KHOA_CONG_KHAI)
  const khoaService = lay(BIEN_TEST_KHOA_SERVICE)
  const thieu = [
    [BIEN_TEST_URL, url],
    [BIEN_TEST_KHOA_CONG_KHAI, khoaCongKhai],
    [BIEN_TEST_KHOA_SERVICE, khoaService],
  ]
    .filter(([, giaTri]) => giaTri === '')
    .map(([ten]) => ten)
  if (thieu.length > 0) {
    return {
      trangThai: 'THIEU_CAU_HINH',
      lyDo: `CHƯA KIỂM: thiếu cấu hình test Supabase (${thieu.join(', ')}). Xem supabase/README.md.`,
    }
  }
  if (!/^https?:\/\//.test(url)) {
    return { trangThai: 'THIEU_CAU_HINH', lyDo: `CHƯA KIỂM: ${BIEN_TEST_URL} phải là địa chỉ http hoặc https.` }
  }
  if (phanLoaiKhoa(khoaCongKhai) !== 'CONG_KHAI') {
    return {
      trangThai: 'THIEU_CAU_HINH',
      lyDo: `CHƯA KIỂM: ${BIEN_TEST_KHOA_CONG_KHAI} phải là khoá công khai (anon hoặc publishable), không phải khoá service.`,
    }
  }
  if (phanLoaiKhoa(khoaService) !== 'SERVICE') {
    return {
      trangThai: 'THIEU_CAU_HINH',
      lyDo: `CHƯA KIỂM: ${BIEN_TEST_KHOA_SERVICE} phải là khoá service (service_role hoặc sb_secret_...).`,
    }
  }
  const giay = Number(lay(BIEN_TEST_THOI_HAN_MA) || '3600')
  if (!Number.isFinite(giay) || giay <= 0) {
    return { trangThai: 'THIEU_CAU_HINH', lyDo: `CHƯA KIỂM: ${BIEN_TEST_THOI_HAN_MA} phải là số giây dương.` }
  }
  return {
    trangThai: 'CHAY',
    cauHinh: {
      url,
      khoaCongKhai,
      khoaService,
      tenMien: lay(BIEN_TEST_TEN_MIEN) || 'example.com',
      thoiHanMaDatLaiMs: giay * 1000,
    },
  }
}

export interface BoBanCaiSupabase {
  taoBanCai: () => BanCaiHopDong
  /** Tuỳ chọn cho `chayBoTestHopDong` và `chayBangCaQuyen` với bản Supabase. */
  tuyChon: TuyChonHopDong
}

/**
 * Bản cài Supabase cho bộ test hợp đồng. Supabase thật không xoá được dữ liệu giữa các ca, nên
 * mỗi ca dùng email riêng: `taoBanCai` (gọi đầu mỗi ca) đổi tiền tố mà `emailMoi` dùng.
 */
export function taoBoBanCaiSupabase(cauHinh: CauHinhTestSupabase): BoBanCaiSupabase {
  // Mã của lần chạy: ngẫu nhiên, không đọc đồng hồ.
  const maLanChay = Math.random().toString(36).slice(2, 8)
  let soCa = 0

  const emailMoi = (ten: string) => `${ten}.${maLanChay}-${soCa}@${cauHinh.tenMien}`.toLowerCase()
  // Mã Dự án duy nhất trên mọi Dự án và Supabase thật không xoá dữ liệu giữa các lần chạy: mỗi lần
  // chạy một tiền tố riêng (6 ký tự), rồi đếm tăng dần; vẫn đúng dạng 2 đến 12 ký tự.
  let soMa = 0
  const maDuAnMoi = () => {
    soMa += 1
    return `${maLanChay}-${soMa}`.toUpperCase()
  }

  const service = createClient(cauHinh.url, cauHinh.khoaService, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  async function idTheoEmail(email: string): Promise<string | null> {
    const { data, error } = await service.from('ho_so').select('id').eq('email', chuanHoaEmail(email)).maybeSingle()
    if (error) throw new Error(`Không đọc được hồ sơ của ${email}: ${error.message}`)
    return (data as { id: string } | null)?.id ?? null
  }

  function taoBanCai(): BanCaiHopDong {
    soCa += 1
    const kho = taoKhoSupabase({
      url: cauHinh.url,
      khoaCongKhai: cauHinh.khoaCongKhai,
      tuDongLamMoiPhien: false,
    })
    return {
      kho,
      async xacNhanEmail(email: string) {
        // Thay cho việc bấm đường dẫn trong thư: đánh dấu email đã xác nhận bằng API quản trị.
        const id = await idTheoEmail(email)
        if (id) {
          const { error } = await service.auth.admin.updateUserById(id, { email_confirm: true })
          if (error) throw new Error(`Không xác nhận được email ${email}: ${error.message}`)
        }
        return thanhCong({ thongBao: THONG_BAO.daXacNhanEmail })
      },
      async maDatLaiMoiNhat(email: string) {
        // Không đọc được hộp thư thật: xin một mã đặt lại mới qua API quản trị (mã mới thay mã cũ,
        // như thư mới nhất). Email không có tài khoản thì không có mã.
        if (!(await idTheoEmail(email))) return null
        const { data, error } = await service.auth.admin.generateLink({ type: 'recovery', email: chuanHoaEmail(email) })
        if (error) throw new Error(`Không lấy được mã đặt lại cho ${email}: ${error.message}`)
        return data.properties?.email_otp ?? null
      },
      thoiHanMaDatLaiMs: cauHinh.thoiHanMaDatLaiMs,
      async datVaiPM(email: string) {
        // Như chủ dự án đặt PM đầu tiên trong SQL Editor: không có người gọi nên trigger cho phép.
        const { data, error } = await service
          .from('ho_so')
          .update({ vai: 'PM' })
          .eq('email', chuanHoaEmail(email))
          .select('id')
        if (error) throw new Error(`Không đặt được vai PM cho ${email}: ${error.message}`)
        if (!data || data.length === 0) throw new Error(`Không có hồ sơ nào với email ${email}`)
      },
      async datTrangThaiTask(taskId: string, trangThai: TrangThaiTask) {
        // Như chủ dự án sửa tay trong SQL Editor: khoá service không có người gọi (auth.uid() rỗng)
        // nên trigger task_truoc_khi_sua cho đổi cột trạng thái thẳng, không đụng dấu vết hay bộ đếm
        // Trả lại. Client của ứng dụng không làm được việc này (không có quyền cột).
        const { data, error } = await service
          .from('task')
          .update({ trang_thai: trangThai })
          .eq('id', taskId)
          .select('id')
        if (error) throw new Error(`Không đặt được trạng thái ${trangThai} cho Task ${taskId}: ${error.message}`)
        if (!data || data.length === 0) throw new Error(`Không có Task nào với mã ${taskId}`)
      },
    }
  }

  return {
    taoBanCai,
    tuyChon: {
      emailMoi,
      maDuAnMoi,
      // Supabase thật đã (hoặc sẽ) có PM của chủ dự án và của các lần chạy trước.
      khoChuaCoPM: false,
      // Giờ do máy chủ đặt; Supabase Auth không phân biệt mã sai, đã dùng hay hết hạn.
      dongHoCuaKho: true,
      gopLoiMaDatLai: true,
      // Task trên Supabase đã có (ticket 10: migration lát 2 và khoSupabaseTask.ts), cùng link GitHub của
      // Task (ticket 17: khoSupabaseGitHub.ts, migration lát 4); các ca Task và link chạy
      // trên Supabase thật khi chủ dự án chạy lệnh riêng, và vẫn "CHƯA KIỂM" trong `npm test`.
      coTask: true,
      // Dựng Task ở trạng thái bất kỳ nhờ khoá service (xem `datTrangThaiTask` ở trên).
      coDatTrangThaiTask: true,
    },
  }
}
