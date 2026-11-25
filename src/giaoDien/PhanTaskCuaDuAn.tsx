import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { Phien, Task } from '../kho/khoDuLieu'
import type { TrangThaiDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { BangKanbanTask } from './BangKanbanTask'
import type { QuyenChuyenKanban } from './chuyenTheKanban'
import { useKho } from './khoContext'
import { PhanTaskTreHan } from './PhanTaskTreHan'

interface Props {
  phien: Phien
  vai: VaiHeThong
  duAnId: string
  trangThaiDuAn: TrangThaiDuAn
  /** Người gọi có nằm trong danh sách người trong dự án không; null là chưa biết (đang tải hoặc lỗi). */
  laNguoiTrongDuAn: boolean | null
  /** Đồng hồ: ngày hôm nay (giờ Việt Nam) để tìm Task Trễ hạn. */
  dongHo: () => Date
  /** Lý do không tạo được Task (cùng luật với Kho); null nếu được. */
  lyDoKhongTao: string | null
  onTao: () => void
  onMo: (taskId: string) => void
  onHetPhien: () => void
}

/**
 * Phần "Task" của màn chi tiết Dự án: bảng Kanban kèm bộ lọc và kéo thả đổi trạng thái, nút tạo Task
 * (hoặc lý do không tạo được). Kéo thả cần biết người gọi có nằm trong Dự án không (cùng luật với
 * Kho); chưa biết (đang tải hay lỗi) thì bảng chỉ xem và nói rõ.
 */
export function PhanTaskCuaDuAn({ phien, vai, duAnId, trangThaiDuAn, laNguoiTrongDuAn, dongHo, lyDoKhongTao, onTao, onMo, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<Task[]> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const duocTao = lyDoKhongTao === null

  useEffect(() => {
    let huy = false
    kho.danhSachTask(phien, duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ lan: lanTai, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, duAnId, lanTai, onHetPhien])

  /** Thay một Task trong bảng đã tải bằng bản mới (vừa đổi trạng thái hoặc vừa đọc lại). */
  function thayTask(moi: Task) {
    setDaTai((cu) =>
      cu && cu.kq.ok
        ? { lan: cu.lan, kq: { ok: true, giaTri: cu.kq.giaTri.map((task) => (task.id === moi.id ? moi : task)) } }
        : cu,
    )
  }

  const quyen: QuyenChuyenKanban | null =
    laNguoiTrongDuAn === null ? null : { phien, vai, trangThaiDuAn, laNguoiTrongDuAn, dongHo }

  let noiDung: ReactNode
  if (tai === null) {
    noiDung = <Spinner label="Đang tải Task…" />
  } else if (!tai.ok) {
    noiDung = (
      <Banner
        status="error"
        title="Không tải được Task của Dự án."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    noiDung = (
      <EmptyState
        headingLevel={4}
        title="Dự án chưa có Task nào."
        description={
          duocTao
            ? 'Bấm "Tạo Task" để giao việc đầu tiên.'
            : 'Khi PM hoặc Support của Dự án tạo Task, Task sẽ hiện ở đây.'
        }
      />
    )
  } else {
    noiDung = (
      <VStack gap={3}>
        {laNguoiTrongDuAn === null && (
          <Text type="supporting">Chưa kiểm xong quyền đổi trạng thái của bạn nên chưa kéo thả được.</Text>
        )}
        <PhanTaskTreHan tasks={tai.giaTri} bayGio={dongHo()} onMo={onMo} />
        <BangKanbanTask tasks={tai.giaTri} onMo={onMo} quyen={quyen} onDaDoi={thayTask} onHetPhien={onHetPhien} />
      </VStack>
    )
  }

  return (
    <VStack gap={3} role="group" aria-label="Task của Dự án">
      <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
        <Heading level={3}>Task</Heading>
        {duocTao && <Button label="Tạo Task" variant="primary" onClick={onTao} />}
      </HStack>
      {lyDoKhongTao !== null && <Text>{lyDoKhongTao}</Text>}
      {noiDung}
    </VStack>
  )
}
