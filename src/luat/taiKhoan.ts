// Luật thuần về tài khoản và hồ sơ: không I/O, không đọc đồng hồ.
// Kho dữ liệu và giao diện cùng dùng các hàm ở đây.
import { z } from 'zod'
import { chucDanhSchema, phongBanSchema, soDienThoaiSchema } from './thongTinNhanSu'

/** Ba vai hệ thống, theo thứ tự hiện trên giao diện. */
export const CAC_VAI = ['PM', 'SUPPORT', 'THANH_VIEN'] as const

export type VaiHeThong = (typeof CAC_VAI)[number]

export const TEN_VAI: Record<VaiHeThong, string> = {
  PM: 'PM',
  SUPPORT: 'Support',
  THANH_VIEN: 'Thành viên',
}

export const VAI_MAC_DINH: VaiHeThong = 'THANH_VIEN'

export const DO_DAI_MAT_KHAU_TOI_THIEU = 8

export const THONG_BAO = {
  emailSai: 'Email không đúng định dạng.',
  matKhauNgan: `Mật khẩu phải có ít nhất ${DO_DAI_MAT_KHAU_TOI_THIEU} ký tự.`,
  matKhauTrong: 'Hãy nhập mật khẩu.',
  tenTrong: 'Tên hiển thị không được để trống.',
  tenQuaDai: 'Tên hiển thị tối đa 100 ký tự.',
  githubSai:
    'GitHub username chỉ gồm chữ, số và dấu gạch ngang đơn, không bắt đầu hay kết thúc bằng dấu gạch ngang, tối đa 39 ký tự.',
  maTrong: 'Hãy nhập mã đặt lại trong thư.',
  /** Trả cho mọi yêu cầu gửi lại thư xác nhận, dù email có tài khoản hay không. */
  daGuiLaiThuXacNhan:
    'Nếu email này đã đăng ký và chưa xác nhận, một thư xác nhận mới đã được gửi tới hộp thư. Hãy mở thư và bấm đường dẫn trong đó.',
  /** Trả cho mọi lần xác nhận email, dù đã xác nhận rồi hay email không tồn tại. */
  daXacNhanEmail: 'Nếu đường dẫn xác nhận hợp lệ, email đã được xác nhận. Bạn có thể đăng nhập.',
  /** Trả cho mọi yêu cầu đặt lại mật khẩu, dù email có tài khoản hay không. */
  daGuiMaDatLai:
    'Nếu email này có tài khoản, một mã đặt lại mật khẩu đã được gửi tới hộp thư. Hãy nhập mã đó để đặt mật khẩu mới.',
  daDatLaiMatKhau: 'Đã đặt mật khẩu mới. Hãy đăng nhập bằng mật khẩu mới.',
  vaiSai: 'Vai phải là PM, Support hoặc Thành viên.',
} as const

/** Thời hạn mặc định của mã đặt lại mật khẩu: 1 giờ (tính bằng mili giây). */
export const THOI_HAN_MA_DAT_LAI_MAC_DINH_MS = 60 * 60 * 1000

/** Định dạng username của GitHub: 1–39 ký tự chữ/số, gạch ngang đơn, không ở đầu hay cuối. */
const GITHUB_USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

const chuoi = (thongBao: string) => z.string({ error: thongBao })

const email = chuoi(THONG_BAO.emailSai)
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: THONG_BAO.emailSai }))

const tenHienThi = chuoi(THONG_BAO.tenTrong)
  .trim()
  .min(1, { error: THONG_BAO.tenTrong })
  .max(100, { error: THONG_BAO.tenQuaDai })

const githubUsername = chuoi(THONG_BAO.githubSai)
  .trim()
  .refine((giaTri) => giaTri === '' || GITHUB_USERNAME.test(giaTri), { error: THONG_BAO.githubSai })
  .transform((giaTri) => (giaTri === '' ? null : giaTri))

export const dangKySchema = z.object({
  email,
  matKhau: chuoi(THONG_BAO.matKhauNgan).min(DO_DAI_MAT_KHAU_TOI_THIEU, { error: THONG_BAO.matKhauNgan }),
  tenHienThi,
})

export const dangNhapSchema = z.object({
  email: chuoi(THONG_BAO.emailSai).trim().toLowerCase(),
  matKhau: chuoi(THONG_BAO.matKhauTrong),
})

/**
 * Sửa hồ sơ: mỗi ô tuỳ chọn (ô không gửi thì giữ nguyên). GitHub username và ba ô Thông tin nhân sự
 * (Số điện thoại, Chức danh, Phòng ban) để trống nghĩa là xoá; Số điện thoại lưu dạng đã chuẩn hoá.
 */
export const suaHoSoSchema = z.object({
  tenHienThi: tenHienThi.optional(),
  githubUsername: githubUsername.optional(),
  soDienThoai: soDienThoaiSchema.optional(),
  chucDanh: chucDanhSchema.optional(),
  phongBan: phongBanSchema.optional(),
})

/** Gửi lại thư xác nhận và yêu cầu đặt lại mật khẩu: chỉ cần email đúng định dạng. */
export const emailSchema = z.object({ email })

/** Đặt mật khẩu mới bằng mã đặt lại trong thư. */
export const datLaiMatKhauSchema = z.object({
  email,
  ma: chuoi(THONG_BAO.maTrong).trim().min(1, { error: THONG_BAO.maTrong }),
  matKhauMoi: chuoi(THONG_BAO.matKhauNgan).min(DO_DAI_MAT_KHAU_TOI_THIEU, { error: THONG_BAO.matKhauNgan }),
})

/** Đổi vai hệ thống của một tài khoản. */
export const doiVaiSchema = z.object({
  vai: z.enum(CAC_VAI, { error: THONG_BAO.vaiSai }),
})

export type DangKyDauVao = z.input<typeof dangKySchema>
export type DangNhapDauVao = z.input<typeof dangNhapSchema>
export type SuaHoSoDauVao = z.input<typeof suaHoSoSchema>
export type EmailDauVao = z.input<typeof emailSchema>
export type DatLaiMatKhauDauVao = z.input<typeof datLaiMatKhauSchema>
/** `vai` để kiểu chuỗi: dữ liệu từ biểu mẫu chưa tin được, Kho kiểm bằng `doiVaiSchema`. */
export type DoiVaiDauVao = { vai: string }

export type KiemTra<T> = { ok: true; giaTri: T } | { ok: false; loiTheoO: Record<string, string> }

/** Kiểm dữ liệu vào ở ranh giới; trả lỗi theo từng ô bằng tiếng Việt. */
export function kiemTra<S extends z.ZodType>(schema: S, dauVao: unknown): KiemTra<z.output<S>> {
  const ketQua = schema.safeParse(dauVao)
  if (ketQua.success) return { ok: true, giaTri: ketQua.data as z.output<S> }
  const loiTheoO: Record<string, string> = {}
  for (const van of ketQua.error.issues) {
    const o = van.path.length > 0 ? String(van.path[0]) : '_'
    if (!(o in loiTheoO)) loiTheoO[o] = van.message
  }
  return { ok: false, loiTheoO }
}

/** Chuẩn hoá email để so sánh không phân biệt hoa thường. */
export function chuanHoaEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Chỉ chủ hồ sơ được sửa hồ sơ của mình (đổi vai là việc riêng, xem `kiemDoiVai`). */
export function duocSuaHoSo(nguoiGoiId: string, chuHoSoId: string): boolean {
  return nguoiGoiId === chuHoSoId
}

/** Chỉ PM thấy màn Người dùng, liệt kê mọi tài khoản và đổi vai hệ thống. */
export function duocQuanLyNguoiDung(vaiNguoiGoi: VaiHeThong): boolean {
  return vaiNguoiGoi === 'PM'
}

/** Xếp danh sách tài khoản theo tên hiển thị (thứ tự tiếng Việt), trùng tên thì theo email. */
export function xepTheoTen<T extends { tenHienThi: string; email: string }>(danhSach: readonly T[]): T[] {
  return [...danhSach].sort(
    (a, b) => a.tenHienThi.localeCompare(b.tenHienThi, 'vi') || a.email.localeCompare(b.email, 'vi'),
  )
}

export type LyDoKhongDoiVai = 'KHONG_CO_QUYEN' | 'PHAI_CON_PM'

/**
 * Có đổi được vai của một tài khoản không; trả lý do từ chối, hoặc null nếu được.
 * - Người gọi không phải PM: `KHONG_CO_QUYEN` (kể cả khi tự nâng vai mình).
 * - Hạ PM cuối cùng (kể cả PM tự hạ mình): `PHAI_CON_PM`. Hệ thống luôn giữ ít nhất một PM.
 */
export function kiemDoiVai(tinhHuong: {
  vaiNguoiGoi: VaiHeThong
  vaiHienTai: VaiHeThong
  vaiMoi: VaiHeThong
  /** Số tài khoản đang có vai PM, tính cả người bị đổi. */
  soPM: number
}): LyDoKhongDoiVai | null {
  if (!duocQuanLyNguoiDung(tinhHuong.vaiNguoiGoi)) return 'KHONG_CO_QUYEN'
  const haPM = tinhHuong.vaiHienTai === 'PM' && tinhHuong.vaiMoi !== 'PM'
  if (haPM && tinhHuong.soPM <= 1) return 'PHAI_CON_PM'
  return null
}

/** Thời điểm mã đặt lại cấp lúc `capLuc` hết hạn, với thời hạn `thoiHanMs`. */
export function hetHanLuc(capLuc: Date, thoiHanMs: number): Date {
  return new Date(capLuc.getTime() + thoiHanMs)
}

export type TinhTrangMaDatLai = 'HOP_LE' | 'DA_DUNG' | 'HET_HAN'

/**
 * Mã đặt lại còn dùng được không, theo đồng hồ truyền vào. Mã đã dùng thì luôn là `DA_DUNG`;
 * tới đúng thời điểm hết hạn là đã hết hạn.
 */
export function tinhTrangMaDatLai(ma: { daDung: boolean; hetHanLuc: Date }, bayGio: Date): TinhTrangMaDatLai {
  if (ma.daDung) return 'DA_DUNG'
  if (bayGio.getTime() >= ma.hetHanLuc.getTime()) return 'HET_HAN'
  return 'HOP_LE'
}
