import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { LoiKho } from '../kho/ketQua'
import type { HoSo, Phien } from '../kho/khoDuLieu'
import { TEN_VAI } from '../luat/taiKhoan'
import { DO_DAI_CHUC_DANH_TOI_DA, DO_DAI_PHONG_BAN_TOI_DA } from '../luat/thongTinNhanSu'
import { useKho } from './khoContext'

/**
 * Bề rộng tối thiểu (px) của một ô trên hàng. FormLayout direction="horizontal" giữ đúng N cột ở mọi bề rộng
 * (không tự xuống hàng), nên mỗi hàng dùng Grid theo bề rộng tối thiểu: đủ chỗ thì 2–3 ô một hàng, hẹp thì
 * về một cột, mỗi ô chiếm hết chiều ngang.
 */
const RONG_O_TOI_THIEU = 220

interface Props {
  phien: Phien
  hoSo: HoSo
  onDaLuu: (hoSo: HoSo) => void
  onHetPhien: () => void
}

/** Sửa hồ sơ của chính mình: tên hiển thị, GitHub username và Thông tin nhân sự (PM cũng không sửa hộ ai). */
export function ManHoSo({ phien, hoSo, onDaLuu, onHetPhien }: Props) {
  const kho = useKho()
  const [tenHienThi, setTenHienThi] = useState(hoSo.tenHienThi)
  const [githubUsername, setGithubUsername] = useState(hoSo.githubUsername ?? '')
  const [soDienThoai, setSoDienThoai] = useState(hoSo.soDienThoai ?? '')
  const [chucDanh, setChucDanh] = useState(hoSo.chucDanh ?? '')
  const [phongBan, setPhongBan] = useState(hoSo.phongBan ?? '')
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [daLuu, setDaLuu] = useState(false)
  const [dangGui, setDangGui] = useState(false)

  async function luu() {
    if (dangGui) return
    setDangGui(true)
    setLoi(null)
    setDaLuu(false)
    const kq = await kho.suaHoSo(phien, hoSo.id, { tenHienThi, githubUsername, soDienThoai, chucDanh, phongBan })
    setDangGui(false)
    if (kq.ok) {
      setTenHienThi(kq.giaTri.tenHienThi)
      setGithubUsername(kq.giaTri.githubUsername ?? '')
      // Hiện đúng giá trị đã lưu (Số điện thoại ở dạng đã chuẩn hoá).
      setSoDienThoai(kq.giaTri.soDienThoai ?? '')
      setChucDanh(kq.giaTri.chucDanh ?? '')
      setPhongBan(kq.giaTri.phongBan ?? '')
      setDaLuu(true)
      onDaLuu(kq.giaTri)
    } else if (kq.loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
    } else {
      setLoi(kq.loi)
    }
  }

  const trangThaiO = (o: string) => {
    const thongBao = loi?.loiTheoO?.[o]
    return thongBao ? { type: 'error' as const, message: thongBao } : undefined
  }

  return (
    <VStack gap={4}>
      <Heading level={2}>Hồ sơ của tôi</Heading>
      {loi && <Banner status="error" title={loi.thongBao} role="alert" />}
      {daLuu && <Banner status="success" title="Đã lưu hồ sơ." role="status" />}
      <FormLayout>
        <Grid columns={{ minWidth: RONG_O_TOI_THIEU, max: 2, repeat: 'fit' }} gap={4} align="start">
          <TextInput label="Email" value={hoSo.email} isReadOnly />
          <TextInput label="Vai" value={TEN_VAI[hoSo.vai]} isReadOnly />
        </Grid>
        <Grid columns={{ minWidth: RONG_O_TOI_THIEU, max: 2, repeat: 'fit' }} gap={4} align="start">
          <TextInput
            label="Tên hiển thị"
            autoComplete="name"
            value={tenHienThi}
            onChange={setTenHienThi}
            onEnter={luu}
            status={trangThaiO('tenHienThi')}
          />
          <TextInput
            label="GitHub username"
            description="Tuỳ chọn. Để trống để xoá."
            autoComplete="off"
            hasAutoCorrect={false}
            hasSpellCheck={false}
            autoCapitalize="none"
            value={githubUsername}
            onChange={setGithubUsername}
            onEnter={luu}
            status={trangThaiO('githubUsername')}
          />
        </Grid>
        <Grid columns={{ minWidth: RONG_O_TOI_THIEU, max: 3, repeat: 'fit' }} gap={4} align="start">
          <TextInput
            label="Số điện thoại"
            type="tel"
            inputMode="tel"
            description="Tuỳ chọn. 10 chữ số bắt đầu bằng 0 (vd 0901 234 567), hoặc +84 và 9 chữ số."
            autoComplete="tel"
            value={soDienThoai}
            onChange={setSoDienThoai}
            onEnter={luu}
            status={trangThaiO('soDienThoai')}
          />
          <TextInput
            label="Chức danh"
            description={`Tuỳ chọn. Tối đa ${DO_DAI_CHUC_DANH_TOI_DA} ký tự.`}
            autoComplete="organization-title"
            value={chucDanh}
            onChange={setChucDanh}
            onEnter={luu}
            status={trangThaiO('chucDanh')}
          />
          <TextInput
            label="Phòng ban"
            description={`Tuỳ chọn. Tối đa ${DO_DAI_PHONG_BAN_TOI_DA} ký tự.`}
            autoComplete="off"
            value={phongBan}
            onChange={setPhongBan}
            onEnter={luu}
            status={trangThaiO('phongBan')}
          />
        </Grid>
      </FormLayout>
      <HStack gap={2}>
        <Button label="Lưu hồ sơ" variant="primary" isLoading={dangGui} onClick={luu} />
      </HStack>
    </VStack>
  )
}
