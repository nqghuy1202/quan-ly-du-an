// Luật thuần cho kéo thả trên bảng Kanban (ticket 12): thẻ nào kéo được, thả vào cột nào thì làm gì.
// Không có luật chuyển trạng thái thứ hai: mọi quyết định đi qua `kiemChuyenTrangThai` và
// `cacBuocLamDuoc` của ticket 11, nên kéo thả và bấm nút luôn cho cùng kết luận. Không I/O.
import {
  cacBuocLamDuoc,
  kiemChuyenTrangThai,
  timBuoc,
  type BuocChuyen,
  type TinhHuongChuyen,
} from './chuyenTrangThai'
import { TEN_TRANG_THAI_TASK, laTaskDaChot, type TrangThaiTask } from './task'

/**
 * Thẻ ở trạng thái này có kéo ra khỏi cột được không. Hoàn thành và Huỷ là trạng thái cuối: thẻ
 * nằm yên, kể cả với PM. Các trạng thái khác kéo được; người không có quyền vẫn kéo thử được và
 * nhận lý do từ chối khi thả.
 */
export function theKeoDuoc(trangThai: TrangThaiTask): boolean {
  return !laTaskDaChot(trangThai)
}

/** Kết luận khi thả một thẻ vào một cột. */
export type KetQuaTha =
  /** Thả lại đúng cột cũ: không có gì để làm, không báo lỗi. */
  | { loai: 'GIU_NGUYEN' }
  /** Bước làm được và không cần lý do: gọi lệnh đổi trạng thái ngay. */
  | { loai: 'LAM_NGAY'; buoc: BuocChuyen }
  /** Bước làm được nhưng bắt buộc có lý do: mở hộp nhập lý do trước. */
  | { loai: 'CAN_LY_DO'; buoc: BuocChuyen }
  /** Bước không làm được: thẻ về cột cũ, hiện `thongBao` (cùng câu chữ với lỗi của Kho). */
  | { loai: 'TU_CHOI'; thongBao: string }

/**
 * Thả thẻ có `tinhHuong` vào cột `sang`. Dùng chính `kiemChuyenTrangThai`: lý do chưa nhập không
 * phải là từ chối (hộp nhập lý do sẽ hỏi), mọi từ chối khác giữ nguyên thông báo của luật.
 */
export function danhGiaTha(tinhHuong: TinhHuongChuyen, sang: TrangThaiTask): KetQuaTha {
  if (sang === tinhHuong.trangThaiTask) return { loai: 'GIU_NGUYEN' }
  const kq = kiemChuyenTrangThai(tinhHuong, { sang })
  if (kq.ok) return { loai: 'LAM_NGAY', buoc: kq.buoc }
  if (kq.ma === 'LY_DO_BAT_BUOC') {
    const buoc = timBuoc(tinhHuong.trangThaiTask, sang)
    if (buoc) return { loai: 'CAN_LY_DO', buoc }
  }
  return { loai: 'TU_CHOI', thongBao: kq.thongBao }
}

/** Các cột người gọi thả được thẻ vào ngay bây giờ (để tô cột khi đang kéo và để liệt kê bằng chữ). */
export function cacCotThaDuoc(tinhHuong: TinhHuongChuyen): TrangThaiTask[] {
  return cacBuocLamDuoc(tinhHuong).map((buoc) => buoc.sang)
}

/** Câu nói thẻ nào đang được kéo và thả vào đâu được, để đọc bằng chữ khi kéo. */
export function moTaDangKeo(tieuDe: string, cotThaDuoc: readonly TrangThaiTask[]): string {
  const ten = cotThaDuoc.map((cot) => TEN_TRANG_THAI_TASK[cot])
  if (ten.length === 0) return `Đang kéo "${tieuDe}". Bạn chưa có cột nào để thả.`
  return `Đang kéo "${tieuDe}". Có thể thả vào: ${ten.join(', ')}.`
}
