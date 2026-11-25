import { useEffect, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { Phien, Task } from '../kho/khoDuLieu'
import { dinhDangNgayGio } from '../luat/duAn'
import { TEN_TRANG_THAI_TASK, dinhDangNgay } from '../luat/task'
import { useKho } from './khoContext'
import { MAU_TRANG_THAI_TASK } from './mauTrangThaiTask'

interface Props {
  phien: Phien
  taskId: string
  /** Tên Dự án chứa Task, cho nút quay lại. */
  tenDuAn: string
  /** Nhãn nút quay lại khi không quay về Dự án (vd. quay về "Việc của tôi"); mặc định "Về Dự án <tên>". */
  nhanQuayLai?: string
  /** Thông báo thành công mang sang từ màn trước (vd. vừa tạo xong). */
  thongBaoBanDau: string | null
  onQuayLai: () => void
  onHetPhien: () => void
}

/** Chi tiết một Task: người được giao, hạn, trạng thái, số lần bị Trả lại và dấu vết. Chỉ xem. */
export function ManChiTietTask({ phien, taskId, tenDuAn, nhanQuayLai, thongBaoBanDau, onQuayLai, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<Task> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null

  useEffect(() => {
    let huy = false
    kho.layTask(phien, taskId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ lan: lanTai, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, taskId, lanTai, onHetPhien])

  const nutVe = (
    <HStack gap={2}>
      <Button label={nhanQuayLai ?? `Về Dự án ${tenDuAn}`} variant="ghost" onClick={onQuayLai} />
    </HStack>
  )

  if (tai === null) {
    return (
      <VStack gap={4}>
        {nutVe}
        <Spinner label="Đang tải Task…" />
      </VStack>
    )
  }

  if (!tai.ok) {
    return (
      <VStack gap={4}>
        {nutVe}
        <Banner
          status="error"
          title="Không tải được Task."
          description={tai.loi.thongBao}
          role="alert"
          endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
        />
      </VStack>
    )
  }

  const task = tai.giaTri
  const { taoBoi, taoLuc, suaBoi, suaLuc } = task.dauVet

  return (
    <VStack gap={4}>
      {nutVe}
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Heading level={2}>{task.tieuDe}</Heading>
        <Token label={TEN_TRANG_THAI_TASK[task.trangThai]} color={MAU_TRANG_THAI_TASK[task.trangThai]} />
      </HStack>
      {thongBaoBanDau && <Banner status="success" title={thongBaoBanDau} role="status" />}

      <VStack gap={1} role="group" aria-label="Thông tin Task">
        <Heading level={3}>Thông tin</Heading>
        <Text>{`Trạng thái: ${TEN_TRANG_THAI_TASK[task.trangThai]}`}</Text>
        <Text>{`Người thực hiện: ${task.nguoiThucHien.tenHienThi}`}</Text>
        <Text>{`Người kiểm tra: ${task.nguoiKiemTra.tenHienThi}`}</Text>
        <Text>{`Hạn: ${task.han === null ? 'Không có hạn' : dinhDangNgay(task.han)}`}</Text>
        <Text>{`Số lần bị Trả lại: ${task.soLanTraLai}`}</Text>
      </VStack>

      <VStack gap={1} role="group" aria-label="Mô tả">
        <Heading level={3}>Mô tả</Heading>
        <Text>{task.moTa === '' ? 'Không có mô tả.' : task.moTa}</Text>
      </VStack>

      <VStack gap={1} role="group" aria-label="Dấu vết">
        <Heading level={3}>Dấu vết</Heading>
        <Text>{`Người tạo: ${taoBoi.tenHienThi}`}</Text>
        <Text>{`Ngày tạo: ${dinhDangNgayGio(taoLuc)}`}</Text>
        {suaBoi && suaLuc ? (
          <>
            <Text>{`Người chỉnh sửa gần nhất: ${suaBoi.tenHienThi}`}</Text>
            <Text>{`Ngày chỉnh sửa gần nhất: ${dinhDangNgayGio(suaLuc)}`}</Text>
          </>
        ) : (
          <Text>Chưa có ai chỉnh sửa.</Text>
        )}
        <Text>Ngày giờ theo giờ Việt Nam.</Text>
      </VStack>
    </VStack>
  )
}
