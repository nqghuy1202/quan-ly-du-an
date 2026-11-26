import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, Phien } from '../kho/khoDuLieu'
import {
  CAC_TRANG_THAI_DU_AN,
  TEN_TRANG_THAI_DU_AN,
  THONG_BAO_DU_AN,
  dinhDangNgayGio,
  duocTaoDuAn,
  xepDuAn,
  type TrangThaiDuAn,
} from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { NganTruotTaoDuAn } from './NganTruotDuAn'

interface Props {
  phien: Phien
  vai: VaiHeThong
  /** Đồng hồ cho dấu vết khi tạo Dự án. */
  dongHo: () => Date
  boLoc: TrangThaiDuAn
  onDoiBoLoc: (boLoc: TrangThaiDuAn) => void
  onMo: (duAnId: string) => void
  onHetPhien: () => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = {
  id: string
  ten: string
  trangThai: TrangThaiDuAn
  nguoiTao: string
  ngayTao: string
  chinhSua: string
}

const MAN_TRONG: Record<TrangThaiDuAn, { tieuDe: string; moTa: string }> = {
  HOAT_DONG: {
    tieuDe: 'Chưa có Dự án nào đang hoạt động.',
    moTa: 'Tạo Dự án mới để bắt đầu quản lý một đầu việc.',
  },
  LUU_TRU: {
    tieuDe: 'Chưa có Dự án nào được Lưu trữ.',
    moTa: 'Dự án được Lưu trữ sẽ hiện ở đây để xem lại.',
  },
}

function laTrangThai(giaTri: string): giaTri is TrangThaiDuAn {
  return (CAC_TRANG_THAI_DU_AN as readonly string[]).includes(giaTri)
}

function thanhDong(duAn: DuAn): Dong {
  const { taoBoi, taoLuc, suaBoi, suaLuc } = duAn.dauVet
  return {
    id: duAn.id,
    ten: duAn.ten,
    trangThai: duAn.trangThai,
    nguoiTao: taoBoi.tenHienThi,
    ngayTao: dinhDangNgayGio(taoLuc),
    chinhSua: suaBoi && suaLuc ? `${suaBoi.tenHienThi}, ${dinhDangNgayGio(suaLuc)}` : '',
  }
}

/**
 * Danh sách Dự án người dùng được thấy (PM: mọi Dự án), lọc giữa đang hoạt động và Lưu trữ. PM tạo Dự
 * án trong Ngăn trượt; tạo xong thì ngăn đóng và danh sách (bộ lọc đang hoạt động) đọc lại.
 */
export function ManDanhSachDuAn({ phien, vai, dongHo, boLoc, onDoiBoLoc, onMo, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  // Kết quả gắn với bộ lọc và lần tải đã sinh ra nó; khác bộ lọc hay lần tải thì coi như đang tải.
  const [daTai, setDaTai] = useState<{ khoa: string; kq: KetQua<DuAn[]> } | null>(null)
  const khoa = `${boLoc}:${lanTai}`
  const tai = daTai && daTai.khoa === khoa ? daTai.kq : null
  const duocTao = duocTaoDuAn(vai)
  const [dangTao, setDangTao] = useState(false)
  const [daTao, setDaTao] = useState<string | null>(null)

  useEffect(() => {
    let huy = false
    kho.danhSachDuAn(phien, { trangThai: boLoc }).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ khoa: `${boLoc}:${lanTai}`, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, boLoc, lanTai, onHetPhien])

  const cot: TableColumn<Dong>[] = [
    {
      key: 'ten',
      header: 'Tên Dự án',
      width: proportional(2),
      renderCell: (dong) => <Button label={dong.ten} variant="ghost" onClick={() => onMo(dong.id)} />,
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      width: proportional(1),
      renderCell: (dong) => (
        <Token label={TEN_TRANG_THAI_DU_AN[dong.trangThai]} color={dong.trangThai === 'LUU_TRU' ? 'gray' : 'green'} />
      ),
    },
    { key: 'nguoiTao', header: 'Người tạo', width: proportional(1), renderCell: (dong) => <Text>{dong.nguoiTao}</Text> },
    { key: 'ngayTao', header: 'Ngày tạo', width: proportional(1), renderCell: (dong) => <Text>{dong.ngayTao}</Text> },
    {
      key: 'chinhSua',
      header: 'Chỉnh sửa gần nhất',
      width: proportional(1),
      renderCell: (dong) => <Text>{dong.chinhSua}</Text>,
    },
  ]

  let noiDung: ReactNode
  if (tai === null) {
    noiDung = <Spinner label="Đang tải các Dự án…" />
  } else if (!tai.ok) {
    noiDung = (
      <Banner
        status="error"
        title="Không tải được các Dự án."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    noiDung = <EmptyState headingLevel={3} title={MAN_TRONG[boLoc].tieuDe} description={MAN_TRONG[boLoc].moTa} />
  } else {
    noiDung = (
      <Table aria-label="Danh sách Dự án" data={xepDuAn(tai.giaTri).map(thanhDong)} columns={cot} idKey="id" />
    )
  }

  return (
    <VStack gap={4}>
      <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
        <Heading level={2}>Tất cả Dự án</Heading>
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
      {!duocTao && <Text>{THONG_BAO_DU_AN.chiPMTao}</Text>}
      {daTao !== null && <Banner status="success" title={daTao} role="status" />}
      <Text>Ngày giờ hiển thị theo giờ Việt Nam.</Text>
      <SegmentedControl
        label="Lọc Dự án theo trạng thái"
        size="sm"
        value={boLoc}
        onChange={(giaTri) => {
          if (laTrangThai(giaTri) && giaTri !== boLoc) onDoiBoLoc(giaTri)
        }}
      >
        {CAC_TRANG_THAI_DU_AN.map((trangThai) => (
          <SegmentedControlItem key={trangThai} value={trangThai} label={TEN_TRANG_THAI_DU_AN[trangThai]} />
        ))}
      </SegmentedControl>
      {noiDung}
      {duocTao && (
        <NganTruotTaoDuAn
          isOpen={dangTao}
          phien={phien}
          dongHo={dongHo}
          onDong={() => setDangTao(false)}
          onDaTao={(duAn) => {
            // Ngăn đóng; danh sách Dự án đang hoạt động đọc lại nên Dự án mới hiện trong bảng.
            setDangTao(false)
            setDaTao(`Đã tạo Dự án ${duAn.ten}.`)
            if (boLoc !== 'HOAT_DONG') onDoiBoLoc('HOAT_DONG')
            else setLanTai((n) => n + 1)
          }}
          onHetPhien={onHetPhien}
        />
      )}
    </VStack>
  )
}
