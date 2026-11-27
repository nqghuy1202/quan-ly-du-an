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
import { dinhDangNgay, laNgayHopLe } from './ngay'
import { MUC_UU_TIEN_MAC_DINH, mucUuTienSchema, type MucUuTien } from './mucUuTien'

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

// Kiểm và hiện ngày `YYYY-MM-DD` dùng chung với ngày của Dự án; giữ lối xuất cũ từ đây.
export { dinhDangNgay, laNgayHopLe }

const tieuDeTask = z
  .string({ error: THONG_BAO_TASK.tieuDeTrong })
  .trim()
  .normalize('NFC')
  .min(1, { error: THONG_BAO_TASK.tieuDeTrong })
  .max(DO_DAI_TIEU_DE_TASK_TOI_DA, { error: THONG_BAO_TASK.tieuDeQuaDai })

/** Mô tả tuỳ chọn: bỏ khoảng trắng hai đầu; để trống nghĩa là không có mô tả. */
const moTaTask = z.string({ error: THONG_BAO_TASK.moTaSai }).trim().normalize('NFC')

/**
 * Hạn tuỳ chọn: một ngày `YYYY-MM-DD` có thật (ngày đã qua vẫn nhận); trống, null hay thiếu là không
 * có hạn. Chỉ kiểm ở đây (không biến đổi), để ô thiếu vẫn được coi là tuỳ chọn; chuẩn hoá ở `kiemTraTask`.
 */
const hanTask = z
  .string({ error: THONG_BAO_TASK.hanSai })
  .refine((giaTri) => giaTri.trim() === '' || laNgayHopLe(giaTri.trim()), { error: THONG_BAO_TASK.hanSai })
  .nullish()

/** Id một người được chọn; trống, null hay thiếu là chưa chọn, Kho trả `THIEU_NGUOI`. */
const idNguoiDuocChon = z.string({ error: THONG_BAO_TASK.nguoiSai }).nullish()

/** Chuỗi tuỳ chọn sau khi bỏ khoảng trắng; trống là null. */
function chuoiHoacNull(giaTri: string | null | undefined): string | null {
  const daCat = (giaTri ?? '').trim()
  return daCat === '' ? null : daCat
}

/**
 * Tạo Task: tiêu đề bắt buộc, mô tả và hạn tuỳ chọn, Mức ưu tiên tuỳ chọn (không gửi thì Trung bình),
 * hai người được chọn (kiểm riêng bằng `kiemNguoiTask`).
 */
export const taoTaskSchema = z.object({
  tieuDe: tieuDeTask,
  moTa: moTaTask.optional(),
  han: hanTask,
  mucUuTien: mucUuTienSchema.default(MUC_UU_TIEN_MAC_DINH),
  nguoiThucHienId: idNguoiDuocChon,
  nguoiKiemTraId: idNguoiDuocChon,
})

/** Dữ liệu tạo Task đã kiểm: mọi ô đều có mặt, ô trống là chuỗi rỗng (mô tả) hoặc null. */
export interface DuLieuTaoTask {
  tieuDe: string
  moTa: string
  han: string | null
  mucUuTien: MucUuTien
  nguoiThucHienId: string | null
  nguoiKiemTraId: string | null
}

/** Kiểm dữ liệu Task ở ranh giới (biểu mẫu, Kho); trả lỗi theo từng ô bằng tiếng Việt. */
export const kiemTraTask = {
  tao: (dauVao: unknown): KiemTra<DuLieuTaoTask> => {
    const kt = kiemTra(taoTaskSchema, dauVao)
    if (!kt.ok) return kt
    const { tieuDe, moTa, han, mucUuTien, nguoiThucHienId, nguoiKiemTraId } = kt.giaTri
    return {
      ok: true,
      giaTri: {
        tieuDe,
        moTa: moTa ?? '',
        han: chuoiHoacNull(han),
        mucUuTien,
        nguoiThucHienId: chuoiHoacNull(nguoiThucHienId),
        nguoiKiemTraId: chuoiHoacNull(nguoiKiemTraId),
      },
    }
  },
}

/**
 * Dữ liệu vào khi tạo Task. `han` là `YYYY-MM-DD`; trống hay null là không có hạn. Không gửi Mức ưu
 * tiên thì là Trung bình.
 */
export interface TaoTaskDauVao {
  tieuDe: string
  moTa?: string
  han?: string | null
  mucUuTien?: MucUuTien
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

// --- Ticket 08: sửa Task, đổi người, Task chưa chốt của người sắp bị gỡ ---

/** Trạng thái cuối: Hoàn thành và Huỷ. Task đã chốt không sửa, không đổi người được nữa. */
export const CAC_TRANG_THAI_TASK_DA_CHOT: readonly TrangThaiTask[] = ['HOAN_THANH', 'HUY']

/** Task có đang ở trạng thái cuối (Hoàn thành hoặc Huỷ) không. */
export function laTaskDaChot(trangThai: TrangThaiTask): boolean {
  return CAC_TRANG_THAI_TASK_DA_CHOT.includes(trangThai)
}

export const THONG_BAO_SUA_TASK = {
  /** Lý do hiện trên giao diện khi người dùng không sửa được Task. */
  khongQuanLy: 'Chỉ PM hoặc Support của Dự án sửa được Task và đổi người. Bạn chỉ xem được Task này.',
  /** Lý do hiện trên giao diện khi Dự án đã Lưu trữ. */
  daLuuTru: 'Dự án đã Lưu trữ nên Task chỉ xem được. Mở lại Dự án để sửa.',
  /** Lý do hiện trên giao diện khi Task ở trạng thái cuối. */
  daChot: 'Task đã Hoàn thành hoặc Huỷ nên chỉ xem được, không sửa hay đổi người được nữa.',
  /** Dấu hiệu cạnh tên người đã bị gỡ khỏi Dự án mà vẫn được ghi trên Task. */
  daRoiDuAn: 'đã rời dự án',
} as const

/**
 * Sửa Task: mỗi ô tuỳ chọn, ô không gửi thì giữ nguyên; hạn trống hay null là xoá hạn. Đổi Mức ưu tiên
 * cũng đi qua đây, theo đúng quyền sửa Task.
 */
export const suaTaskSchema = z.object({
  tieuDe: tieuDeTask.optional(),
  moTa: moTaTask.optional(),
  han: hanTask,
  mucUuTien: mucUuTienSchema.optional(),
})

/** Đổi người: ô không gửi thì giữ nguyên; ô gửi trống hay null là bỏ người (Kho trả `THIEU_NGUOI`). */
export const doiNguoiTaskSchema = z.object({
  nguoiThucHienId: idNguoiDuocChon,
  nguoiKiemTraId: idNguoiDuocChon,
})

/** Dữ liệu sửa Task đã kiểm: chỉ các ô được gửi. `han: null` là xoá hạn. */
export interface DuLieuSuaTask {
  tieuDe?: string
  moTa?: string
  han?: string | null
  mucUuTien?: MucUuTien
}

/** Dữ liệu đổi người đã kiểm: chỉ các ô được gửi; `null` là ô trống (chưa chọn). */
export interface DuLieuDoiNguoiTask {
  nguoiThucHienId?: string | null
  nguoiKiemTraId?: string | null
}

/** Kiểm dữ liệu sửa Task và đổi người ở ranh giới (biểu mẫu, Kho). */
export const kiemTraSuaTask = {
  sua: (dauVao: unknown): KiemTra<DuLieuSuaTask> => {
    const kt = kiemTra(suaTaskSchema, dauVao)
    if (!kt.ok) return kt
    const { tieuDe, moTa, han, mucUuTien } = kt.giaTri
    const giaTri: DuLieuSuaTask = {}
    if (tieuDe !== undefined) giaTri.tieuDe = tieuDe
    if (moTa !== undefined) giaTri.moTa = moTa
    if (han !== undefined) giaTri.han = chuoiHoacNull(han)
    if (mucUuTien !== undefined) giaTri.mucUuTien = mucUuTien
    return { ok: true, giaTri }
  },
  doiNguoi: (dauVao: unknown): KiemTra<DuLieuDoiNguoiTask> => {
    const kt = kiemTra(doiNguoiTaskSchema, dauVao)
    if (!kt.ok) return kt
    const { nguoiThucHienId, nguoiKiemTraId } = kt.giaTri
    const giaTri: DuLieuDoiNguoiTask = {}
    if (nguoiThucHienId !== undefined) giaTri.nguoiThucHienId = chuoiHoacNull(nguoiThucHienId)
    if (nguoiKiemTraId !== undefined) giaTri.nguoiKiemTraId = chuoiHoacNull(nguoiKiemTraId)
    return { ok: true, giaTri }
  },
}

/**
 * Dữ liệu vào khi sửa Task. Ô không gửi thì giữ nguyên; `han` trống hay null là xoá hạn. Đổi Mức ưu
 * tiên sang mức khác thì Kho ghi một dòng lịch sử; gửi đúng mức đang có thì không ghi.
 */
export interface SuaTaskDauVao {
  tieuDe?: string
  moTa?: string
  han?: string | null
  mucUuTien?: MucUuTien
}

/** Dữ liệu vào khi đổi người của Task. Ô không gửi thì giữ nguyên. */
export interface DoiNguoiTaskDauVao {
  nguoiThucHienId?: string | null
  nguoiKiemTraId?: string | null
}

/**
 * Quyền sửa Task, đổi người và đổi Mức ưu tiên: như quyền tạo Task (PM ở mọi Dự án, Support của Dự án).
 * Người thực hiện, Người kiểm tra có vai Thành viên không sửa được.
 */
export function duocSuaTask(nguoiGoi: NguoiGoiDuAn): boolean {
  return duocQuanLyDuAn(nguoiGoi)
}

export type LyDoKhongSuaTask = LyDoKhongGhiDuAn | 'TASK_DA_CHOT'

/**
 * Có sửa được Task (hoặc đổi người) không; trả lý do từ chối, hoặc null nếu được. Kiểm theo thứ tự:
 * quyền, rồi Dự án đã Lưu trữ, rồi Task đã chốt (Hoàn thành hoặc Huỷ).
 */
export function kiemSuaTask(
  tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn; trangThaiTask: TrangThaiTask },
): LyDoKhongSuaTask | null {
  if (!duocSuaTask(tinhHuong)) return 'KHONG_CO_QUYEN'
  const lyDoDuAn = kiemGhiDuAn(tinhHuong)
  if (lyDoDuAn) return lyDoDuAn
  if (laTaskDaChot(tinhHuong.trangThaiTask)) return 'TASK_DA_CHOT'
  return null
}

/** Lý do (tiếng Việt) để hiện thay cho biểu mẫu sửa Task; null nếu được sửa. */
export function lyDoKhongSuaTask(
  tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn; trangThaiTask: TrangThaiTask },
): string | null {
  const lyDo = kiemSuaTask(tinhHuong)
  if (lyDo === 'KHONG_CO_QUYEN') return THONG_BAO_SUA_TASK.khongQuanLy
  if (lyDo === 'DU_AN_DA_LUU_TRU') return THONG_BAO_SUA_TASK.daLuuTru
  if (lyDo === 'TASK_DA_CHOT') return THONG_BAO_SUA_TASK.daChot
  return null
}

export type KetQuaDoiNguoiTask =
  | { ok: true; nguoiThucHienId: string; nguoiKiemTraId: string }
  | { ok: false; loi: LoiNguoiTask }

/**
 * Luật đổi người của một Task: ghép ô được gửi với người hiện tại rồi áp luật của `kiemNguoiTask`
 * (đủ hai người, cả hai ở trong Dự án, khác nhau). Riêng người hiện tại ở ô không đổi được giữ
 * nguyên dù đã rời Dự án (họ vẫn ghi trên Task cho đến khi được giao lại); chỉ người được chọn mới
 * phải đang ở trong Dự án.
 */
export function kiemDoiNguoiTask(tinhHuong: {
  hienTai: { nguoiThucHienId: string; nguoiKiemTraId: string }
  moi: DuLieuDoiNguoiTask
  laNguoiTrongDuAn: (nguoiDungId: string) => boolean
}): KetQuaDoiNguoiTask {
  const { hienTai, moi, laNguoiTrongDuAn } = tinhHuong
  const ghep = (gui: string | null | undefined, cu: string): string | null => (gui === undefined ? cu : gui)
  const nguoiThucHienId = ghep(moi.nguoiThucHienId, hienTai.nguoiThucHienId)
  const nguoiKiemTraId = ghep(moi.nguoiKiemTraId, hienTai.nguoiKiemTraId)
  const giuNguyen = new Set<string>()
  if (nguoiThucHienId === hienTai.nguoiThucHienId) giuNguyen.add(hienTai.nguoiThucHienId)
  if (nguoiKiemTraId === hienTai.nguoiKiemTraId) giuNguyen.add(hienTai.nguoiKiemTraId)
  const loi = kiemNguoiTask({
    nguoiThucHienId,
    nguoiKiemTraId,
    laNguoiTrongDuAn: (id) => giuNguyen.has(id) || laNguoiTrongDuAn(id),
  })
  if (loi) return { ok: false, loi }
  // kiemNguoiTask đã bảo đảm cả hai id có mặt; kiểm lại để kiểu được thu hẹp.
  if (nguoiThucHienId === null || nguoiKiemTraId === null) {
    return { ok: false, loi: { ma: 'THIEU_NGUOI', loiTheoO: {} } }
  }
  return { ok: true, nguoiThucHienId, nguoiKiemTraId }
}

/**
 * Task chưa chốt (không phải Hoàn thành, không phải Huỷ) mà `nguoiDungId` đang giữ, thực hiện hoặc
 * kiểm tra. Dùng cho danh sách "giao lại trước khi gỡ người khỏi Dự án".
 */
export function taskChuaChotNguoiDangGiu<
  T extends { trangThai: TrangThaiTask; nguoiThucHien: { id: string }; nguoiKiemTra: { id: string } },
>(danhSach: readonly T[], nguoiDungId: string): T[] {
  return danhSach.filter(
    (task) =>
      !laTaskDaChot(task.trangThai) &&
      (task.nguoiThucHien.id === nguoiDungId || task.nguoiKiemTra.id === nguoiDungId),
  )
}

/**
 * Số Task đang giữ của `nguoiDungId` (cột của bảng Người trong dự án): Task chưa Hoàn thành, chưa Huỷ mà
 * người đó là Người thực hiện. Task người đó chỉ là Người kiểm tra không tính. Khác với
 * `taskChuaChotNguoiDangGiu` (danh sách giao lại trước khi gỡ người), vốn tính cả vai Người kiểm tra.
 */
export function soTaskDangGiu(
  danhSach: Iterable<{ trangThai: TrangThaiTask; nguoiThucHienId: string }>,
  nguoiDungId: string,
): number {
  let dem = 0
  for (const task of danhSach) {
    if (task.nguoiThucHienId === nguoiDungId && !laTaskDaChot(task.trangThai)) dem += 1
  }
  return dem
}

/** Người đó giữ Task ở vai nào: dùng để hiện "Người thực hiện" hay "Người kiểm tra" (cả hai không thể trùng). */
export function vaiGiuTask(
  task: { nguoiThucHien: { id: string }; nguoiKiemTra: { id: string } },
  nguoiDungId: string,
): 'NGUOI_THUC_HIEN' | 'NGUOI_KIEM_TRA' | null {
  if (task.nguoiThucHien.id === nguoiDungId) return 'NGUOI_THUC_HIEN'
  if (task.nguoiKiemTra.id === nguoiDungId) return 'NGUOI_KIEM_TRA'
  return null
}
