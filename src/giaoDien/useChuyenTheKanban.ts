import { useRef, useState } from 'react'
import type { LoiKho, MaLoi } from '../kho/ketQua'
import type { Task } from '../kho/khoDuLieu'
import { danhGiaTha } from '../luat/keoThaKanban'
import type { BuocChuyen } from '../luat/chuyenTrangThai'
import { TEN_TRANG_THAI_TASK, type TrangThaiTask } from '../luat/task'
import { guiDoiTrangThai, tinhHuongCua, type QuyenChuyenKanban } from './chuyenTheKanban'
import { useKho } from './khoContext'

export type ThongBaoKanban = { loai: 'thanhCong'; noiDung: string } | { loai: 'loi'; noiDung: string }

/** Lỗi cho thấy Task, Dự án hay quyền đã đổi ở nơi khác: đọc lại Task cho khớp với Kho. */
const LOI_CAN_DOC_LAI: readonly MaLoi[] = ['DU_AN_DA_LUU_TRU', 'KHONG_CO_QUYEN', 'KHONG_TIM_THAY', 'TASK_DA_CHOT', 'BUOC_KHONG_HOP_LE']

interface DauVao {
  quyen: QuyenChuyenKanban | null
  /** Task đã đổi (hoặc đã đọc lại cho khớp Kho): bảng cập nhật thẻ tại chỗ. */
  onDaDoi: (task: Task) => void
  onHetPhien: () => void
}

/**
 * Đường đổi cột của bảng Kanban, dùng chung cho kéo thả và cho menu bàn phím: cùng một hàm `tha`.
 * Quyết định (được, cần lý do, từ chối) lấy từ luật thuần `danhGiaTha`; việc đổi đi qua đúng lệnh
 * Kho `doiTrangThaiTask` như nút ở chi tiết Task. Thẻ không bao giờ nhảy cột trước khi Kho xác
 * nhận, nên bị từ chối thì thẻ vẫn ở cột cũ.
 */
export function useChuyenTheKanban({ quyen, onDaDoi, onHetPhien }: DauVao) {
  const kho = useKho()
  const [thongBao, setThongBao] = useState<ThongBaoKanban | null>(null)
  const [hop, setHop] = useState<{ task: Task; buoc: BuocChuyen } | null>(null)
  const [dangGui, setDangGui] = useState(false)
  const [loiHop, setLoiHop] = useState<LoiKho | null>(null)
  // Chặn lệnh trùng (thả hai lần trước khi kịp vẽ lại) bằng ref chứ không bằng state.
  const dangGuiRef = useRef(false)

  async function thucHien(task: Task, buoc: BuocChuyen, lyDo: string | null) {
    if (quyen === null || dangGuiRef.current) return
    dangGuiRef.current = true
    setDangGui(true)
    setLoiHop(null)
    const kq = await guiDoiTrangThai(kho, quyen, task, buoc, lyDo)
    dangGuiRef.current = false
    setDangGui(false)
    if (kq.ok) {
      setHop(null)
      setThongBao({
        loai: 'thanhCong',
        noiDung: `Đã chuyển Task "${kq.giaTri.tieuDe}" sang ${TEN_TRANG_THAI_TASK[kq.giaTri.trangThai]}.`,
      })
      onDaDoi(kq.giaTri)
      return
    }
    if (kq.loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
      return
    }
    setLoiHop(kq.loi)
    setThongBao({ loai: 'loi', noiDung: kq.loi.thongBao })
    if (LOI_CAN_DOC_LAI.includes(kq.loi.ma)) {
      void kho.layTask(quyen.phien, task.id).then((moi) => {
        if (moi.ok) onDaDoi(moi.giaTri)
      })
    }
  }

  /** Thả `task` vào cột `sang` (hoặc chọn cột đó từ menu): đánh giá bằng luật thuần rồi làm theo. */
  function tha(task: Task, sang: TrangThaiTask) {
    if (quyen === null || dangGuiRef.current) return
    const kq = danhGiaTha(tinhHuongCua(quyen, task), sang)
    switch (kq.loai) {
      case 'GIU_NGUYEN':
        setThongBao(null)
        return
      case 'TU_CHOI':
        setThongBao({ loai: 'loi', noiDung: kq.thongBao })
        return
      case 'CAN_LY_DO':
        setThongBao(null)
        setLoiHop(null)
        setHop({ task, buoc: kq.buoc })
        return
      case 'LAM_NGAY':
        setThongBao(null)
        void thucHien(task, kq.buoc, null)
    }
  }

  function guiLyDo(lyDo: string) {
    if (hop) void thucHien(hop.task, hop.buoc, lyDo)
  }

  /** Đóng hộp lý do mà không đổi gì (không đóng được khi đang gửi). */
  function dongHop() {
    if (dangGuiRef.current) return
    setHop(null)
    setLoiHop(null)
  }

  return { thongBao, xoaThongBao: () => setThongBao(null), hop, dangGui, loiHop, tha, guiLyDo, dongHop }
}
