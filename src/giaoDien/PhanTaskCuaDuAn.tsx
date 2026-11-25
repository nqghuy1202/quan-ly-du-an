import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { Phien, Task } from '../kho/khoDuLieu'
import { dinhDangNgayGio } from '../luat/duAn'
import { TEN_TRANG_THAI_TASK, dinhDangNgay, xepTask, type TrangThaiTask } from '../luat/task'
import { useKho } from './khoContext'
import { MAU_TRANG_THAI_TASK } from './mauTrangThaiTask'

interface Props {
  phien: Phien
  duAnId: string
  /** Lý do không tạo được Task (cùng luật với Kho); null nếu được. */
  lyDoKhongTao: string | null
  onTao: () => void
  onMo: (taskId: string) => void
  onHetPhien: () => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = {
  id: string
  tieuDe: string
  trangThai: TrangThaiTask
  nguoiThucHien: string
  nguoiKiemTra: string
  han: string
  taoBoi: string
}

function thanhDong(task: Task): Dong {
  return {
    id: task.id,
    tieuDe: task.tieuDe,
    trangThai: task.trangThai,
    nguoiThucHien: task.nguoiThucHien.tenHienThi,
    nguoiKiemTra: task.nguoiKiemTra.tenHienThi,
    han: task.han === null ? 'Không có hạn' : dinhDangNgay(task.han),
    taoBoi: `${task.dauVet.taoBoi.tenHienThi}, ${dinhDangNgayGio(task.dauVet.taoLuc)}`,
  }
}

/** Phần "Task" của màn chi tiết Dự án: bảng Task đơn giản, nút tạo Task (hoặc lý do không tạo được). */
export function PhanTaskCuaDuAn({ phien, duAnId, lyDoKhongTao, onTao, onMo, onHetPhien }: Props) {
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

  const cot: TableColumn<Dong>[] = [
    {
      key: 'tieuDe',
      header: 'Tiêu đề',
      width: proportional(2),
      renderCell: (dong) => <Button label={dong.tieuDe} variant="ghost" onClick={() => onMo(dong.id)} />,
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      width: proportional(1),
      renderCell: (dong) => (
        <Token label={TEN_TRANG_THAI_TASK[dong.trangThai]} color={MAU_TRANG_THAI_TASK[dong.trangThai]} />
      ),
    },
    {
      key: 'nguoiThucHien',
      header: 'Người thực hiện',
      width: proportional(1),
      renderCell: (dong) => <Text>{dong.nguoiThucHien}</Text>,
    },
    {
      key: 'nguoiKiemTra',
      header: 'Người kiểm tra',
      width: proportional(1),
      renderCell: (dong) => <Text>{dong.nguoiKiemTra}</Text>,
    },
    { key: 'han', header: 'Hạn', width: proportional(1), renderCell: (dong) => <Text>{dong.han}</Text> },
    { key: 'taoBoi', header: 'Người tạo, ngày tạo', width: proportional(1), renderCell: (dong) => <Text>{dong.taoBoi}</Text> },
  ]

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
      <Table aria-label="Danh sách Task" data={xepTask(tai.giaTri).map(thanhDong)} columns={cot} idKey="id" />
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
