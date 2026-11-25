// Luật thuần về tài khoản và hồ sơ: không I/O, không đọc đồng hồ.
// Kho dữ liệu và giao diện cùng dùng các hàm ở đây.
import { z } from 'zod'

export type VaiHeThong = 'PM' | 'SUPPORT' | 'THANH_VIEN'

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
} as const

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

/** Sửa hồ sơ: mỗi ô tuỳ chọn; GitHub username để trống nghĩa là xoá. */
export const suaHoSoSchema = z.object({
  tenHienThi: tenHienThi.optional(),
  githubUsername: githubUsername.optional(),
})

export type DangKyDauVao = z.input<typeof dangKySchema>
export type DangNhapDauVao = z.input<typeof dangNhapSchema>
export type SuaHoSoDauVao = z.input<typeof suaHoSoSchema>

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

/** Chỉ chủ hồ sơ được sửa hồ sơ của mình (đổi vai là việc khác, ở ticket 03). */
export function duocSuaHoSo(nguoiGoiId: string, chuHoSoId: string): boolean {
  return nguoiGoiId === chuHoSoId
}
