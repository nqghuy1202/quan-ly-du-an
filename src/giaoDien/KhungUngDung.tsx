import { useEffect, useState, type ReactNode } from 'react'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { HStack } from '@astryxdesign/core/HStack'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav'
import { TopNav } from '@astryxdesign/core/TopNav'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import { thanhCong, type KetQua } from '../kho/ketQua'
import type { HoSo, Phien } from '../kho/khoDuLieu'
import { TEN_VAI, type VaiHeThong } from '../luat/taiKhoan'
import { TRANG_MO_DAU, nhomDieuHuong, trangHienThi, type Trang } from '../luat/dieuHuong'
import { useKho } from './khoContext'
import { ManDuAn } from './ManDuAn'
import { ManHoSo } from './ManHoSo'
import { ManNguoiDung } from './ManNguoiDung'
import { ManTongQuan } from './ManTongQuan'
import { TrangDuAnCuaToi } from './TrangDuAnCuaToi'
import { ThuongHieu } from './ThuongHieu'
import { TrangViecCaNhan } from './TrangViecCaNhan'

interface Props {
  phien: Phien
  /** Gọi khi người dùng đăng xuất hoặc phiên không còn dùng được. */
  onHetPhien: () => void
  /** Đồng hồ cho dấu vết (ngày tạo, ngày chỉnh sửa). */
  dongHo: () => Date
}

/**
 * Khung ứng dụng sau khi đăng nhập: logo và tên ở đầu trang, Thanh bên bên trái (mục theo vai, từ
 * `luat/dieuHuong`), tên, vai, Hồ sơ và Đăng xuất gom ở chân Thanh bên. Màn hẹp: Thanh bên thu thành
 * nút mở trình đơn (AppShell lo).
 */
export function KhungUngDung({ phien, onHetPhien, dongHo }: Props) {
  const kho = useKho()
  const [tai, setTai] = useState<KetQua<HoSo> | null>(null)
  const [lanTai, setLanTai] = useState(0)
  const [trang, setTrang] = useState<Trang>(TRANG_MO_DAU)

  useEffect(() => {
    let huy = false
    kho.layHoSoCuaToi(phien).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setTai(kq)
    })
    return () => {
      huy = true
    }
  }, [kho, phien, lanTai, onHetPhien])

  async function dangXuat() {
    await kho.dangXuat(phien)
    onHetPhien()
  }

  if (tai === null) {
    return (
      <Center padding={6}>
        <Spinner size="lg" label="Đang tải hồ sơ…" />
      </Center>
    )
  }

  if (!tai.ok) {
    return (
      <Center padding={6}>
        <Banner
          status="error"
          title="Không tải được hồ sơ của bạn."
          description={tai.loi.thongBao}
          role="alert"
          endContent={
            <Button
              label="Thử lại"
              variant="secondary"
              onClick={() => {
                setTai(null)
                setLanTai((n) => n + 1)
              }}
            />
          }
        />
      </Center>
    )
  }

  const hoSo = tai.giaTri
  // Vai không còn được mở trang đang chọn (vd bị hạ vai) thì về Tổng quan.
  const trangHien = trangHienThi(trang, hoSo.vai)

  function khiVaiCuaToiDoi(vai: VaiHeThong) {
    setTai(thanhCong({ ...hoSo, vai }))
  }

  let noiDung: ReactNode
  if (trangHien === 'tongQuan') {
    noiDung = (
      <ManTongQuan phien={phien} vai={hoSo.vai} dongHo={dongHo} onMoTrang={setTrang} onHetPhien={onHetPhien} />
    )
  } else if (trangHien === 'duAn') {
    noiDung = <TrangDuAnCuaToi phien={phien} vai={hoSo.vai} dongHo={dongHo} onHetPhien={onHetPhien} />
  } else if (trangHien === 'viecCuaToi' || trangHien === 'choToiDuyet') {
    noiDung = <TrangViecCaNhan key={trangHien} loai={trangHien} phien={phien} vai={hoSo.vai} dongHo={dongHo} onHetPhien={onHetPhien} />
  } else if (trangHien === 'tatCaDuAn') {
    noiDung = <ManDuAn phien={phien} vai={hoSo.vai} dongHo={dongHo} onHetPhien={onHetPhien} />
  } else if (trangHien === 'hoSo') {
    noiDung = (
      <ManHoSo phien={phien} hoSo={hoSo} onDaLuu={(moi) => setTai(thanhCong(moi))} onHetPhien={onHetPhien} />
    )
  } else {
    noiDung = <ManNguoiDung phien={phien} onHetPhien={onHetPhien} onVaiCuaToiDoi={khiVaiCuaToiDoi} />
  }

  const nhomMuc = nhomDieuHuong(hoSo.vai)
  const moTrang = (t: Trang) => () => setTrang(t)
  const thanhBen = (
    <SideNav
      aria-label="Điều hướng chính"
      footer={
        <VStack gap={2} role="group" aria-label="Tài khoản đang đăng nhập">
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold">{hoSo.tenHienThi}</Text>
            <Token label={TEN_VAI[hoSo.vai]} />
          </HStack>
          {nhomMuc
            .filter((nhom) => nhom.nhom === 'taiKhoan')
            .flatMap((nhom) => nhom.muc)
            .map((muc) => (
              <SideNavItem
                key={muc.trang}
                label={muc.nhan}
                isSelected={trangHien === muc.trang}
                onClick={moTrang(muc.trang)}
              />
            ))}
          <Button label="Đăng xuất" variant="ghost" onClick={dangXuat} />
        </VStack>
      }>
      {nhomMuc
        .filter((nhom) => nhom.nhom !== 'taiKhoan')
        .map((nhom) => (
          <SideNavSection key={nhom.nhom} title={nhom.tieuDe ?? nhom.muc[0].nhan} isHeaderHidden={nhom.tieuDe === null}>
            {nhom.muc.map((muc) => (
              <SideNavItem
                key={muc.trang}
                label={muc.nhan}
                isSelected={trangHien === muc.trang}
                onClick={moTrang(muc.trang)}
              />
            ))}
          </SideNavSection>
        ))}
    </SideNav>
  )

  return (
    <AppShell
      topNav={<TopNav label="Đầu trang" heading={<ThuongHieu laTieuDeTrang />} />}
      sideNav={thanhBen}>
      <Layout height="auto" content={<LayoutContent>{noiDung}</LayoutContent>} />
    </AppShell>
  )
}
