import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { LoiKho } from '../kho/ketQua'
import type { Phien } from '../kho/khoDuLieu'
import { DO_DAI_MAT_KHAU_TOI_THIEU } from '../luat/taiKhoan'
import { useKho } from './khoContext'

type CheDo = 'dangNhap' | 'dangKy'

interface Props {
  onDaDangNhap: (phien: Phien) => void
}

/** Màn đăng nhập và đăng ký cho người chưa có phiên. */
export function ManXacThuc({ onDaDangNhap }: Props) {
  const [cheDo, setCheDo] = useState<CheDo>('dangNhap')
  return (
    <Center padding={6}>
      <Card width="100%" maxWidth={480}>
        {cheDo === 'dangNhap' ? (
          <FormDangNhap onDaDangNhap={onDaDangNhap} onChuyen={() => setCheDo('dangKy')} />
        ) : (
          <FormDangKy onDaDangNhap={onDaDangNhap} onChuyen={() => setCheDo('dangNhap')} />
        )}
      </Card>
    </Center>
  )
}

function trangThaiO(loi: LoiKho | null, o: string) {
  const thongBao = loi?.loiTheoO?.[o]
  return thongBao ? { type: 'error' as const, message: thongBao } : undefined
}

function FormDangNhap({ onDaDangNhap, onChuyen }: Props & { onChuyen: () => void }) {
  const kho = useKho()
  const [email, setEmail] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)

  async function gui() {
    if (dangGui) return
    setDangGui(true)
    setLoi(null)
    const kq = await kho.dangNhap({ email, matKhau })
    setDangGui(false)
    if (kq.ok) onDaDangNhap(kq.giaTri)
    else setLoi(kq.loi)
  }

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={1}>Đăng nhập</Heading>
        <Text color="secondary">Quản lý dự án cho PM và Support.</Text>
      </VStack>
      {loi && <Banner status="error" title={loi.thongBao} role="alert" />}
      <FormLayout>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onEnter={gui}
        />
        <TextInput
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={matKhau}
          onChange={setMatKhau}
          onEnter={gui}
        />
      </FormLayout>
      <VStack gap={2}>
        <Button label="Đăng nhập" variant="primary" isLoading={dangGui} onClick={gui} />
        <Button label="Chưa có tài khoản? Đăng ký" variant="ghost" onClick={onChuyen} />
      </VStack>
    </VStack>
  )
}

function FormDangKy({ onDaDangNhap, onChuyen }: Props & { onChuyen: () => void }) {
  const kho = useKho()
  const [email, setEmail] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [tenHienThi, setTenHienThi] = useState('')
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)

  async function gui() {
    if (dangGui) return
    setDangGui(true)
    setLoi(null)
    const kq = await kho.dangKy({ email, matKhau, tenHienThi })
    if (!kq.ok) {
      setDangGui(false)
      setLoi(kq.loi)
      return
    }
    // Ticket 01: đăng ký xong đăng nhập được ngay (xác nhận email thêm ở ticket 02).
    const phien = await kho.dangNhap({ email, matKhau })
    setDangGui(false)
    if (phien.ok) onDaDangNhap(phien.giaTri)
    else setLoi(phien.loi)
  }

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={1}>Đăng ký</Heading>
        <Text color="secondary">Tạo tài khoản bằng email, mật khẩu và tên hiển thị.</Text>
      </VStack>
      {loi && <Banner status="error" title={loi.thongBao} role="alert" />}
      <FormLayout>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onEnter={gui}
          status={trangThaiO(loi, 'email')}
        />
        <TextInput
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          description={`Ít nhất ${DO_DAI_MAT_KHAU_TOI_THIEU} ký tự.`}
          value={matKhau}
          onChange={setMatKhau}
          onEnter={gui}
          status={trangThaiO(loi, 'matKhau')}
        />
        <TextInput
          label="Tên hiển thị"
          autoComplete="name"
          value={tenHienThi}
          onChange={setTenHienThi}
          onEnter={gui}
          status={trangThaiO(loi, 'tenHienThi')}
        />
      </FormLayout>
      <VStack gap={2}>
        <Button label="Đăng ký" variant="primary" isLoading={dangGui} onClick={gui} />
        <Button label="Đã có tài khoản? Đăng nhập" variant="ghost" onClick={onChuyen} />
      </VStack>
    </VStack>
  )
}
