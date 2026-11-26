import { useState, type ReactNode } from 'react'
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
import type { MoPhongThu } from '../kho/khoBoNho'
import { DO_DAI_MAT_KHAU_TOI_THIEU } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'
import { ThuongHieu } from './ThuongHieu'
import { ManChoXacNhan, ManDatLaiMatKhau, ManGuiLaiThuXacNhan, ManQuenMatKhau } from './ManEmailVaMatKhau'

/** Màn đang hiện cho người chưa có phiên, kèm dữ liệu chuyển giữa các màn. */
type Man =
  | { loai: 'dangNhap'; email: string; thongBao: string | null }
  | { loai: 'dangKy' }
  | { loai: 'choXacNhan'; email: string; thongBao: string | null }
  | { loai: 'guiLai'; email: string }
  | { loai: 'quenMatKhau'; email: string }
  | { loai: 'datLai'; email: string; thongBao: string | null }

/**
 * Bề rộng tối đa của biểu mẫu, tính theo cỡ chữ gốc (`rem`), không dùng `px` rời:
 * co giãn theo cỡ chữ người dùng chọn. Astryx không có token bề rộng cho khung biểu mẫu.
 */
const DO_RONG_BIEU_MAU = '30rem'

interface Props {
  onDaDangNhap: (phien: Phien) => void
  /** Hộp thư mô phỏng của bản bộ nhớ; null khi Kho gửi thư thật. */
  moPhong: MoPhongThu | null
  /** Đồng hồ cho hạn của mã đặt lại mật khẩu. */
  dongHo: () => Date
}

/** Các màn cho người chưa có phiên: đăng nhập, đăng ký, xác nhận email, quên và đặt lại mật khẩu. */
export function ManXacThuc({ onDaDangNhap, moPhong, dongHo }: Props) {
  const [man, setMan] = useState<Man>({ loai: 'dangNhap', email: '', thongBao: null })
  const veDangNhap = (email = '', thongBao: string | null = null) => setMan({ loai: 'dangNhap', email, thongBao })

  let noiDung: ReactNode = null
  switch (man.loai) {
    case 'dangNhap':
      noiDung = (
        <FormDangNhap
          emailBanDau={man.email}
          thongBao={man.thongBao}
          onDaDangNhap={onDaDangNhap}
          onDangKy={() => setMan({ loai: 'dangKy' })}
          onQuenMatKhau={(email) => setMan({ loai: 'quenMatKhau', email })}
          onGuiLaiThu={(email) => setMan({ loai: 'guiLai', email })}
        />
      )
      break
    case 'dangKy':
      noiDung = (
        <FormDangKy
          onDaDangKy={(email) => setMan({ loai: 'choXacNhan', email, thongBao: null })}
          onDangNhap={() => veDangNhap()}
        />
      )
      break
    case 'choXacNhan':
      noiDung = (
        <ManChoXacNhan
          email={man.email}
          thongBao={man.thongBao}
          moPhong={moPhong}
          onGuiLai={(email) => setMan({ loai: 'guiLai', email })}
          onDaXacNhan={(thongBao) => veDangNhap(man.email, thongBao)}
          onVeDangNhap={() => veDangNhap(man.email)}
        />
      )
      break
    case 'guiLai':
      noiDung = (
        <ManGuiLaiThuXacNhan
          emailBanDau={man.email}
          onDaGui={(email, thongBao) => setMan({ loai: 'choXacNhan', email, thongBao })}
          onVeDangNhap={() => veDangNhap(man.email)}
        />
      )
      break
    case 'quenMatKhau':
      noiDung = (
        <ManQuenMatKhau
          emailBanDau={man.email}
          dongHo={dongHo}
          onDaGui={(email, thongBao) => setMan({ loai: 'datLai', email, thongBao })}
          onDaCoMa={(email) => setMan({ loai: 'datLai', email, thongBao: null })}
          onVeDangNhap={() => veDangNhap(man.email)}
        />
      )
      break
    case 'datLai':
      noiDung = (
        <ManDatLaiMatKhau
          emailBanDau={man.email}
          thongBao={man.thongBao}
          moPhong={moPhong}
          dongHo={dongHo}
          onDaDatLai={(email, thongBao) => veDangNhap(email, thongBao)}
          onYeuCauMaMoi={(email) => setMan({ loai: 'quenMatKhau', email })}
          onVeDangNhap={() => veDangNhap(man.email)}
        />
      )
      break
  }

  return (
    <Center padding={6}>
      <Card width="100%" maxWidth={DO_RONG_BIEU_MAU}>
        <VStack gap={4}>
          <ThuongHieu laTieuDeTrang={false} />
          {noiDung}
        </VStack>
      </Card>
    </Center>
  )
}

interface PropsDangNhap {
  emailBanDau: string
  /** Thông báo thành công từ màn trước (đã xác nhận email, đã đặt mật khẩu mới). */
  thongBao: string | null
  onDaDangNhap: (phien: Phien) => void
  onDangKy: () => void
  onQuenMatKhau: (email: string) => void
  onGuiLaiThu: (email: string) => void
}

function FormDangNhap({ emailBanDau, thongBao, onDaDangNhap, onDangKy, onQuenMatKhau, onGuiLaiThu }: PropsDangNhap) {
  const kho = useKho()
  const [email, setEmail] = useState(emailBanDau)
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
      {thongBao && !loi && <Banner status="success" title={thongBao} role="status" />}
      {loi && (
        <Banner
          status="error"
          title={loi.thongBao}
          role="alert"
          endContent={
            loi.ma === 'EMAIL_CHUA_XAC_NHAN' ? (
              <Button label="Gửi lại thư xác nhận" variant="secondary" onClick={() => onGuiLaiThu(email)} />
            ) : undefined
          }
        />
      )}
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
        <Button label="Chưa có tài khoản? Đăng ký" variant="ghost" onClick={onDangKy} />
        <Button label="Quên mật khẩu?" variant="ghost" onClick={() => onQuenMatKhau(email)} />
      </VStack>
    </VStack>
  )
}

interface PropsDangKy {
  /** Đăng ký xong: email đã chuẩn hoá, chờ xác nhận. */
  onDaDangKy: (email: string) => void
  onDangNhap: () => void
}

function FormDangKy({ onDaDangKy, onDangNhap }: PropsDangKy) {
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
    setDangGui(false)
    // Đăng ký xong phải xác nhận email trước khi đăng nhập được.
    if (kq.ok) onDaDangKy(kq.giaTri.email)
    else setLoi(kq.loi)
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
        <Button label="Đã có tài khoản? Đăng nhập" variant="ghost" onClick={onDangNhap} />
      </VStack>
    </VStack>
  )
}
