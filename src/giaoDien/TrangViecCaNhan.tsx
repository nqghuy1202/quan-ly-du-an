import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { Phien, TaskKemDuAn } from '../kho/khoDuLieu'
import { xepViecCaNhan } from '../luat/kanban'
import { TEN_TRANG_THAI_TASK, dinhDangNgay, type TrangThaiTask } from '../luat/task'
import { useKho } from './khoContext'
import { ManChiTietTask } from './ManChiTietTask'
import { MAU_TRANG_THAI_TASK } from './mauTrangThaiTask'

/** Hai danh sách cá nhân qua mọi Dự án. */
export type LoaiViecCaNhan = 'viecCuaToi' | 'choToiDuyet'

interface Props {
  loai: LoaiViecCaNhan
  phien: Phien
  onHetPhien: () => void
}

const NOI_DUNG: Record<
  LoaiViecCaNhan,
  { tieuDe: string; moTa: string; trongTieuDe: string; trongMoTa: string; loi: string; cotNguoi: string }
> = {
  viecCuaToi: {
    tieuDe: 'Việc của tôi',
    moTa: 'Task chưa Hoàn thành và chưa Huỷ mà bạn là Người thực hiện, ở mọi Dự án bạn đang ở trong.',
    trongTieuDe: 'Bạn không có việc nào đang làm.',
    trongMoTa: 'Khi PM hoặc Support giao Task cho bạn, Task sẽ hiện ở đây.',
    loi: 'Không tải được danh sách Việc của tôi.',
    cotNguoi: 'Người kiểm tra',
  },
  choToiDuyet: {
    tieuDe: 'Chờ tôi duyệt',
    moTa: 'Task đang Chờ duyệt mà bạn là Người kiểm tra, ở mọi Dự án bạn đang ở trong.',
    trongTieuDe: 'Không có Task nào đang chờ bạn duyệt.',
    trongMoTa: 'Khi Người thực hiện báo Chờ duyệt một Task giao cho bạn kiểm tra, Task sẽ hiện ở đây.',
    loi: 'Không tải được danh sách Chờ tôi duyệt.',
    cotNguoi: 'Người thực hiện',
  },
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = {
  id: string
  tieuDe: string
  tenDuAn: string
  trangThai: TrangThaiTask
  nguoi: string
  han: string
}

/**
 * "Việc của tôi" hoặc "Chờ tôi duyệt": Task qua mọi Dự án của người dùng, mỗi dòng kèm tên Dự án.
 * Mở được chi tiết Task; có trạng thái trống, đang tải và lỗi.
 */
export function TrangViecCaNhan({ loai, phien, onHetPhien }: Props) {
  const kho = useKho()
  const noiDung = NOI_DUNG[loai]
  const [tai, setTai] = useState<KetQua<TaskKemDuAn[]> | null>(null)
  const [lanTai, setLanTai] = useState(0)
  const [taskDangMo, setTaskDangMo] = useState<TaskKemDuAn | null>(null)

  useEffect(() => {
    if (taskDangMo !== null) return
    let huy = false
    const goi = loai === 'viecCuaToi' ? kho.viecCuaToi(phien) : kho.choToiDuyet(phien)
    goi.then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setTai(kq)
    })
    return () => {
      huy = true
    }
  }, [kho, loai, phien, lanTai, taskDangMo, onHetPhien])

  function taiLai() {
    setTai(null)
    setLanTai((n) => n + 1)
  }

  if (taskDangMo !== null) {
    return (
      <ManChiTietTask
        key={taskDangMo.id}
        phien={phien}
        taskId={taskDangMo.id}
        tenDuAn={taskDangMo.tenDuAn}
        nhanQuayLai={`Về ${noiDung.tieuDe}`}
        thongBaoBanDau={null}
        onQuayLai={() => {
          // Quay lại thì đọc lại danh sách: trạng thái hay người được giao có thể đã đổi.
          setTai(null)
          setTaskDangMo(null)
        }}
        onHetPhien={onHetPhien}
      />
    )
  }

  const cot: TableColumn<Dong>[] = [
    {
      key: 'tieuDe',
      header: 'Task',
      width: proportional(2),
      renderCell: (dong) => (
        <Button
          label={dong.tieuDe}
          variant="ghost"
          onClick={() => {
            const task = tai?.ok ? tai.giaTri.find((t) => t.id === dong.id) : undefined
            if (task) setTaskDangMo(task)
          }}
        />
      ),
    },
    { key: 'tenDuAn', header: 'Dự án', width: proportional(1), renderCell: (dong) => <Text>{dong.tenDuAn}</Text> },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      width: proportional(1),
      renderCell: (dong) => (
        <Token label={TEN_TRANG_THAI_TASK[dong.trangThai]} color={MAU_TRANG_THAI_TASK[dong.trangThai]} />
      ),
    },
    { key: 'nguoi', header: noiDung.cotNguoi, width: proportional(1), renderCell: (dong) => <Text>{dong.nguoi}</Text> },
    { key: 'han', header: 'Hạn', width: proportional(1), renderCell: (dong) => <Text>{dong.han}</Text> },
  ]

  let phanNoiDung: ReactNode
  if (tai === null) {
    phanNoiDung = <Spinner label="Đang tải Task…" />
  } else if (!tai.ok) {
    phanNoiDung = (
      <Banner
        status="error"
        title={noiDung.loi}
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={taiLai} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    phanNoiDung = <EmptyState headingLevel={3} title={noiDung.trongTieuDe} description={noiDung.trongMoTa} />
  } else {
    const dong: Dong[] = xepViecCaNhan(tai.giaTri).map((task) => ({
      id: task.id,
      tieuDe: task.tieuDe,
      tenDuAn: task.tenDuAn,
      trangThai: task.trangThai,
      nguoi: loai === 'viecCuaToi' ? task.nguoiKiemTra.tenHienThi : task.nguoiThucHien.tenHienThi,
      han: task.han === null ? 'Không có hạn' : dinhDangNgay(task.han),
    }))
    phanNoiDung = <Table aria-label={noiDung.tieuDe} data={dong} columns={cot} idKey="id" />
  }

  return (
    <VStack gap={4}>
      <Heading level={2}>{noiDung.tieuDe}</Heading>
      <Text>{noiDung.moTa}</Text>
      {phanNoiDung}
    </VStack>
  )
}
