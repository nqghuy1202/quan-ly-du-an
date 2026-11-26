// Luật thuần tìm và lọc Dự án cho bảng "Dự án của tôi" và "Tất cả Dự án": tìm theo tên hoặc Mã Dự án
// (bỏ qua hoa thường và dấu tiếng Việt), lọc theo Mức ưu tiên, Người phụ trách và tình trạng; các tiêu
// chí kết hợp bằng "và". Chạy trên danh sách đã đọc từ Kho dữ liệu. Không I/O, không đọc đồng hồ: cờ
// Quá hạn dự kiến đã được Kho tính sẵn theo ngày hôm nay truyền vào.
import { z } from 'zod'
import { kiemTra, type KiemTra } from './taiKhoan'
import { CAC_MUC_UU_TIEN, type MucUuTien } from './mucUuTien'
import type { TrangThaiDuAn } from './duAn'

/** Ba tình trạng lọc được: đang hoạt động, Lưu trữ, Quá hạn dự kiến (Dự án đang hoạt động đã quá hạn). */
export const CAC_TINH_TRANG_DU_AN = ['HOAT_DONG', 'LUU_TRU', 'QUA_HAN_DU_KIEN'] as const

export type TinhTrangDuAn = (typeof CAC_TINH_TRANG_DU_AN)[number]

export const TEN_TINH_TRANG_DU_AN: Record<TinhTrangDuAn, string> = {
  HOAT_DONG: 'Đang hoạt động',
  LUU_TRU: 'Lưu trữ',
  QUA_HAN_DU_KIEN: 'Quá hạn dự kiến',
}

export const THONG_BAO_TIM_DU_AN = {
  mucUuTienLocSai: 'Mức ưu tiên lọc không hợp lệ.',
  nguoiPhuTrachLocSai: 'Người phụ trách được chọn để lọc không hợp lệ.',
  tinhTrangLocSai: 'Tình trạng lọc không hợp lệ.',
  tuKhoaSai: 'Từ khoá tìm không hợp lệ.',
} as const

/** Bộ tìm và lọc Dự án; `tuKhoa` rỗng hay `null` ở một tiêu chí là không lọc theo tiêu chí đó. */
export interface LocDuAn {
  tuKhoa: string
  mucUuTien: MucUuTien | null
  nguoiPhuTrachId: string | null
  tinhTrang: TinhTrangDuAn | null
}

/** Không tìm, không lọc gì: trả lại đầy đủ. Cũng là bộ lọc khi mới mở "Dự án của tôi". */
export const LOC_DU_AN_TRONG: LocDuAn = { tuKhoa: '', mucUuTien: null, nguoiPhuTrachId: null, tinhTrang: null }

/** Bộ lọc khi mới mở "Tất cả Dự án" (và sau khi tạo Dự án): các Dự án đang hoạt động. */
export const LOC_TAT_CA_DU_AN_BAN_DAU: LocDuAn = { ...LOC_DU_AN_TRONG, tinhTrang: 'HOAT_DONG' }

function trongHoacThuoc(cacGiaTri: readonly string[]) {
  return (giaTri: string) => giaTri.trim() === '' || cacGiaTri.includes(giaTri.trim())
}

/** Dữ liệu bộ tìm và lọc vào từ giao diện; trống, null hay thiếu là không lọc tiêu chí đó. */
export const locDuAnGiaoDienSchema = z.object({
  tuKhoa: z.string({ error: THONG_BAO_TIM_DU_AN.tuKhoaSai }).nullish(),
  mucUuTien: z
    .string({ error: THONG_BAO_TIM_DU_AN.mucUuTienLocSai })
    .refine(trongHoacThuoc(CAC_MUC_UU_TIEN), { error: THONG_BAO_TIM_DU_AN.mucUuTienLocSai })
    .nullish(),
  nguoiPhuTrachId: z.string({ error: THONG_BAO_TIM_DU_AN.nguoiPhuTrachLocSai }).nullish(),
  tinhTrang: z
    .string({ error: THONG_BAO_TIM_DU_AN.tinhTrangLocSai })
    .refine(trongHoacThuoc(CAC_TINH_TRANG_DU_AN), { error: THONG_BAO_TIM_DU_AN.tinhTrangLocSai })
    .nullish(),
})

function chuoiHoacNull(giaTri: string | null | undefined): string | null {
  const daCat = (giaTri ?? '').trim()
  return daCat === '' ? null : daCat
}

/** Kiểm bộ tìm và lọc ở ranh giới (giao diện); trả lỗi theo từng ô bằng tiếng Việt. */
export const kiemTraLocDuAn = {
  loc: (dauVao: unknown): KiemTra<LocDuAn> => {
    const kt = kiemTra(locDuAnGiaoDienSchema, dauVao)
    if (!kt.ok) return kt
    const { tuKhoa, mucUuTien, nguoiPhuTrachId, tinhTrang } = kt.giaTri
    return {
      ok: true,
      giaTri: {
        // Giữ nguyên chữ người dùng gõ (kể cả khoảng trắng) để ô tìm không nhảy; so khớp tự cắt.
        tuKhoa: tuKhoa ?? '',
        // Đã qua refine: chuỗi không rỗng chắc chắn là một Mức ưu tiên, một tình trạng.
        mucUuTien: chuoiHoacNull(mucUuTien) as MucUuTien | null,
        nguoiPhuTrachId: chuoiHoacNull(nguoiPhuTrachId),
        tinhTrang: chuoiHoacNull(tinhTrang) as TinhTrangDuAn | null,
      },
    }
  },
}

/**
 * Chuẩn hoá chữ để tìm: bỏ dấu tiếng Việt (tách dấu bằng NFD rồi bỏ dấu, đổi đ/Đ thành d), chữ thường,
 * cắt khoảng trắng hai đầu và gộp nhiều khoảng trắng liền nhau thành một. "Hà Nội" thành "ha noi".
 */
export function chuanHoaDeTim(chuoi: string): string {
  return chuoi
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Dự án có khớp từ khoá không: từ khoá (đã chuẩn hoá) nằm trong tên hoặc trong Mã Dự án. Từ khoá rỗng luôn khớp. */
export function khopTuKhoa(duAn: { ten: string; ma: string }, tuKhoa: string): boolean {
  const can = chuanHoaDeTim(tuKhoa)
  if (can === '') return true
  return chuanHoaDeTim(duAn.ten).includes(can) || chuanHoaDeTim(duAn.ma).includes(can)
}

/** Phần Dự án mà luật tìm và lọc cần đọc (Dự án kèm số liệu từ Kho dữ liệu có đủ). */
export interface DuAnDeLoc {
  ten: string
  ma: string
  mucUuTien: MucUuTien
  nguoiPhuTrach: { id: string } | null
  trangThai: TrangThaiDuAn
  quaHanDuKien: boolean
}

function khopTinhTrang(duAn: DuAnDeLoc, tinhTrang: TinhTrangDuAn): boolean {
  if (tinhTrang === 'QUA_HAN_DU_KIEN') return duAn.quaHanDuKien
  return duAn.trangThai === tinhTrang
}

/** Có đang tìm hay lọc theo tiêu chí nào không (từ khoá chỉ có khoảng trắng coi như không tìm). */
export function dangLocDuAn(loc: LocDuAn): boolean {
  return (
    chuanHoaDeTim(loc.tuKhoa) !== '' || loc.mucUuTien !== null || loc.nguoiPhuTrachId !== null || loc.tinhTrang !== null
  )
}

/**
 * Tìm và lọc Dự án: một Dự án giữ lại khi khớp mọi tiêu chí đang bật (kết hợp bằng "và"); không bật
 * tiêu chí nào thì giữ nguyên toàn bộ. Giữ nguyên thứ tự đầu vào.
 */
export function locDuAn<T extends DuAnDeLoc>(danhSach: readonly T[], loc: LocDuAn): T[] {
  return danhSach.filter(
    (duAn) =>
      khopTuKhoa(duAn, loc.tuKhoa) &&
      (loc.mucUuTien === null || duAn.mucUuTien === loc.mucUuTien) &&
      (loc.nguoiPhuTrachId === null || duAn.nguoiPhuTrach?.id === loc.nguoiPhuTrachId) &&
      (loc.tinhTrang === null || khopTinhTrang(duAn, loc.tinhTrang)),
  )
}

/** Các Người phụ trách có trên danh sách, không trùng, xếp theo tên (thứ tự tiếng Việt): lựa chọn của ô lọc. */
export function cacNguoiPhuTrach(
  danhSach: readonly { nguoiPhuTrach: { id: string; tenHienThi: string } | null }[],
): { id: string; tenHienThi: string }[] {
  const theoId = new Map<string, string>()
  for (const { nguoiPhuTrach } of danhSach) if (nguoiPhuTrach) theoId.set(nguoiPhuTrach.id, nguoiPhuTrach.tenHienThi)
  return [...theoId.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
    .map(([id, tenHienThi]) => ({ id, tenHienThi }))
}
