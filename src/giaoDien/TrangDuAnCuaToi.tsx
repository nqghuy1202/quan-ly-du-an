import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, DuAnTomTat, Phien } from '../kho/khoDuLieu'
import { TEN_TRANG_THAI_DU_AN, duocTaoDuAn, type TrangThaiDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { ManChiTietDuAn } from './ManChiTietDuAn'
import { NganTruotTaoDuAn } from './NganTruotDuAn'

interface Props {
  phien: Phien
  vai: VaiHeThong
  /** Đồng hồ cho dấu vết khi tạo Dự án, và khi sửa Dự án ở màn chi tiết. */
  dongHo: () => Date
  onHetPhien: () => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = {
  id: string
  ten: string
  trangThai: TrangThaiDuAn
}

/**
 * Các Dự án người dùng đang ở trong; trống thì hướng dẫn nhờ PM hoặc Support. Mở được chi tiết. PM tạo
 * Dự án trong Ngăn trượt; tạo xong thì ngăn đóng, danh sách đọc lại và có nút mở ngay Dự án vừa tạo
 * (người tạo chưa phải người trong dự án nên Dự án mới chưa nằm trong danh sách này).
 */
export function TrangDuAnCuaToi({ phien, vai, dongHo, onHetPhien }: Props) {
  const kho = useKho()
  const [tai, setTai] = useState<KetQua<DuAnTomTat[]> | null>(null)
  const [lanTai, setLanTai] = useState(0)
  const [duAnDangMo, setDuAnDangMo] = useState<string | null>(null)
  const duocTao = duocTaoDuAn(vai)
  const [dangTao, setDangTao] = useState(false)
  const [daTao, setDaTao] = useState<DuAn | null>(null)

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
        dongHo={dongHo}
        onQuayLai={() => {
          // Quay lại thì đọc lại danh sách: có thể vừa Lưu trữ, đổi tên hay tự gỡ mình ra.
          setTai(null)
          setDaTao(null)
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
      <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
        <Heading level={2}>Dự án của tôi</Heading>
        {duocTao && (
          <Button
            label="Tạo Dự án"
            variant="primary"
            onClick={() => {
              setDaTao(null)
              setDangTao(true)
            }}
          />
        )}
      </HStack>
      {daTao !== null && (
        <Banner
          status="success"
          title={`Đã tạo Dự án ${daTao.ten}.`}
          description="Dự án của tôi chỉ liệt kê Dự án bạn đang ở trong; Dự án mới có ở Tất cả Dự án."
          role="status"
          endContent={<Button label={`Mở Dự án ${daTao.ten}`} variant="secondary" onClick={() => setDuAnDangMo(daTao.id)} />}
        />
      )}
      {noiDung}
      {duocTao && (
        <NganTruotTaoDuAn
          isOpen={dangTao}
          phien={phien}
          dongHo={dongHo}
          onDong={() => setDangTao(false)}
          onDaTao={(duAn) => {
            setDangTao(false)
            setDaTao(duAn)
            taiLai()
          }}
          onHetPhien={onHetPhien}
        />
      )}
    </VStack>
  )
}
