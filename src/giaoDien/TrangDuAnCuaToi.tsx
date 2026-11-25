import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DuAnTomTat, Phien } from '../kho/khoDuLieu'
import { TEN_TRANG_THAI_DU_AN, type TrangThaiDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { ManChiTietDuAn } from './ManChiTietDuAn'

interface Props {
  phien: Phien
  vai: VaiHeThong
  /** Đồng hồ cho dấu vết khi sửa Dự án ở màn chi tiết. */
  dongHo: () => Date
  onHetPhien: () => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = {
  id: string
  ten: string
  trangThai: TrangThaiDuAn
}

/** Các Dự án người dùng đang ở trong; trống thì hướng dẫn nhờ PM hoặc Support. Mở được chi tiết. */
export function TrangDuAnCuaToi({ phien, vai, dongHo, onHetPhien }: Props) {
  const kho = useKho()
  const [tai, setTai] = useState<KetQua<DuAnTomTat[]> | null>(null)
  const [lanTai, setLanTai] = useState(0)
  const [duAnDangMo, setDuAnDangMo] = useState<string | null>(null)

  useEffect(() => {
    if (duAnDangMo !== null) return
    let huy = false
    kho.danhSachDuAnCuaToi(phien).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setTai(kq)
    })
    return () => {
      huy = true
    }
  }, [kho, phien, lanTai, duAnDangMo, onHetPhien])

  function taiLai() {
    setTai(null)
    setLanTai((n) => n + 1)
  }

  if (duAnDangMo !== null) {
    return (
      <ManChiTietDuAn
        key={duAnDangMo}
        phien={phien}
        vai={vai}
        duAnId={duAnDangMo}
        thongBaoBanDau={null}
        dongHo={dongHo}
        onQuayLai={() => {
          // Quay lại thì đọc lại danh sách: có thể vừa Lưu trữ, đổi tên hay tự gỡ mình ra.
          setTai(null)
          setDuAnDangMo(null)
        }}
        onHetPhien={onHetPhien}
      />
    )
  }

  const cot: TableColumn<Dong>[] = [
    {
      key: 'ten',
      header: 'Tên Dự án',
      width: proportional(2),
      renderCell: (dong) => <Button label={dong.ten} variant="ghost" onClick={() => setDuAnDangMo(dong.id)} />,
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      width: proportional(1),
      renderCell: (dong) => (
        <Token label={TEN_TRANG_THAI_DU_AN[dong.trangThai]} color={dong.trangThai === 'LUU_TRU' ? 'gray' : 'green'} />
      ),
    },
  ]

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
    const dong: Dong[] = [...tai.giaTri]
      .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))
      .map(({ id, ten, trangThai }) => ({ id, ten, trangThai }))
    noiDung = <Table aria-label="Dự án của tôi" data={dong} columns={cot} idKey="id" />
  }

  return (
    <VStack gap={4}>
      <Heading level={2}>Dự án của tôi</Heading>
      {noiDung}
    </VStack>
  )
}
