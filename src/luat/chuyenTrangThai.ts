// Luật thuần về vòng trạng thái của Task (ticket 11): ma trận chuyển, ai được làm bước nào, lý do
// bắt buộc, bộ đếm Trả lại và dòng lịch sử. Không I/O, không đọc đồng hồ: "bây giờ" do người gọi
// truyền vào. Kho dữ liệu (mọi bản cài) và giao diện cùng dùng các hàm ở đây: giao diện dùng để ẩn
// nút và giải thích từ chối, Kho dùng để quyết định chuyển hay từ chối.
import { z } from 'zod'
import { kiemTra, type VaiHeThong } from './taiKhoan'
import type { TrangThaiDuAn } from './duAn'
import { CAC_TRANG_THAI_TASK, TEN_TRANG_THAI_TASK, laTaskDaChot, type TrangThaiTask } from './task'

/** Người gọi đứng ở vai nào trên một Task (một người có thể giữ nhiều vai). */
export type VaiTrenTask = 'NGUOI_THUC_HIEN' | 'NGUOI_KIEM_TRA' | 'SUPPORT' | 'PM'

/** Thứ tự hiện khi liệt kê các vai. */
const THU_TU_VAI: readonly VaiTrenTask[] = ['NGUOI_THUC_HIEN', 'NGUOI_KIEM_TRA', 'SUPPORT', 'PM']

export const TEN_VAI_TREN_TASK: Record<VaiTrenTask, string> = {
  NGUOI_THUC_HIEN: 'Người thực hiện',
  NGUOI_KIEM_TRA: 'Người kiểm tra',
  SUPPORT: 'Support của Dự án',
  PM: 'PM',
}

/** Một bước trong ma trận chuyển trạng thái. */
export interface BuocChuyen {
  tu: TrangThaiTask
  sang: TrangThaiTask
  /** Những vai được làm bước này. */
  nguoiLam: readonly VaiTrenTask[]
  /** Bước bắt buộc có lý do (Trả lại, Bị lỗi, Huỷ). */
  canLyDo: boolean
  /** Chữ trên nút làm bước này. */
  nhan: string
}

const THUC_HIEN_SUPPORT_PM: readonly VaiTrenTask[] = ['NGUOI_THUC_HIEN', 'SUPPORT', 'PM']
const KIEM_TRA_SUPPORT_PM: readonly VaiTrenTask[] = ['NGUOI_KIEM_TRA', 'SUPPORT', 'PM']
const SUPPORT_PM: readonly VaiTrenTask[] = ['SUPPORT', 'PM']

/** Các trạng thái chưa cuối: từ đây Huỷ được. */
const CHUA_CHOT: readonly TrangThaiTask[] = ['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI']

/**
 * Ma trận chuyển trạng thái của spec. Hoàn thành và Huỷ không có dòng nào đi ra: trạng thái cuối.
 * "Support" nghĩa là Support của chính Dự án; PM làm được ở mọi Dự án.
 */
export const MA_TRAN_CHUYEN_TRANG_THAI: readonly BuocChuyen[] = [
  { tu: 'MOI', sang: 'DANG_LAM', nguoiLam: THUC_HIEN_SUPPORT_PM, canLyDo: false, nhan: 'Bắt đầu làm' },
  { tu: 'DANG_LAM', sang: 'CHO_DUYET', nguoiLam: THUC_HIEN_SUPPORT_PM, canLyDo: false, nhan: 'Báo chờ duyệt' },
  { tu: 'CHO_DUYET', sang: 'HOAN_THANH', nguoiLam: KIEM_TRA_SUPPORT_PM, canLyDo: false, nhan: 'Duyệt đạt' },
  { tu: 'CHO_DUYET', sang: 'TRA_LAI', nguoiLam: KIEM_TRA_SUPPORT_PM, canLyDo: true, nhan: 'Trả lại' },
  { tu: 'CHO_DUYET', sang: 'BI_LOI', nguoiLam: KIEM_TRA_SUPPORT_PM, canLyDo: true, nhan: 'Báo Bị lỗi' },
  { tu: 'TRA_LAI', sang: 'DANG_LAM', nguoiLam: THUC_HIEN_SUPPORT_PM, canLyDo: false, nhan: 'Làm lại' },
  { tu: 'BI_LOI', sang: 'DANG_LAM', nguoiLam: SUPPORT_PM, canLyDo: false, nhan: 'Giao lại, làm tiếp' },
  ...CHUA_CHOT.map(
    (tu): BuocChuyen => ({ tu, sang: 'HUY', nguoiLam: SUPPORT_PM, canLyDo: true, nhan: 'Huỷ Task' }),
  ),
]

/** Bước `tu` sang `sang` trong ma trận, hoặc undefined nếu không có. */
export function timBuoc(tu: TrangThaiTask, sang: TrangThaiTask): BuocChuyen | undefined {
  return MA_TRAN_CHUYEN_TRANG_THAI.find((buoc) => buoc.tu === tu && buoc.sang === sang)
}

export const DO_DAI_LY_DO_TOI_DA = 1000

export const THONG_BAO_CHUYEN_TRANG_THAI = {
  lyDoTrong: 'Hãy nhập lý do. Trả lại, báo Bị lỗi và Huỷ Task đều bắt buộc có lý do.',
  lyDoQuaDai: `Lý do tối đa ${DO_DAI_LY_DO_TOI_DA} ký tự.`,
  lyDoSai: 'Lý do phải là văn bản.',
  trangThaiSai: 'Trạng thái muốn chuyển sang không hợp lệ.',
  /** Task đã Hoàn thành hoặc Huỷ. */
  daChot: 'Task đã Hoàn thành hoặc Huỷ nên là kết quả đã chốt, không chuyển trạng thái được nữa.',
  daLuuTru: 'Dự án đã Lưu trữ nên Task chỉ xem được. Mở lại Dự án để chuyển trạng thái.',
  /** Người gọi không giữ vai nào trên Task này. */
  khongCoVai:
    'Chỉ Người thực hiện, Người kiểm tra của Task, Support của Dự án hoặc PM mới đổi được trạng thái Task này.',
} as const

const lyDoChuyen = z
  .string({ error: THONG_BAO_CHUYEN_TRANG_THAI.lyDoSai })
  .trim()
  .normalize('NFC')
  .max(DO_DAI_LY_DO_TOI_DA, { error: THONG_BAO_CHUYEN_TRANG_THAI.lyDoQuaDai })
  .nullish()

/** Đổi trạng thái: trạng thái đích bắt buộc, lý do tuỳ bước (trống, null hay thiếu là không có lý do). */
export const doiTrangThaiSchema = z.object({
  sang: z.enum(CAC_TRANG_THAI_TASK, { error: THONG_BAO_CHUYEN_TRANG_THAI.trangThaiSai }),
  lyDo: lyDoChuyen,
})

/** Dữ liệu vào khi đổi trạng thái Task. `sang` để kiểu chuỗi: dữ liệu chưa tin được, Kho kiểm bằng zod. */
export interface DoiTrangThaiTaskDauVao {
  sang: string
  lyDo?: string | null
}

/** Người gọi và Task nhìn từ luật chuyển trạng thái. */
export interface TinhHuongChuyen {
  vaiNguoiGoi: VaiHeThong
  /** Người gọi có nằm trong danh sách người trong dự án của Dự án chứa Task không. */
  laNguoiTrongDuAn: boolean
  nguoiGoiId: string
  nguoiThucHienId: string
  nguoiKiemTraId: string
  trangThaiDuAn: TrangThaiDuAn
  trangThaiTask: TrangThaiTask
}

/**
 * Các vai người gọi đang giữ trên Task. PM ở mọi Dự án; Support chỉ ở Dự án mình nằm trong;
 * Người thực hiện và Người kiểm tra chỉ khi còn ở trong Dự án (người đã rời Dự án không còn thấy
 * Dự án nên không đổi được trạng thái, cho đến khi được giao lại). Rỗng là không làm được gì.
 */
export function cacVaiTrenTask(
  tinhHuong: Pick<
    TinhHuongChuyen,
    'vaiNguoiGoi' | 'laNguoiTrongDuAn' | 'nguoiGoiId' | 'nguoiThucHienId' | 'nguoiKiemTraId'
  >,
): VaiTrenTask[] {
  const { vaiNguoiGoi, laNguoiTrongDuAn, nguoiGoiId, nguoiThucHienId, nguoiKiemTraId } = tinhHuong
  const vai: VaiTrenTask[] = []
  if (laNguoiTrongDuAn && nguoiGoiId === nguoiThucHienId) vai.push('NGUOI_THUC_HIEN')
  if (laNguoiTrongDuAn && nguoiGoiId === nguoiKiemTraId) vai.push('NGUOI_KIEM_TRA')
  if (vaiNguoiGoi === 'SUPPORT' && laNguoiTrongDuAn) vai.push('SUPPORT')
  if (vaiNguoiGoi === 'PM') vai.push('PM')
  return vai
}

function lietKeVai(vai: readonly VaiTrenTask[]): string {
  const ten = THU_TU_VAI.filter((v) => vai.includes(v)).map((v) => TEN_VAI_TREN_TASK[v])
  if (ten.length <= 1) return ten.join('')
  return `${ten.slice(0, -1).join(', ')} hoặc ${ten[ten.length - 1]}`
}

/** Tên bước để ghi trong thông báo: "Chờ duyệt sang Trả lại". */
function tenBuoc(tu: TrangThaiTask, sang: TrangThaiTask): string {
  return `${TEN_TRANG_THAI_TASK[tu]} sang ${TEN_TRANG_THAI_TASK[sang]}`
}

export type MaLoiChuyen =
  | 'KHONG_CO_QUYEN'
  | 'DU_AN_DA_LUU_TRU'
  | 'TASK_DA_CHOT'
  | 'KHONG_HOP_LE'
  | 'BUOC_KHONG_HOP_LE'
  | 'LY_DO_BAT_BUOC'

export type KetQuaChuyen =
  | {
      ok: true
      buoc: BuocChuyen
      /** Lý do đã cắt khoảng trắng; null khi không có. */
      lyDo: string | null
      /** Bước này làm bộ đếm Trả lại tăng thêm 1. */
      tangTraLai: boolean
    }
  | { ok: false; ma: MaLoiChuyen; thongBao: string; loiTheoO?: Record<string, string> }

function tuChoi(ma: MaLoiChuyen, thongBao: string, loiTheoO?: Record<string, string>): KetQuaChuyen {
  return loiTheoO ? { ok: false, ma, thongBao, loiTheoO } : { ok: false, ma, thongBao }
}

/**
 * Luật đổi trạng thái của một Task: chuyển được hay bị từ chối với mã nào. Kiểm theo thứ tự:
 * 1. người gọi không giữ vai nào trên Task: `KHONG_CO_QUYEN` (không lộ gì thêm);
 * 2. Dự án đã Lưu trữ: `DU_AN_DA_LUU_TRU`;
 * 3. Task đã Hoàn thành hoặc Huỷ: `TASK_DA_CHOT`, với mọi bước;
 * 4. dữ liệu sai (trạng thái đích không có thật, lý do quá dài): `KHONG_HOP_LE`;
 * 5. bước không có trong ma trận (kể cả "chuyển sang chính trạng thái hiện tại"): `BUOC_KHONG_HOP_LE`;
 * 6. bước có trong ma trận nhưng vai của người gọi không được làm: `KHONG_CO_QUYEN`;
 * 7. bước cần lý do mà lý do rỗng hay chỉ khoảng trắng: `LY_DO_BAT_BUOC`.
 */
export function kiemChuyenTrangThai(tinhHuong: TinhHuongChuyen, dauVao: unknown): KetQuaChuyen {
  const vai = cacVaiTrenTask(tinhHuong)
  if (vai.length === 0) return tuChoi('KHONG_CO_QUYEN', THONG_BAO_CHUYEN_TRANG_THAI.khongCoVai)
  if (tinhHuong.trangThaiDuAn === 'LUU_TRU') {
    return tuChoi('DU_AN_DA_LUU_TRU', THONG_BAO_CHUYEN_TRANG_THAI.daLuuTru)
  }
  if (laTaskDaChot(tinhHuong.trangThaiTask)) return tuChoi('TASK_DA_CHOT', THONG_BAO_CHUYEN_TRANG_THAI.daChot)

  const kt = kiemTra(doiTrangThaiSchema, dauVao)
  if (!kt.ok) {
    return tuChoi('KHONG_HOP_LE', 'Dữ liệu chưa hợp lệ. Hãy kiểm tra các ô được đánh dấu.', kt.loiTheoO)
  }
  const { sang } = kt.giaTri
  const lyDo = (kt.giaTri.lyDo ?? '') === '' ? null : (kt.giaTri.lyDo ?? null)

  const buoc = timBuoc(tinhHuong.trangThaiTask, sang)
  if (!buoc) {
    return tuChoi(
      'BUOC_KHONG_HOP_LE',
      `Không có bước chuyển từ ${TEN_TRANG_THAI_TASK[tinhHuong.trangThaiTask]} sang ${TEN_TRANG_THAI_TASK[sang]}.`,
    )
  }
  if (!vai.some((v) => buoc.nguoiLam.includes(v))) {
    return tuChoi(
      'KHONG_CO_QUYEN',
      `Bước ${tenBuoc(buoc.tu, buoc.sang)} chỉ ${lietKeVai(buoc.nguoiLam)} làm được.`,
    )
  }
  if (buoc.canLyDo && lyDo === null) {
    return tuChoi('LY_DO_BAT_BUOC', THONG_BAO_CHUYEN_TRANG_THAI.lyDoTrong, {
      lyDo: THONG_BAO_CHUYEN_TRANG_THAI.lyDoTrong,
    })
  }
  return { ok: true, buoc, lyDo, tangTraLai: buoc.sang === 'TRA_LAI' }
}

/**
 * Các bước người gọi làm được ngay bây giờ, để hiện nút. Rỗng khi Dự án đã Lưu trữ, Task đã chốt
 * hay người gọi không giữ vai nào; mỗi bước ở đây qua được `kiemChuyenTrangThai` (khi có lý do).
 */
export function cacBuocLamDuoc(tinhHuong: TinhHuongChuyen): BuocChuyen[] {
  if (tinhHuong.trangThaiDuAn === 'LUU_TRU' || laTaskDaChot(tinhHuong.trangThaiTask)) return []
  const vai = cacVaiTrenTask(tinhHuong)
  return MA_TRAN_CHUYEN_TRANG_THAI.filter(
    (buoc) => buoc.tu === tinhHuong.trangThaiTask && vai.some((v) => buoc.nguoiLam.includes(v)),
  )
}

/**
 * Lý do (tiếng Việt) để hiện thay cho các nút khi người gọi không có bước nào; null nếu có ít nhất
 * một bước (cho hiện nút).
 */
export function lyDoKhongCoBuoc(tinhHuong: TinhHuongChuyen): string | null {
  if (cacBuocLamDuoc(tinhHuong).length > 0) return null
  if (cacVaiTrenTask(tinhHuong).length === 0) return THONG_BAO_CHUYEN_TRANG_THAI.khongCoVai
  if (tinhHuong.trangThaiDuAn === 'LUU_TRU') return THONG_BAO_CHUYEN_TRANG_THAI.daLuuTru
  if (laTaskDaChot(tinhHuong.trangThaiTask)) return THONG_BAO_CHUYEN_TRANG_THAI.daChot
  const aiLam = new Set<VaiTrenTask>()
  for (const buoc of MA_TRAN_CHUYEN_TRANG_THAI) {
    if (buoc.tu === tinhHuong.trangThaiTask && buoc.sang !== 'HUY') buoc.nguoiLam.forEach((v) => aiLam.add(v))
  }
  return `Task đang ${TEN_TRANG_THAI_TASK[tinhHuong.trangThaiTask]}: bước tiếp theo do ${lietKeVai([...aiLam])} làm. Bạn chưa có bước nào để làm.`
}

/** Bộ đếm Trả lại sau một bước: tăng đúng 1 khi sang Trả lại, các bước khác giữ nguyên. */
export function soLanTraLaiSau(soLanHienTai: number, buoc: BuocChuyen): number {
  return buoc.sang === 'TRA_LAI' ? soLanHienTai + 1 : soLanHienTai
}

/**
 * Một dòng lịch sử trạng thái: ai đổi, lúc nào, từ đâu sang đâu, lý do (null khi bước không cần và
 * người đổi không nhập). `Nguoi` là id (nơi lưu) hoặc người kèm tên hiển thị (khi đọc ra).
 */
export interface DongLichSu<Nguoi> {
  nguoiDoi: Nguoi
  luc: Date
  tu: TrangThaiTask
  sang: TrangThaiTask
  lyDo: string | null
}

/** Dòng lịch sử cho một lần đổi; giờ là bản sao của giờ truyền vào. */
export function dongLichSuMoi<Nguoi>(
  nguoiDoi: Nguoi,
  bayGio: Date,
  buoc: Pick<BuocChuyen, 'tu' | 'sang'>,
  lyDo: string | null,
): DongLichSu<Nguoi> {
  return { nguoiDoi, luc: new Date(bayGio.getTime()), tu: buoc.tu, sang: buoc.sang, lyDo }
}

/** Xếp lịch sử theo thứ tự thời gian tăng dần; cùng lúc thì giữ thứ tự ghi (sắp xếp ổn định). */
export function xepLichSuTask<T extends { luc: Date }>(danhSach: readonly T[]): T[] {
  return [...danhSach].sort((a, b) => a.luc.getTime() - b.luc.getTime())
}
