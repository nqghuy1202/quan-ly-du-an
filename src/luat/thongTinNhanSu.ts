// Luật thuần về Thông tin nhân sự (Số điện thoại, Chức danh, Phòng ban trong hồ sơ): không I/O.
// Kho dữ liệu (bộ nhớ, Supabase) và giao diện cùng dùng các hàm ở đây.
import { z } from 'zod'
import type { VaiHeThong } from './taiKhoan'

/** Độ dài tối đa của Chức danh và của Phòng ban (sau khi cắt khoảng trắng hai đầu). */
export const DO_DAI_CHUC_DANH_TOI_DA = 60
export const DO_DAI_PHONG_BAN_TOI_DA = 60

export const THONG_BAO_NHAN_SU = {
  soDienThoaiSai:
    'Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0 (vd 0901 234 567), hoặc +84 và 9 chữ số (vd +84901234567).',
  chucDanhQuaDai: `Chức danh tối đa ${DO_DAI_CHUC_DANH_TOI_DA} ký tự.`,
  phongBanQuaDai: `Phòng ban tối đa ${DO_DAI_PHONG_BAN_TOI_DA} ký tự.`,
} as const

/** Ba trường của Thông tin nhân sự; null là trống (chưa nhập, hoặc người gọi không đủ quyền xem). */
export interface ThongTinNhanSu {
  /** Dạng đã chuẩn hoá: `0901234567` hoặc `+84901234567`. */
  soDienThoai: string | null
  chucDanh: string | null
  phongBan: string | null
}

export const THONG_TIN_NHAN_SU_TRONG: ThongTinNhanSu = { soDienThoai: null, chucDanh: null, phongBan: null }

const SO_DIEN_THOAI_HOP_LE = /^(?:0\d{9}|\+84\d{9})$/

/**
 * Chuẩn hoá Số điện thoại: bỏ khoảng trắng, dấu chấm, gạch nối. Trả dạng đã chuẩn hoá nếu hợp lệ
 * (10 chữ số bắt đầu bằng 0, hoặc `+84` theo sau 9 chữ số), chuỗi rỗng nếu chỉ toàn ký tự bỏ được,
 * hoặc null nếu sai dạng.
 */
export function chuanHoaSoDienThoai(giaTri: string): string | null {
  const gon = giaTri.replace(/[\s.-]/g, '')
  if (gon === '') return ''
  return SO_DIEN_THOAI_HOP_LE.test(gon) ? gon : null
}

/** Ô Số điện thoại: để trống nghĩa là xoá (null); sai dạng thì báo lỗi tiếng Việt. */
export const soDienThoaiSchema = z
  .string({ error: THONG_BAO_NHAN_SU.soDienThoaiSai })
  .transform((giaTri, ctx) => {
    const chuan = chuanHoaSoDienThoai(giaTri)
    if (chuan === null) {
      ctx.addIssue({ code: 'custom', message: THONG_BAO_NHAN_SU.soDienThoaiSai })
      return z.NEVER
    }
    return chuan === '' ? null : chuan
  })

/** Ô chữ tự do có giới hạn độ dài: cắt khoảng trắng hai đầu, để trống nghĩa là xoá (null). */
function chuTuDo(toiDa: number, thongBao: string) {
  return z
    .string({ error: thongBao })
    .trim()
    .max(toiDa, { error: thongBao })
    .transform((giaTri) => (giaTri === '' ? null : giaTri))
}

export const chucDanhSchema = chuTuDo(DO_DAI_CHUC_DANH_TOI_DA, THONG_BAO_NHAN_SU.chucDanhQuaDai)
export const phongBanSchema = chuTuDo(DO_DAI_PHONG_BAN_TOI_DA, THONG_BAO_NHAN_SU.phongBanQuaDai)

/**
 * Quyền xem Thông tin nhân sự của tài khoản `chuHoSoId`: người gọi là chính chủ, là PM, là Support,
 * hoặc cùng ít nhất một Dự án (kể cả Dự án đã Lưu trữ) với người đó. Không cấp quyền xem gì khác:
 * lệnh đọc nào không đưa tài khoản đó ra thì vẫn không đưa.
 */
export function duocXemThongTinNhanSu(tinhHuong: {
  nguoiGoiId: string
  vaiNguoiGoi: VaiHeThong
  chuHoSoId: string
  /** Id các Dự án người gọi đang ở trong, mọi trạng thái. */
  duAnCuaNguoiGoi: Iterable<string>
  /** Id các Dự án chủ hồ sơ đang ở trong, mọi trạng thái. */
  duAnCuaChuHoSo: Iterable<string>
}): boolean {
  if (tinhHuong.nguoiGoiId === tinhHuong.chuHoSoId) return true
  if (tinhHuong.vaiNguoiGoi === 'PM' || tinhHuong.vaiNguoiGoi === 'SUPPORT') return true
  const cuaNguoiGoi = new Set(tinhHuong.duAnCuaNguoiGoi)
  for (const duAnId of tinhHuong.duAnCuaChuHoSo) if (cuaNguoiGoi.has(duAnId)) return true
  return false
}

/** Áp quyền xem lên một người: không đủ quyền thì ba trường về trống, các trường khác giữ nguyên. */
export function apQuyenXemNhanSu<T extends ThongTinNhanSu>(nguoi: T, duocXem: boolean): T {
  return duocXem ? { ...nguoi } : { ...nguoi, ...THONG_TIN_NHAN_SU_TRONG }
}
