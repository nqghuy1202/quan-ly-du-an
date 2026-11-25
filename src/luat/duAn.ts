// Luật thuần về Dự án: kiểm dữ liệu vào, quyền, Lưu trữ, dấu vết và cách hiện ngày giờ.
// Không I/O, không đọc đồng hồ: "bây giờ" luôn do người gọi truyền vào.
// Kho dữ liệu và giao diện cùng dùng các hàm ở đây (giao diện dùng để ẩn nút và giải thích từ chối).
import { z } from 'zod'
import { emailSchema, kiemTra, type VaiHeThong } from './taiKhoan'

/** Hai trạng thái của Dự án, theo thứ tự hiện trên bộ lọc. */
export const CAC_TRANG_THAI_DU_AN = ['HOAT_DONG', 'LUU_TRU'] as const

export type TrangThaiDuAn = (typeof CAC_TRANG_THAI_DU_AN)[number]

export const TEN_TRANG_THAI_DU_AN: Record<TrangThaiDuAn, string> = {
  HOAT_DONG: 'Đang hoạt động',
  LUU_TRU: 'Lưu trữ',
}

export const DO_DAI_TEN_DU_AN_TOI_DA = 120

export const THONG_BAO_DU_AN = {
  tenTrong: 'Tên Dự án không được để trống.',
  tenQuaDai: `Tên Dự án tối đa ${DO_DAI_TEN_DU_AN_TOI_DA} ký tự.`,
  moTaSai: 'Mô tả phải là văn bản.',
  trangThaiSai: 'Trạng thái Dự án phải là Đang hoạt động hoặc Lưu trữ.',
  /** Lý do hiện trên giao diện khi người dùng không phải PM mà muốn tạo Dự án. */
  chiPMTao: 'Chỉ PM tạo được Dự án.',
  /** Lý do hiện trên giao diện khi người dùng không quản lý được Dự án đang xem. */
  khongQuanLy:
    'Chỉ PM hoặc Support của Dự án sửa được Dự án và thêm, gỡ người. Bạn chỉ xem được Dự án này.',
  /** Lý do hiện trên giao diện khi Dự án đã Lưu trữ. */
  daLuuTru: 'Dự án đã Lưu trữ nên chỉ xem được. Mở lại Dự án để sửa.',
  dangHoatDong: 'Dự án đang hoạt động, không cần mở lại.',
} as const

const tenDuAn = z
  .string({ error: THONG_BAO_DU_AN.tenTrong })
  .trim()
  .normalize('NFC')
  .min(1, { error: THONG_BAO_DU_AN.tenTrong })
  .max(DO_DAI_TEN_DU_AN_TOI_DA, { error: THONG_BAO_DU_AN.tenQuaDai })

/** Mô tả tuỳ chọn: bỏ khoảng trắng hai đầu; để trống nghĩa là không có mô tả. */
const moTaDuAn = z.string({ error: THONG_BAO_DU_AN.moTaSai }).trim().normalize('NFC')

/** Tạo Dự án: tên bắt buộc, mô tả tuỳ chọn (thiếu thì là chuỗi rỗng). */
export const taoDuAnSchema = z.object({
  ten: tenDuAn,
  moTa: moTaDuAn.default(''),
})

/** Sửa Dự án: mỗi ô tuỳ chọn; ô không gửi thì giữ nguyên. */
export const suaDuAnSchema = z.object({
  ten: tenDuAn.optional(),
  moTa: moTaDuAn.optional(),
})

/** Bộ lọc danh sách Dự án; không có `trangThai` nghĩa là mọi Dự án. */
export const locDuAnSchema = z.object({
  trangThai: z.enum(CAC_TRANG_THAI_DU_AN, { error: THONG_BAO_DU_AN.trangThaiSai }).optional(),
})

/** Thêm người vào Dự án: email của một tài khoản đã đăng ký (không phân biệt hoa thường). */
export const themNguoiSchema = emailSchema

/** Kiểm dữ liệu Dự án ở ranh giới (biểu mẫu, Kho); trả lỗi theo từng ô bằng tiếng Việt. */
export const kiemTraDuAn = {
  tao: (dauVao: unknown) => kiemTra(taoDuAnSchema, dauVao),
  sua: (dauVao: unknown) => kiemTra(suaDuAnSchema, dauVao),
  loc: (dauVao: unknown) => kiemTra(locDuAnSchema, dauVao),
  themNguoi: (dauVao: unknown) => kiemTra(themNguoiSchema, dauVao),
}

export type ThemNguoiDauVao = z.input<typeof themNguoiSchema>
export type TaoDuAnDauVao = z.input<typeof taoDuAnSchema>
export type SuaDuAnDauVao = z.input<typeof suaDuAnSchema>
/** `trangThai` để kiểu chuỗi: dữ liệu chưa tin được, Kho kiểm bằng `locDuAnSchema`. */
export type LocDuAnDauVao = { trangThai?: string }

/** Người gọi nhìn từ một Dự án: vai hệ thống và có nằm trong danh sách người trong dự án không. */
export interface NguoiGoiDuAn {
  vaiNguoiGoi: VaiHeThong
  laNguoiTrongDuAn: boolean
}

/** Chỉ PM thấy mọi Dự án (mục "Tất cả Dự án"). */
export function duocXemMoiDuAn(vaiNguoiGoi: VaiHeThong): boolean {
  return vaiNguoiGoi === 'PM'
}

/**
 * Quyền xem một Dự án (chi tiết, người trong dự án, có mặt trong danh sách): PM thấy mọi Dự án;
 * Support và Thành viên chỉ thấy Dự án mình ở trong. Không thấy thì Kho trả "không tìm thấy",
 * không lộ rằng Dự án tồn tại.
 */
export function duocXemDuAn(nguoiGoi: NguoiGoiDuAn): boolean {
  return duocXemMoiDuAn(nguoiGoi.vaiNguoiGoi) || nguoiGoi.laNguoiTrongDuAn
}

/**
 * Quyền quản lý một Dự án (sửa tên, mô tả, Lưu trữ, mở lại, thêm và gỡ người): PM ở mọi Dự án;
 * Support chỉ ở Dự án mình nằm trong danh sách ("Support của dự án"); Thành viên thì không.
 */
export function duocQuanLyDuAn(nguoiGoi: NguoiGoiDuAn): boolean {
  if (nguoiGoi.vaiNguoiGoi === 'PM') return true
  return nguoiGoi.vaiNguoiGoi === 'SUPPORT' && nguoiGoi.laNguoiTrongDuAn
}

/** Chỉ PM tạo Dự án. */
export function duocTaoDuAn(vaiNguoiGoi: VaiHeThong): boolean {
  return vaiNguoiGoi === 'PM'
}

export type LyDoKhongGhiDuAn = 'KHONG_CO_QUYEN' | 'DU_AN_DA_LUU_TRU'

/**
 * Có ghi được lên một Dự án không (sửa tên, mô tả, Lưu trữ, thêm và gỡ người); trả lý do từ
 * chối, hoặc null nếu được. Kiểm quyền trước, rồi mới tới trạng thái: Dự án đã Lưu trữ thì mọi
 * lệnh ghi đều bị từ chối.
 */
export function kiemGhiDuAn(tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn }): LyDoKhongGhiDuAn | null {
  if (!duocQuanLyDuAn(tinhHuong)) return 'KHONG_CO_QUYEN'
  if (tinhHuong.trangThai === 'LUU_TRU') return 'DU_AN_DA_LUU_TRU'
  return null
}

export type LyDoKhongMoLaiDuAn = 'KHONG_CO_QUYEN' | 'DU_AN_DANG_HOAT_DONG'

/** Có mở lại được một Dự án không: người quản lý được Dự án, và chỉ Dự án đang Lưu trữ. */
export function kiemMoLaiDuAn(tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn }): LyDoKhongMoLaiDuAn | null {
  if (!duocQuanLyDuAn(tinhHuong)) return 'KHONG_CO_QUYEN'
  if (tinhHuong.trangThai !== 'LUU_TRU') return 'DU_AN_DANG_HOAT_DONG'
  return null
}

/** Lý do (tiếng Việt) để hiện cạnh nút ghi bị ẩn hay vô hiệu; null nếu được ghi. */
export function lyDoKhongSuaDuAn(tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn }): string | null {
  const lyDo = kiemGhiDuAn(tinhHuong)
  if (lyDo === 'KHONG_CO_QUYEN') return THONG_BAO_DU_AN.khongQuanLy
  if (lyDo === 'DU_AN_DA_LUU_TRU') return THONG_BAO_DU_AN.daLuuTru
  return null
}

/** Dấu vết của Dự án hay Task: chỉ lưu lần chỉnh sửa gần nhất. */
export interface DauVet<Nguoi> {
  taoBoi: Nguoi
  taoLuc: Date
  /** null khi chưa chỉnh sửa lần nào. */
  suaBoi: Nguoi | null
  /** null khi chưa chỉnh sửa lần nào. */
  suaLuc: Date | null
}

/** Dấu vết của một bản ghi vừa tạo: chưa có phần chỉnh sửa. */
export function dauVetMoi<Nguoi>(nguoiGoi: Nguoi, bayGio: Date): DauVet<Nguoi> {
  return { taoBoi: nguoiGoi, taoLuc: new Date(bayGio.getTime()), suaBoi: null, suaLuc: null }
}

/** Dấu vết sau một lần chỉnh sửa: người tạo và ngày tạo giữ nguyên. */
export function dauVetSauSua<Nguoi>(dauVet: DauVet<Nguoi>, nguoiGoi: Nguoi, bayGio: Date): DauVet<Nguoi> {
  return { ...dauVet, suaBoi: nguoiGoi, suaLuc: new Date(bayGio.getTime()) }
}

export const MUI_GIO_VIET_NAM = 'Asia/Ho_Chi_Minh'

const dinhDangGioVN = new Intl.DateTimeFormat('en-GB', {
  timeZone: MUI_GIO_VIET_NAM,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Ngày giờ theo múi giờ Việt Nam, dạng "dd/MM/yyyy HH:mm" (không phụ thuộc múi giờ của máy). */
export function dinhDangNgayGio(moc: Date): string {
  const phan: Record<string, string> = {}
  for (const { type, value } of dinhDangGioVN.formatToParts(moc)) phan[type] = value
  return `${phan.day}/${phan.month}/${phan.year} ${phan.hour}:${phan.minute}`
}

/** Xếp Dự án mới tạo trước; tạo cùng lúc thì theo tên (thứ tự tiếng Việt). */
export function xepDuAn<T extends { ten: string; dauVet: { taoLuc: Date } }>(danhSach: readonly T[]): T[] {
  return [...danhSach].sort(
    (a, b) => b.dauVet.taoLuc.getTime() - a.dauVet.taoLuc.getTime() || a.ten.localeCompare(b.ten, 'vi'),
  )
}
