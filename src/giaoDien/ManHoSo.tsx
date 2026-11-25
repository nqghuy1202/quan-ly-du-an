import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { LoiKho } from '../kho/ketQua'
import type { HoSo, Phien } from '../kho/khoDuLieu'
import { TEN_VAI } from '../luat/taiKhoan'
import { useKho } from './khoContext'

interface Props {
  phien: Phien
  hoSo: HoSo
  onDaLuu: (hoSo: HoSo) => void
  onHetPhien: () => void
}

/** Sửa hồ sơ của chính mình: tên hiển thị và GitHub username. */
export function ManHoSo({ phien, hoSo, onDaLuu, onHetPhien }: Props) {
  const kho = useKho()
  const [tenHienThi, setTenHienThi] = useState(hoSo.tenHienThi)
  const [githubUsername, setGithubUsername] = useState(hoSo.githubUsername ?? '')
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [daLuu, setDaLuu] = useState(false)
  const [dangGui, setDangGui] = useState(false)

  async function luu() {
    if (dangGui) return
    setDangGui(true)
    setLoi(null)
    setDaLuu(false)
    const kq = await kho.suaHoSo(phien, hoSo.id, { tenHienThi, githubUsername })
    setDangGui(false)
    if (kq.ok) {
      setTenHienThi(kq.giaTri.tenHienThi)
      setGithubUsername(kq.giaTri.githubUsername ?? '')
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
        <TextInput label="Email" value={hoSo.email} isReadOnly />
        <TextInput label="Vai" value={TEN_VAI[hoSo.vai]} isReadOnly />
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
      </FormLayout>
      <HStack gap={2}>
        <Button label="Lưu hồ sơ" variant="primary" isLoading={dangGui} onClick={luu} />
      </HStack>
    </VStack>
  )
}
