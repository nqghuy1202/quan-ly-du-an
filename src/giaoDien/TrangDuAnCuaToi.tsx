import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, DuAnKemSoLieu, Phien } from '../kho/khoDuLieu'
import { duocTaoDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { LOC_DU_AN_TRONG, type LocDuAn } from '../luat/timDuAn'
import { BangDuAn } from './BangDuAn'
import { useKho } from './khoContext'
import { ManChiTietDuAnTaiLuoi } from './cacManTaiLuoi'
import { NganTruotTaoDuAn } from './NganTruotDuAn'

interface Props {
  phien: Phien
  vai: VaiHeThong
  /**
   * Đồng hồ cho dấu vết khi tạo Dự án, khi sửa Dự án ở màn chi tiết, và cho ngày hôm nay của Tiến độ,
   * Trễ hạn, Quá hạn dự kiến.
   */
  dongHo: () => Date
  onHetPhien: () => void
}

/**
 * Các Dự án người dùng đang ở trong (kể cả Lưu trữ), kèm Tiến độ, Trễ hạn, Quá hạn dự kiến; tìm và lọc
 * bằng bảng dùng chung, giữ bộ lọc khi vào chi tiết rồi quay lại. Trống thì hướng dẫn nhờ PM hoặc
 * Support. Mở được chi tiết. PM tạo Dự án trong Ngăn trượt; tạo xong thì ngăn đóng, danh sách đọc lại
 * và có nút mở ngay Dự án vừa tạo (người tạo chưa phải người trong dự án nên Dự án mới chưa nằm trong
 * danh sách này).
 */
export function TrangDuAnCuaToi({ phien, vai, dongHo, onHetPhien }: Props) {
  const kho = useKho()
  const [tai, setTai] = useState<KetQua<DuAnKemSoLieu[]> | null>(null)
  const [loc, setLoc] = useState<LocDuAn>(LOC_DU_AN_TRONG)
  const [lanTai, setLanTai] = useState(0)
  const [duAnDangMo, setDuAnDangMo] = useState<string | null>(null)
  const duocTao = duocTaoDuAn(vai)
  const [dangTao, setDangTao] = useState(false)
  const [daTao, setDaTao] = useState<DuAn | null>(null)

  useEffect(() => {
    if (duAnDangMo !== null) return
    let huy = false
    kho.danhSachDuAnKemSoLieu(phien, 'CUA_TOI', dongHo()).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setTai(kq)
    })
    return () => {
      huy = true
    }
  }, [kho, phien, dongHo, lanTai, duAnDangMo, onHetPhien])

  function taiLai() {
    setTai(null)
    setLanTai((n) => n + 1)
  }

  if (duAnDangMo !== null) {
    return (
      <ManChiTietDuAnTaiLuoi
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
  } else {
    noiDung = (
      <BangDuAn
        tenBang="Dự án của tôi"
        duAn={tai.giaTri}
        loc={loc}
        onDoiLoc={setLoc}
        onMo={setDuAnDangMo}
        manTrong={{
          tieuDe: 'Bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn.',
          moTa: 'Khi được thêm vào một Dự án, Dự án đó sẽ hiện ở đây.',
        }}
      />
    )
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
