import type { ReactNode } from 'react'
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
import { PhanTaskTreHan } from './PhanTaskTreHan'

interface Props {
  phien: Phien
  vai: VaiHeThong
  /** Task của Dự án do màn chi tiết Dự án đọc (dải tóm tắt cũng dùng); null là đang tải. */
  tai: KetQua<Task[]> | null
  trangThaiDuAn: TrangThaiDuAn
  /** Người gọi có nằm trong danh sách người trong dự án không; null là chưa biết (đang tải hoặc lỗi). */
  laNguoiTrongDuAn: boolean | null
  /** Đồng hồ: ngày hôm nay (giờ Việt Nam) để tìm Task Trễ hạn. */
  dongHo: () => Date
  /** Lý do không tạo được Task (cùng luật với Kho); null nếu được. */
  lyDoKhongTao: string | null
  /** Đọc lại Task sau khi tải lỗi. */
  onThuLai: () => void
  /** Một Task vừa đổi trạng thái (hoặc vừa đọc lại) trên Kanban. */
  onDaDoi: (task: Task) => void
  onTao: () => void
  onMo: (taskId: string) => void
  onHetPhien: () => void
}

/**
 * Tab "Task" của màn chi tiết Dự án: bảng Kanban kèm bộ lọc và kéo thả đổi trạng thái, nút tạo Task
 * (hoặc lý do không tạo được). Kéo thả cần biết người gọi có nằm trong Dự án không (cùng luật với
 * Kho); chưa biết (đang tải hay lỗi) thì bảng chỉ xem và nói rõ.
 */
export function PhanTaskCuaDuAn({ phien, vai, tai, trangThaiDuAn, laNguoiTrongDuAn, dongHo, lyDoKhongTao, onThuLai, onDaDoi, onTao, onMo, onHetPhien }: Props) {
  const duocTao = lyDoKhongTao === null

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
        endContent={<Button label="Thử lại" variant="secondary" onClick={onThuLai} />}
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
        <BangKanbanTask tasks={tai.giaTri} onMo={onMo} quyen={quyen} onDaDoi={onDaDoi} onHetPhien={onHetPhien} />
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
