// Luật thuần về Task: kiểm dữ liệu vào, quyền tạo và xem, luật chọn Người thực hiện và Người kiểm
// tra, cách hiện hạn. Không I/O, không đọc đồng hồ.
// Kho dữ liệu và giao diện cùng dùng các hàm ở đây (giao diện dùng để ẩn nút và giải thích từ chối).
import { z } from 'zod'
import { kiemTra, type KiemTra } from './taiKhoan'
import {
  duocQuanLyDuAn,
  duocXemDuAn,
  kiemGhiDuAn,
  type LyDoKhongGhiDuAn,
  type NguoiGoiDuAn,
  type TrangThaiDuAn,
} from './duAn'

/** Các trạng thái của Task, theo thứ tự cột của bảng Kanban. */
export const CAC_TRANG_THAI_TASK = ['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY'] as const

export type TrangThaiTask = (typeof CAC_TRANG_THAI_TASK)[number]

export const TEN_TRANG_THAI_TASK: Record<TrangThaiTask, string> = {
  MOI: 'Mới',
  DANG_LAM: 'Đang làm',
  CHO_DUYET: 'Chờ duyệt',
  TRA_LAI: 'Trả lại',
  BI_LOI: 'Bị lỗi',
  HOAN_THANH: 'Hoàn thành',
  HUY: 'Huỷ',
}

/** Trạng thái của mọi Task mới tạo. */
export const TRANG_THAI_TASK_BAN_DAU: TrangThaiTask = 'MOI'

export const DO_DAI_TIEU_DE_TASK_TOI_DA = 200

export const THONG_BAO_TASK = {
  tieuDeTrong: 'Tiêu đề Task không được để trống.',
  tieuDeQuaDai: `Tiêu đề Task tối đa ${DO_DAI_TIEU_DE_TASK_TOI_DA} ký tự.`,
  moTaSai: 'Mô tả phải là văn bản.',
  hanSai: 'Hạn phải là một ngày có thật, dạng năm-tháng-ngày (vd. 2026-12-31).',
  nguoiSai: 'Người được chọn không hợp lệ.',
  thieuNguoiThucHien: 'Hãy chọn Người thực hiện.',
  thieuNguoiKiemTra: 'Hãy chọn Người kiểm tra.',
  nguoiNgoaiDuAn: 'Người này không ở trong Dự án.',
  trungNguoi: 'Người kiểm tra phải khác Người thực hiện.',
  /** Lý do hiện trên giao diện khi người dùng không tạo được Task trong Dự án đang xem. */
  khongQuanLy: 'Chỉ PM hoặc Support của Dự án tạo được Task. Bạn chỉ xem được Task của Dự án này.',
  /** Lý do hiện trên giao diện khi Dự án đã Lưu trữ. */
  daLuuTru: 'Dự án đã Lưu trữ nên không tạo được Task mới. Mở lại Dự án để tạo.',
} as const

const NGAY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Chuỗi `YYYY-MM-DD` có phải một ngày có thật trên lịch không (vd. 2026-02-30 thì không). */
export function laNgayHopLe(chuoi: string): boolean {
  const khop = NGAY_ISO.exec(chuoi)
  if (!khop) return false
  const nam = Number(khop[1])
  const thang = Number(khop[2])
  const ngay = Number(khop[3])
  if (thang < 1 || thang > 12 || ngay < 1) return false
  // Ngày cuối tháng: ngày 0 của tháng sau. Tính trên UTC nên không phụ thuộc múi giờ của máy.
  const moc = new Date(0)
  moc.setUTCFullYear(nam, thang, 0)
  return ngay <= moc.getUTCDate()
}

/** Hạn dạng `YYYY-MM-DD` hiện ra thành `dd/MM/yyyy`. Hạn là một ngày, không có giờ. */
export function dinhDangNgay(han: string): string {
  const khop = NGAY_ISO.exec(han)
  if (!khop) return han
  return `${khop[3]}/${khop[2]}/${khop[1]}`
}

const tieuDeTask = z
  .string({ error: THONG_BAO_TASK.tieuDeTrong })
  .trim()
  .normalize('NFC')
  .min(1, { error: THONG_BAO_TASK.tieuDeTrong })
  .max(DO_DAI_TIEU_DE_TASK_TOI_DA, { error: THONG_BAO_TASK.tieuDeQuaDai })

/** Mô tả tuỳ chọn: bỏ khoảng trắng hai đầu; để trống nghĩa là không có mô tả. */
const moTaTask = z.string({ error: THONG_BAO_TASK.moTaSai }).trim().normalize('NFC')

/** Hạn tuỳ chọn: một ngày `YYYY-MM-DD` có thật (ngày đã qua vẫn nhận); trống hay thiếu là không có hạn. */
const hanTask = z
  .union([z.string(), z.null(), z.undefined()], { error: THONG_BAO_TASK.hanSai })
  .transform((giaTri) => (giaTri ?? '').trim())
  .refine((giaTri) => giaTri === '' || laNgayHopLe(giaTri), { error: THONG_BAO_TASK.hanSai })
  .transform((giaTri) => (giaTri === '' ? null : giaTri))

/** Id một người được chọn; trống hay thiếu là chưa chọn (null), Kho trả `THIEU_NGUOI`. */
const idNguoiDuocChon = z
  .union([z.string(), z.null(), z.undefined()], { error: THONG_BAO_TASK.nguoiSai })
  .transform((giaTri) => {
    const id = (giaTri ?? '').trim()
    return id === '' ? null : id
  })

/** Tạo Task: tiêu đề bắt buộc, mô tả và hạn tuỳ chọn, hai người được chọn (kiểm riêng bằng `kiemNguoiTask`). */
export const taoTaskSchema = z.object({
  tieuDe: tieuDeTask,
  moTa: moTaTask.default(''),
  han: hanTask,
  nguoiThucHienId: idNguoiDuocChon,
  nguoiKiemTraId: idNguoiDuocChon,
})

/** Dữ liệu tạo Task đã kiểm: mọi ô đều có mặt, ô trống là chuỗi rỗng (mô tả) hoặc null. */
export interface DuLieuTaoTask {
  tieuDe: string
  moTa: string
  han: string | null
  nguoiThucHienId: string | null
  nguoiKiemTraId: string | null
}

/** Kiểm dữ liệu Task ở ranh giới (biểu mẫu, Kho); trả lỗi theo từng ô bằng tiếng Việt. */
export const kiemTraTask = {
  tao: (dauVao: unknown): KiemTra<DuLieuTaoTask> => {
    const kt = kiemTra(taoTaskSchema, dauVao)
    if (!kt.ok) return kt
    const { tieuDe, moTa, han, nguoiThucHienId, nguoiKiemTraId } = kt.giaTri
    return {
      ok: true,
      giaTri: {
        tieuDe,
        moTa: moTa ?? '',
        han: han ?? null,
        nguoiThucHienId: nguoiThucHienId ?? null,
        nguoiKiemTraId: nguoiKiemTraId ?? null,
      },
    }
  },
}

/** Dữ liệu vào khi tạo Task. `han` là `YYYY-MM-DD`; trống hay null là không có hạn. */
export interface TaoTaskDauVao {
  tieuDe: string
  moTa?: string
  han?: string | null
  nguoiThucHienId?: string | null
  nguoiKiemTraId?: string | null
}

export type LyDoNguoiTask = 'THIEU_NGUOI' | 'NGUOI_NGOAI_DU_AN' | 'TRUNG_NGUOI'

export interface LoiNguoiTask {
  ma: LyDoNguoiTask
  /** Lỗi theo ô `nguoiThucHienId` và/hoặc `nguoiKiemTraId`. */
  loiTheoO: Record<string, string>
}

/**
 * Luật chọn người của một Task: phải có đủ Người thực hiện và Người kiểm tra (`THIEU_NGUOI`), cả
 * hai đang ở trong Dự án (`NGUOI_NGOAI_DU_AN`, kể cả id không tồn tại) và là hai người khác nhau
 * (`TRUNG_NGUOI`). Kiểm theo đúng thứ tự đó; null nếu hợp lệ.
 */
export function kiemNguoiTask(tinhHuong: {
  nguoiThucHienId: string | null
  nguoiKiemTraId: string | null
  laNguoiTrongDuAn: (nguoiDungId: string) => boolean
}): LoiNguoiTask | null {
  const { nguoiThucHienId, nguoiKiemTraId, laNguoiTrongDuAn } = tinhHuong
  if (nguoiThucHienId === null || nguoiKiemTraId === null) {
    const loiTheoO: Record<string, string> = {}
    if (nguoiThucHienId === null) loiTheoO.nguoiThucHienId = THONG_BAO_TASK.thieuNguoiThucHien
    if (nguoiKiemTraId === null) loiTheoO.nguoiKiemTraId = THONG_BAO_TASK.thieuNguoiKiemTra
    return { ma: 'THIEU_NGUOI', loiTheoO }
  }
  const ngoaiThucHien = !laNguoiTrongDuAn(nguoiThucHienId)
  const ngoaiKiemTra = !laNguoiTrongDuAn(nguoiKiemTraId)
  if (ngoaiThucHien || ngoaiKiemTra) {
    const loiTheoO: Record<string, string> = {}
    if (ngoaiThucHien) loiTheoO.nguoiThucHienId = THONG_BAO_TASK.nguoiNgoaiDuAn
    if (ngoaiKiemTra) loiTheoO.nguoiKiemTraId = THONG_BAO_TASK.nguoiNgoaiDuAn
    return { ma: 'NGUOI_NGOAI_DU_AN', loiTheoO }
  }
  if (nguoiThucHienId === nguoiKiemTraId) {
    return { ma: 'TRUNG_NGUOI', loiTheoO: { nguoiKiemTraId: THONG_BAO_TASK.trungNguoi } }
  }
  return null
}

/**
 * Quyền xem Task của một Dự án (danh sách, chi tiết): ai thấy Dự án thì thấy mọi Task của nó.
 * Không thấy thì Kho trả "không tìm thấy", không lộ rằng Task tồn tại.
 */
export function duocXemTask(nguoiGoi: NguoiGoiDuAn): boolean {
  return duocXemDuAn(nguoiGoi)
}

/** Quyền tạo Task: PM ở mọi Dự án, Support của Dự án; Thành viên thì không (kể cả khi sẽ được giao). */
export function duocTaoTask(nguoiGoi: NguoiGoiDuAn): boolean {
  return duocQuanLyDuAn(nguoiGoi)
}

/**
 * Có tạo được Task trong một Dự án không; trả lý do từ chối, hoặc null nếu được. Kiểm quyền trước,
 * rồi mới tới trạng thái: Dự án đã Lưu trữ thì không tạo được.
 */
export function kiemTaoTask(tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn }): LyDoKhongGhiDuAn | null {
  if (!duocTaoTask(tinhHuong)) return 'KHONG_CO_QUYEN'
  return kiemGhiDuAn(tinhHuong)
}

/** Lý do (tiếng Việt) để hiện thay cho nút tạo Task; null nếu được tạo. */
export function lyDoKhongTaoTask(tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn }): string | null {
  const lyDo = kiemTaoTask(tinhHuong)
  if (lyDo === 'KHONG_CO_QUYEN') return THONG_BAO_TASK.khongQuanLy
  if (lyDo === 'DU_AN_DA_LUU_TRU') return THONG_BAO_TASK.daLuuTru
  return null
}

/** Xếp Task mới tạo trước; tạo cùng lúc thì theo tiêu đề (thứ tự tiếng Việt). */
export function xepTask<T extends { tieuDe: string; dauVet: { taoLuc: Date } }>(danhSach: readonly T[]): T[] {
  return [...danhSach].sort(
    (a, b) => b.dauVet.taoLuc.getTime() - a.dauVet.taoLuc.getTime() || a.tieuDe.localeCompare(b.tieuDe, 'vi'),
  )
}
