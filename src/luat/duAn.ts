// Luật thuần về Dự án: kiểm dữ liệu vào, quyền, Lưu trữ, dấu vết và cách hiện ngày giờ.
// Không I/O, không đọc đồng hồ: "bây giờ" luôn do người gọi truyền vào.
// Kho dữ liệu và giao diện cùng dùng các hàm ở đây (giao diện dùng để ẩn nút và giải thích từ chối).
import { z } from 'zod'
import { MUC_UU_TIEN_MAC_DINH, mucUuTienSchema } from './mucUuTien'
import { laNgayHopLe } from './ngay'
import { emailSchema, kiemTra, type VaiHeThong } from './taiKhoan'

/** Hai trạng thái của Dự án, theo thứ tự hiện trên bộ lọc. */
export const CAC_TRANG_THAI_DU_AN = ['HOAT_DONG', 'LUU_TRU'] as const

export type TrangThaiDuAn = (typeof CAC_TRANG_THAI_DU_AN)[number]

export const TEN_TRANG_THAI_DU_AN: Record<TrangThaiDuAn, string> = {
  HOAT_DONG: 'Đang hoạt động',
  LUU_TRU: 'Lưu trữ',
}

export const DO_DAI_TEN_DU_AN_TOI_DA = 120
export const DO_DAI_MA_DU_AN_TOI_THIEU = 2
export const DO_DAI_MA_DU_AN_TOI_DA = 12
export const DO_DAI_KHACH_HANG_TOI_DA = 120
/** Độ dài tối đa của Vai trò trong Dự án (sau khi cắt khoảng trắng hai đầu). */
export const DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA = 60

/** Dạng đúng của Mã Dự án sau khi cắt khoảng trắng: chữ Latin không dấu, chữ số, gạch nối, 2 đến 12 ký tự. */
const DANG_MA_DU_AN = new RegExp(`^[A-Za-z0-9-]{${DO_DAI_MA_DU_AN_TOI_THIEU},${DO_DAI_MA_DU_AN_TOI_DA}}$`)

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
  maTrong: 'Mã Dự án không được để trống.',
  maSai: `Mã Dự án phải dài ${DO_DAI_MA_DU_AN_TOI_THIEU} đến ${DO_DAI_MA_DU_AN_TOI_DA} ký tự, chỉ gồm chữ in hoa không dấu (A-Z), chữ số và gạch nối, ví dụ SDV-012.`,
  maTrung: 'Mã Dự án này đã được dùng cho một Dự án khác (không phân biệt hoa thường). Hãy chọn mã khác.',
  khachHangSai: 'Khách hàng phải là văn bản.',
  khachHangQuaDai: `Khách hàng tối đa ${DO_DAI_KHACH_HANG_TOI_DA} ký tự.`,
  ngayBatDauSai: 'Ngày bắt đầu phải là một ngày có thật, dạng năm-tháng-ngày (vd. 2026-12-31).',
  ngayKetThucSai: 'Ngày kết thúc dự kiến phải là một ngày có thật, dạng năm-tháng-ngày (vd. 2026-12-31).',
  ngayKetThucTruocBatDau: 'Ngày kết thúc dự kiến không được trước Ngày bắt đầu.',
  nguoiPhuTrachSai: 'Người phụ trách phải là một tài khoản, hoặc để trống.',
  nguoiPhuTrachNgoaiDuAn:
    'Người phụ trách phải là người đang ở trong Dự án. Hãy thêm người đó vào Dự án trước, hoặc chọn người khác.',
  vaiTroSai: 'Vai trò trong Dự án phải là văn bản, hoặc để trống.',
  vaiTroQuaDai: `Vai trò trong Dự án tối đa ${DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA} ký tự.`,
  /** Sửa Vai trò trong Dự án của người không (còn) ở trong Dự án. */
  khongTrongDuAn: 'Người này không ở trong Dự án.',
} as const

const tenDuAn = z
  .string({ error: THONG_BAO_DU_AN.tenTrong })
  .trim()
  .normalize('NFC')
  .min(1, { error: THONG_BAO_DU_AN.tenTrong })
  .max(DO_DAI_TEN_DU_AN_TOI_DA, { error: THONG_BAO_DU_AN.tenQuaDai })

/** Mô tả tuỳ chọn: bỏ khoảng trắng hai đầu; để trống nghĩa là không có mô tả. */
const moTaDuAn = z.string({ error: THONG_BAO_DU_AN.moTaSai }).trim().normalize('NFC')

/**
 * Chuẩn hoá Mã Dự án: cắt khoảng trắng hai đầu, đổi sang in hoa. Hai mã trùng nhau khi bản chuẩn hoá
 * bằng nhau (không phân biệt hoa thường).
 */
export function chuanHoaMaDuAn(ma: string): string {
  return ma.trim().toUpperCase()
}

/**
 * Mã Dự án bắt buộc: cắt khoảng trắng, phải đúng dạng (2 đến 12 ký tự gồm chữ Latin không dấu, chữ số,
 * gạch nối), rồi lưu dạng in hoa. Ví dụ `sdv-012` thành `SDV-012`.
 */
const maDuAn = z
  .string({ error: THONG_BAO_DU_AN.maTrong })
  .trim()
  .min(1, { error: THONG_BAO_DU_AN.maTrong })
  .regex(DANG_MA_DU_AN, { error: THONG_BAO_DU_AN.maSai })
  .transform((ma) => ma.toUpperCase())

/** Khách hàng tuỳ chọn, chữ tự do: bỏ khoảng trắng hai đầu; để trống nghĩa là không có. */
const khachHang = z
  .string({ error: THONG_BAO_DU_AN.khachHangSai })
  .trim()
  .normalize('NFC')
  .max(DO_DAI_KHACH_HANG_TOI_DA, { error: THONG_BAO_DU_AN.khachHangQuaDai })

/**
 * Một ngày của Dự án (Ngày bắt đầu, Ngày kết thúc dự kiến), tuỳ chọn: chỉ ngày, không giờ, dạng
 * `YYYY-MM-DD` có thật (ngày đã qua vẫn nhận); trống hay null là không có ngày (ra `null`).
 */
function ngayDuAn(thongBao: string) {
  return z
    .string({ error: thongBao })
    .trim()
    .refine((ngay) => ngay === '' || laNgayHopLe(ngay), { error: thongBao })
    .nullable()
    .transform((ngay) => (ngay === null || ngay === '' ? null : ngay))
}

const ngayBatDau = ngayDuAn(THONG_BAO_DU_AN.ngayBatDauSai)
const ngayKetThucDuKien = ngayDuAn(THONG_BAO_DU_AN.ngayKetThucSai)

/**
 * Người phụ trách gửi lên khi sửa Dự án: id một tài khoản; trống hay null là bỏ Người phụ trách (ra `null`).
 * Có phải Người trong dự án không thì Kho kiểm bằng `kiemNguoiPhuTrach`.
 */
const nguoiPhuTrachId = z
  .string({ error: THONG_BAO_DU_AN.nguoiPhuTrachSai })
  .trim()
  .nullable()
  .transform((id) => (id === null || id === '' ? null : id))

/** Hai ngày của một Dự án; `null` là không có. */
export interface NgayCuaDuAn {
  ngayBatDau: string | null
  ngayKetThucDuKien: string | null
}

/**
 * Luật ngày của Dự án: khi có cả hai, Ngày kết thúc dự kiến không được trước Ngày bắt đầu (bằng nhau
 * thì được; chỉ có một trong hai thì luôn được). Trả lỗi theo ô (ở ô `oLoi`, mặc định ô Ngày kết thúc
 * dự kiến), hoặc null nếu hợp lệ.
 */
export function kiemNgayDuAn(
  ngay: NgayCuaDuAn,
  oLoi: keyof NgayCuaDuAn = 'ngayKetThucDuKien',
): Record<string, string> | null {
  const { ngayBatDau: batDau, ngayKetThucDuKien: ketThuc } = ngay
  // `YYYY-MM-DD` cùng độ dài nên so chuỗi chính là so ngày.
  if (batDau !== null && ketThuc !== null && ketThuc < batDau) {
    return { [oLoi]: THONG_BAO_DU_AN.ngayKetThucTruocBatDau }
  }
  return null
}

/**
 * Tạo Dự án: Mã và tên bắt buộc; mô tả, Khách hàng (thiếu thì là chuỗi rỗng), hai ngày (thiếu thì null)
 * và Mức ưu tiên (thiếu thì Trung bình) tuỳ chọn. Không có Người phụ trách: Dự án mới chưa có Người trong
 * dự án nào để chọn; đặt Người phụ trách khi sửa Dự án.
 */
export const taoDuAnSchema = z
  .object({
    ma: maDuAn,
    ten: tenDuAn,
    moTa: moTaDuAn.default(''),
    khachHang: khachHang.default(''),
    ngayBatDau: ngayBatDau.default(null),
    ngayKetThucDuKien: ngayKetThucDuKien.default(null),
    mucUuTien: mucUuTienSchema.default(MUC_UU_TIEN_MAC_DINH),
  })
  .superRefine((duAn, ctx) => {
    const loi = kiemNgayDuAn(duAn)
    if (loi) ctx.addIssue({ code: 'custom', path: ['ngayKetThucDuKien'], message: loi.ngayKetThucDuKien })
  })

/**
 * Sửa Dự án: mỗi ô tuỳ chọn; ô không gửi thì giữ nguyên; ngày hay Người phụ trách gửi trống hoặc null là
 * xoá. Gửi
 * cả hai ngày thì kiểm luật ngày ở đây; gửi một ngày thì Kho kiểm với ngày đang lưu (`kiemNgayDuAn`).
 */
export const suaDuAnSchema = z
  .object({
    ma: maDuAn.optional(),
    ten: tenDuAn.optional(),
    moTa: moTaDuAn.optional(),
    khachHang: khachHang.optional(),
    ngayBatDau: ngayBatDau.optional(),
    ngayKetThucDuKien: ngayKetThucDuKien.optional(),
    mucUuTien: mucUuTienSchema.optional(),
    nguoiPhuTrachId: nguoiPhuTrachId.optional(),
  })
  .superRefine((duAn, ctx) => {
    if (duAn.ngayBatDau === undefined || duAn.ngayKetThucDuKien === undefined) return
    const loi = kiemNgayDuAn({ ngayBatDau: duAn.ngayBatDau, ngayKetThucDuKien: duAn.ngayKetThucDuKien })
    if (loi) ctx.addIssue({ code: 'custom', path: ['ngayKetThucDuKien'], message: loi.ngayKetThucDuKien })
  })

/**
 * Hai ngày của Dự án sau khi sửa: ngày được gửi thay ngày đang lưu, ngày không gửi giữ nguyên; rồi
 * kiểm luật ngày. Lỗi nằm ở ô vừa gửi (chỉ gửi Ngày bắt đầu thì lỗi ở ô đó). Trả hai ngày mới, hoặc lỗi theo ô.
 */
export function ngayDuAnSauSua(
  dangLuu: NgayCuaDuAn,
  thayDoi: { ngayBatDau?: string | null; ngayKetThucDuKien?: string | null },
): { ok: true; ngay: NgayCuaDuAn } | { ok: false; loiTheoO: Record<string, string> } {
  const ngay: NgayCuaDuAn = {
    ngayBatDau: thayDoi.ngayBatDau !== undefined ? thayDoi.ngayBatDau : dangLuu.ngayBatDau,
    ngayKetThucDuKien: thayDoi.ngayKetThucDuKien !== undefined ? thayDoi.ngayKetThucDuKien : dangLuu.ngayKetThucDuKien,
  }
  const chiGuiBatDau = thayDoi.ngayBatDau !== undefined && thayDoi.ngayKetThucDuKien === undefined
  const loi = kiemNgayDuAn(ngay, chiGuiBatDau ? 'ngayBatDau' : 'ngayKetThucDuKien')
  return loi ? { ok: false, loiTheoO: loi } : { ok: true, ngay }
}

/**
 * Luật Người phụ trách: trống (null) luôn được; có người thì người đó phải đang là Người trong dự án
 * (`laNguoiTrongDuAn`). Trả lỗi theo ô `nguoiPhuTrachId`, hoặc null nếu hợp lệ. Người phụ trách chỉ để
 * hiển thị và lọc: không hàm quyền nào ở đây đọc tới nó, nên không cấp thêm quyền gì.
 */
export function kiemNguoiPhuTrach(
  nguoiPhuTrachId: string | null,
  laNguoiTrongDuAn: (id: string) => boolean,
): Record<string, string> | null {
  if (nguoiPhuTrachId === null || laNguoiTrongDuAn(nguoiPhuTrachId)) return null
  return { nguoiPhuTrachId: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn }
}

/**
 * Hai phạm vi của danh sách Dự án kèm số liệu: Dự án người gọi đang ở trong ("Dự án của tôi"), hoặc mọi
 * Dự án người gọi được thấy ("Tất cả Dự án").
 */
export const CAC_PHAM_VI_DANH_SACH_DU_AN = ['CUA_TOI', 'TAT_CA'] as const

/** Giá trị (chưa tin được) có phải một phạm vi danh sách Dự án không. */
export function laPhamViDanhSachDuAn(giaTri: unknown): giaTri is (typeof CAC_PHAM_VI_DANH_SACH_DU_AN)[number] {
  return typeof giaTri === 'string' && (CAC_PHAM_VI_DANH_SACH_DU_AN as readonly string[]).includes(giaTri)
}

/** Bộ lọc danh sách Dự án; không có `trangThai` nghĩa là mọi Dự án. */
export const locDuAnSchema = z.object({
  trangThai: z.enum(CAC_TRANG_THAI_DU_AN, { error: THONG_BAO_DU_AN.trangThaiSai }).optional(),
})

/**
 * Vai trò trong Dự án: chữ tự do, tuỳ chọn (vd "Trưởng nhóm"); cắt khoảng trắng hai đầu, tối đa 60 ký tự;
 * trống, chỉ khoảng trắng hay null là không có (ra `null`). Không đổi quyền nào: không hàm quyền nào ở đây
 * đọc tới nó.
 */
export const vaiTroTrongDuAnSchema = z
  .string({ error: THONG_BAO_DU_AN.vaiTroSai })
  .trim()
  .normalize('NFC')
  .max(DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA, { error: THONG_BAO_DU_AN.vaiTroQuaDai })
  .nullable()
  .transform((vaiTro) => (vaiTro === null || vaiTro === '' ? null : vaiTro))

/**
 * Thêm người vào Dự án: email của một tài khoản đã đăng ký (không phân biệt hoa thường), kèm Vai trò trong
 * Dự án tuỳ chọn (không gửi thì không có).
 */
export const themNguoiSchema = emailSchema.extend({
  vaiTroTrongDuAn: vaiTroTrongDuAnSchema.default(null),
})

/** Sửa Vai trò trong Dự án của một Người trong dự án; gửi trống là xoá vai trò. */
export const suaVaiTroTrongDuAnSchema = z.object({
  vaiTroTrongDuAn: vaiTroTrongDuAnSchema,
})

/** Kiểm dữ liệu Dự án ở ranh giới (biểu mẫu, Kho); trả lỗi theo từng ô bằng tiếng Việt. */
export const kiemTraDuAn = {
  tao: (dauVao: unknown) => kiemTra(taoDuAnSchema, dauVao),
  sua: (dauVao: unknown) => kiemTra(suaDuAnSchema, dauVao),
  loc: (dauVao: unknown) => kiemTra(locDuAnSchema, dauVao),
  themNguoi: (dauVao: unknown) => kiemTra(themNguoiSchema, dauVao),
  suaVaiTro: (dauVao: unknown) => kiemTra(suaVaiTroTrongDuAnSchema, dauVao),
}

export type ThemNguoiDauVao = z.input<typeof themNguoiSchema>
export type SuaVaiTroTrongDuAnDauVao = z.input<typeof suaVaiTroTrongDuAnSchema>
export type TaoDuAnDauVao = z.input<typeof taoDuAnSchema>
export type SuaDuAnDauVao = z.input<typeof suaDuAnSchema>
/** `trangThai` để kiểu chuỗi: dữ liệu chưa tin được, Kho kiểm bằng `locDuAnSchema`. */
export type LocDuAnDauVao = { trangThai?: string }

/**
 * Mã `ma` (đã chuẩn hoá hay chưa) có trùng Mã của một Dự án khác không, không phân biệt hoa thường.
 * `boQuaId` là Dự án đang sửa: đặt lại đúng Mã của chính nó không bị coi là trùng.
 */
export function maDuAnBiTrung(
  ma: string,
  cacDuAn: Iterable<{ id: string; ma: string }>,
  boQuaId: string | null = null,
): boolean {
  const khoa = chuanHoaMaDuAn(ma)
  for (const duAn of cacDuAn) {
    if (duAn.id !== boQuaId && chuanHoaMaDuAn(duAn.ma) === khoa) return true
  }
  return false
}

/** Tên Dự án kèm Mã đứng trước, dạng "SDV-012 · Cửa hàng"; chưa có Mã thì chỉ tên. */
export function tenKemMa(duAn: { ma: string; ten: string }): string {
  return duAn.ma === '' ? duAn.ten : `${duAn.ma} · ${duAn.ten}`
}

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

/**
 * Dấu "chưa có Người phụ trách" trên Dự án ở Tổng quan chỉ hiện cho PM và Support (vai hệ thống), là
 * những người đặt Người phụ trách; Thành viên không thấy. Chỉ là hiển thị, không đổi quyền nào.
 */
export function duocThayDauChuaCoNguoiPhuTrach(vaiNguoiGoi: VaiHeThong): boolean {
  return vaiNguoiGoi === 'PM' || vaiNguoiGoi === 'SUPPORT'
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

/**
 * Có sửa được Vai trò trong Dự án (của bất kỳ Người trong dự án nào) không: đúng như quyền ghi Dự án
 * (`kiemGhiDuAn`): PM ở mọi Dự án, Support của Dự án; Thành viên và Support ngoài Dự án nhận
 * `KHONG_CO_QUYEN`; Dự án đã Lưu trữ nhận `DU_AN_DA_LUU_TRU`. Có Vai trò trong Dự án gì cũng không đổi
 * kết quả này: vai trò không kéo theo quyền.
 */
export function kiemSuaVaiTroTrongDuAn(
  tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn },
): LyDoKhongGhiDuAn | null {
  return kiemGhiDuAn(tinhHuong)
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
