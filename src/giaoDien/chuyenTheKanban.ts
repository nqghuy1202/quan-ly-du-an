import type { KetQua } from '../kho/ketQua'
import type { KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import type { BuocChuyen, TinhHuongChuyen } from '../luat/chuyenTrangThai'
import type { TrangThaiDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'

/** Người gọi và Dự án nhìn từ bảng Kanban: đủ để dựng tình huống chuyển trạng thái cho từng thẻ. */
export interface QuyenChuyenKanban {
  phien: Phien
  vai: VaiHeThong
  trangThaiDuAn: TrangThaiDuAn
  /** Người gọi có nằm trong danh sách người trong dự án của Dự án không. */
  laNguoiTrongDuAn: boolean
  dongHo: () => Date
}

/** Tình huống chuyển trạng thái của một thẻ, dựng từ người gọi và Task (cho luật thuần của ticket 11). */
export function tinhHuongCua(quyen: QuyenChuyenKanban, task: Task): TinhHuongChuyen {
  return {
    vaiNguoiGoi: quyen.vai,
    laNguoiTrongDuAn: quyen.laNguoiTrongDuAn,
    nguoiGoiId: quyen.phien.nguoiDungId,
    nguoiThucHienId: task.nguoiThucHien.id,
    nguoiKiemTraId: task.nguoiKiemTra.id,
    trangThaiDuAn: quyen.trangThaiDuAn,
    trangThaiTask: task.trangThai,
  }
}

/**
 * Gửi lệnh đổi trạng thái của một bước tới Kho: đúng lệnh `doiTrangThaiTask` mà nút ở chi tiết Task
 * gọi, với cùng dữ liệu vào (`lyDo` null thì không gửi lý do). Kéo thả và menu đều đi qua đây.
 */
export function guiDoiTrangThai(
  kho: KhoDuLieu,
  quyen: QuyenChuyenKanban,
  task: Task,
  buoc: BuocChuyen,
  lyDo: string | null,
): Promise<KetQua<Task>> {
  return kho.doiTrangThaiTask(
    quyen.phien,
    task.id,
    lyDo === null ? { sang: buoc.sang } : { sang: buoc.sang, lyDo },
    quyen.dongHo(),
  )
}
