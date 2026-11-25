import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DuAnTomTat, Phien } from '../kho/khoDuLieu'
import { useKho } from './khoContext'

interface Props {
  phien: Phien
  onHetPhien: () => void
}

/** Danh sách Dự án người dùng được thấy; trống thì hướng dẫn nhờ PM hoặc Support. */
export function TrangDuAnCuaToi({ phien, onHetPhien }: Props) {
  const kho = useKho()
  const [tai, setTai] = useState<KetQua<DuAnTomTat[]> | null>(null)
  const [lanTai, setLanTai] = useState(0)

  useEffect(() => {
    let huy = false
    kho.danhSachDuAnCuaToi(phien).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setTai(kq)
    })
    return () => {
      huy = true
    }
  }, [kho, phien, lanTai, onHetPhien])

  function taiLai() {
    setTai(null)
    setLanTai((n) => n + 1)
  }

  let noiDung: ReactNode
  if (tai === null) {
    noiDung = <Spinner label="Đang tải danh sách Dự án…" />
  } else if (!tai.ok) {
    noiDung = (
      <Banner
        status="error"
        title="Không tải được danh sách Dự án."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={taiLai} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    noiDung = (
      <EmptyState
        headingLevel={3}
        title="Bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn."
        description="Khi được thêm vào một Dự án, Dự án đó sẽ hiện ở đây."
      />
    )
  } else {
    noiDung = (
      <VStack gap={2}>
        {tai.giaTri.map((duAn) => (
          <Text key={duAn.id}>{duAn.ten}</Text>
        ))}
      </VStack>
    )
  }

  return (
    <VStack gap={4}>
      <Heading level={2}>Dự án của tôi</Heading>
      {noiDung}
    </VStack>
  )
}
