import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { Task } from '../kho/khoDuLieu'
import { TEN_TRANG_THAI_TASK, dinhDangNgay, type TrangThaiTask } from '../luat/task'
import { taskTreHan, xepTaskTreHan } from '../luat/tienDo'
import { MAU_TRANG_THAI_TASK } from './mauTrangThaiTask'

interface Props {
  tasks: readonly Task[]
  /** Thời điểm "bây giờ" (đồng hồ truyền vào); ngày hôm nay lấy theo giờ Việt Nam từ đây. */
  bayGio: Date
  onMo: (taskId: string) => void
}

type Dong = {
  id: string
  tieuDe: string
  trangThai: TrangThaiTask
  nguoiThucHien: string
  han: string
}

/** Danh sách Task Trễ hạn của một Dự án (hạn cũ nhất trước); không có Task nào trễ thì không hiện gì. */
export function PhanTaskTreHan({ tasks, bayGio, onMo }: Props) {
  const treHan = xepTaskTreHan(taskTreHan(tasks, bayGio))
  if (treHan.length === 0) return null

  const dong: Dong[] = treHan.map((task) => ({
    id: task.id,
    tieuDe: task.tieuDe,
    trangThai: task.trangThai,
    nguoiThucHien: task.nguoiThucHien.tenHienThi,
    han: task.han === null ? '' : dinhDangNgay(task.han),
  }))
  const cot: TableColumn<Dong>[] = [
    {
      key: 'tieuDe',
      header: 'Task',
      width: proportional(2),
      renderCell: (d) => <Button label={d.tieuDe} variant="ghost" onClick={() => onMo(d.id)} />,
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      width: proportional(1),
      renderCell: (d) => <Token label={TEN_TRANG_THAI_TASK[d.trangThai]} color={MAU_TRANG_THAI_TASK[d.trangThai]} />,
    },
    {
      key: 'nguoiThucHien',
      header: 'Người thực hiện',
      width: proportional(1),
      renderCell: (d) => <Text>{d.nguoiThucHien}</Text>,
    },
    { key: 'han', header: 'Hạn', width: proportional(1), renderCell: (d) => <Text>{d.han}</Text> },
  ]

  return (
    <VStack gap={2} role="group" aria-label="Task Trễ hạn">
      <Heading level={3}>Task Trễ hạn ({treHan.length})</Heading>
      <Text>Hạn đã qua mà chưa Hoàn thành và chưa Huỷ. Task đang Chờ duyệt vẫn tính là chưa xong.</Text>
      <Table aria-label="Danh sách Task Trễ hạn" data={dong} columns={cot} idKey="id" />
    </VStack>
  )
}
