import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import { thanhCong, type KetQua } from '../kho/ketQua'
import type { HoSo, Phien } from '../kho/khoDuLieu'
import { TEN_VAI, duocQuanLyNguoiDung, type VaiHeThong } from '../luat/taiKhoan'
import { duocXemMoiDuAn } from '../luat/duAn'
import { useKho } from './khoContext'
import { ManDuAn } from './ManDuAn'
import { ManHoSo } from './ManHoSo'
import { ManNguoiDung } from './ManNguoiDung'
import { ManTongQuan } from './ManTongQuan'
import { TrangDuAnCuaToi } from './TrangDuAnCuaToi'
import { TrangViecCaNhan } from './TrangViecCaNhan'

type Trang = 'tongQuan' | 'duAn' | 'viecCuaToi' | 'choToiDuyet' | 'tatCaDuAn' | 'hoSo' | 'nguoiDung'

interface Props {
  phien: Phien
  /** Gọi khi người dùng đăng xuất hoặc phiên không còn dùng được. */
  onHetPhien: () => void
  /** Đồng hồ cho dấu vết (ngày tạo, ngày chỉnh sửa). */
  dongHo: () => Date
}

/** Khung ứng dụng sau khi đăng nhập: tên và vai cố định ở đầu trang, nút đăng xuất. */
export function KhungUngDung({ phien, onHetPhien, dongHo }: Props) {
  const kho = useKho()
  const [tai, setTai] = useState<KetQua<HoSo> | null>(null)
  const [lanTai, setLanTai] = useState(0)
  const [trang, setTrang] = useState<Trang>('duAn')

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
  // Cùng luật quyền với Kho: chỉ PM thấy mục Người dùng.
  const thayNguoiDung = duocQuanLyNguoiDung(hoSo.vai)
  // Cùng luật với Kho: chỉ PM thấy mọi Dự án, nên chỉ PM có mục Tất cả Dự án.
  const thayTatCaDuAn = duocXemMoiDuAn(hoSo.vai)
  const trangHien: Trang =
    (trang === 'nguoiDung' && !thayNguoiDung) || (trang === 'tatCaDuAn' && !thayTatCaDuAn) ? 'duAn' : trang

  function khiVaiCuaToiDoi(vai: VaiHeThong) {
    setTai(thanhCong({ ...hoSo, vai }))
  }

  let noiDung: ReactNode
  if (trangHien === 'tongQuan') {
    noiDung = <ManTongQuan phien={phien} vai={hoSo.vai} dongHo={dongHo} onHetPhien={onHetPhien} />
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

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider role="banner">
          <VStack gap={2}>
            <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
              <Heading level={1}>Quản lý dự án</Heading>
              <HStack gap={2} vAlign="center" wrap="wrap" role="group" aria-label="Tài khoản đang đăng nhập">
                <Text weight="semibold">{hoSo.tenHienThi}</Text>
                <Token label={TEN_VAI[hoSo.vai]} />
              </HStack>
            </HStack>
            <HStack gap={2} wrap="wrap" role="navigation" aria-label="Điều hướng chính">
              <Button
                label="Tổng quan"
                variant={trangHien === 'tongQuan' ? 'secondary' : 'ghost'}
                aria-current={trangHien === 'tongQuan' ? 'page' : undefined}
                onClick={() => setTrang('tongQuan')}
              />
              <Button
                label="Dự án của tôi"
                variant={trangHien === 'duAn' ? 'secondary' : 'ghost'}
                aria-current={trangHien === 'duAn' ? 'page' : undefined}
                onClick={() => setTrang('duAn')}
              />
              <Button
                label="Việc của tôi"
                variant={trangHien === 'viecCuaToi' ? 'secondary' : 'ghost'}
                aria-current={trangHien === 'viecCuaToi' ? 'page' : undefined}
                onClick={() => setTrang('viecCuaToi')}
              />
              <Button
                label="Chờ tôi duyệt"
                variant={trangHien === 'choToiDuyet' ? 'secondary' : 'ghost'}
                aria-current={trangHien === 'choToiDuyet' ? 'page' : undefined}
                onClick={() => setTrang('choToiDuyet')}
              />
              {thayTatCaDuAn && (
                <Button
                  label="Tất cả Dự án"
                  variant={trangHien === 'tatCaDuAn' ? 'secondary' : 'ghost'}
                  aria-current={trangHien === 'tatCaDuAn' ? 'page' : undefined}
                  onClick={() => setTrang('tatCaDuAn')}
                />
              )}
              <Button
                label="Hồ sơ"
                variant={trangHien === 'hoSo' ? 'secondary' : 'ghost'}
                aria-current={trangHien === 'hoSo' ? 'page' : undefined}
                onClick={() => setTrang('hoSo')}
              />
              {thayNguoiDung && (
                <Button
                  label="Người dùng"
                  variant={trangHien === 'nguoiDung' ? 'secondary' : 'ghost'}
                  aria-current={trangHien === 'nguoiDung' ? 'page' : undefined}
                  onClick={() => setTrang('nguoiDung')}
                />
              )}
              <Button label="Đăng xuất" variant="ghost" onClick={dangXuat} />
            </HStack>
          </VStack>
        </LayoutHeader>
      }
      content={<LayoutContent role="main">{noiDung}</LayoutContent>}
    />
  )
}
