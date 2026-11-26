import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DuAnKemSoLieu, Phien } from '../kho/khoDuLieu'
import { THONG_BAO_DU_AN, duocTaoDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { LOC_TAT_CA_DU_AN_BAN_DAU, type LocDuAn } from '../luat/timDuAn'
import { BangDuAn } from './BangDuAn'
import { useKho } from './khoContext'
import { NganTruotTaoDuAn } from './NganTruotDuAn'

interface Props {
  phien: Phien
  vai: VaiHeThong
  /** Đồng hồ cho dấu vết khi tạo Dự án, và cho ngày hôm nay của Tiến độ, Trễ hạn, Quá hạn dự kiến. */
  dongHo: () => Date
  /** Bộ tìm và lọc; trang cha giữ để quay lại từ chi tiết không mất. */
  loc: LocDuAn
  onDoiLoc: (loc: LocDuAn) => void
  onMo: (duAnId: string) => void
  onHetPhien: () => void
}

/**
 * Danh sách Dự án người dùng được thấy (PM: mọi Dự án), kèm Tiến độ, Trễ hạn, Quá hạn dự kiến; tìm và lọc
 * bằng bảng dùng chung (mặc định các Dự án đang hoạt động). PM tạo Dự án trong Ngăn trượt; tạo xong thì
 * ngăn đóng, bộ lọc về mặc định và danh sách đọc lại.
 */
export function ManDanhSachDuAn({ phien, vai, dongHo, loc, onDoiLoc, onMo, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  // Kết quả gắn với lần tải đã sinh ra nó; khác lần tải thì coi như đang tải.
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<DuAnKemSoLieu[]> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const duocTao = duocTaoDuAn(vai)
  const [dangTao, setDangTao] = useState(false)
  const [daTao, setDaTao] = useState<string | null>(null)

  useEffect(() => {
    let huy = false
    kho.danhSachDuAnKemSoLieu(phien, 'TAT_CA', dongHo()).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ lan: lanTai, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, dongHo, lanTai, onHetPhien])

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
  } else {
    noiDung = (
      <BangDuAn
        tenBang="Danh sách Dự án"
        duAn={tai.giaTri}
        loc={loc}
        onDoiLoc={onDoiLoc}
        onMo={onMo}
        manTrong={{ tieuDe: 'Chưa có Dự án nào.', moTa: 'Tạo Dự án mới để bắt đầu quản lý một đầu việc.' }}
      />
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
      {noiDung}
      {duocTao && (
        <NganTruotTaoDuAn
          isOpen={dangTao}
          phien={phien}
          dongHo={dongHo}
          onDong={() => setDangTao(false)}
          onDaTao={(duAn) => {
            // Ngăn đóng; bộ lọc về mặc định và danh sách đọc lại nên Dự án mới hiện trong bảng.
            setDangTao(false)
            setDaTao(`Đã tạo Dự án ${duAn.ten}.`)
            onDoiLoc(LOC_TAT_CA_DU_AN_BAN_DAU)
            setLanTai((n) => n + 1)
          }}
          onHetPhien={onHetPhien}
        />
      )}
    </VStack>
  )
}
