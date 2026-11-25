// Các màn quanh email và mật khẩu cho người chưa có phiên: chờ xác nhận email, gửi lại thư
// xác nhận, quên mật khẩu và đặt mật khẩu mới. Mỗi màn có trạng thái trống, đang tải và lỗi.
import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { LoiKho } from '../kho/ketQua'
import type { MoPhongThu } from '../kho/khoBoNho'
import { DO_DAI_MAT_KHAU_TOI_THIEU, chuanHoaEmail } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'

const GIO_VIET_NAM = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
})

function TieuDe({ ten, moTa }: { ten: string; moTa: string }) {
  return (
    <VStack gap={1}>
      <Heading level={1}>{ten}</Heading>
      <Text color="secondary">{moTa}</Text>
    </VStack>
  )
}

function BannerLoi({ loi }: { loi: LoiKho | null }) {
  return loi ? <Banner status="error" title={loi.thongBao} role="alert" /> : null
}

function BannerDaGui({ thongBao }: { thongBao: string | null }) {
  return thongBao ? <Banner status="success" title={thongBao} role="status" /> : null
}

/** Trạng thái đang tải khi lệnh đang chạy: có tên đọc được cho trình đọc màn hình. */
function DangTai({ dangChay, nhan }: { dangChay: boolean; nhan: string }) {
  return dangChay ? <Spinner label={nhan} /> : null
}

// ---------------------------------------------------------------------------------------------
// Màn chờ xác nhận

interface PropsChoXacNhan {
  /** Email đang chờ xác nhận; rỗng khi chưa biết email nào (trạng thái trống). */
  email: string
  /** Thông báo chung sau khi gửi lại thư. */
  thongBao: string | null
  moPhong: MoPhongThu | null
  onGuiLai: (email: string) => void
  onDaXacNhan: (thongBao: string) => void
  onVeDangNhap: () => void
}

/** Sau khi đăng ký (hoặc đăng nhập khi chưa xác nhận): nhắc mở thư xác nhận, cho gửi lại thư. */
export function ManChoXacNhan({ email, thongBao, moPhong, onGuiLai, onDaXacNhan, onVeDangNhap }: PropsChoXacNhan) {
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangXacNhan, setDangXacNhan] = useState(false)

  async function xacNhanMoPhong() {
    if (!moPhong || dangXacNhan) return
    setDangXacNhan(true)
    setLoi(null)
    const kq = await moPhong.xacNhanEmail(email)
    setDangXacNhan(false)
    if (kq.ok) onDaXacNhan(kq.giaTri.thongBao)
    else setLoi(kq.loi)
  }

  if (email === '') {
    return (
      <VStack gap={4}>
        <Heading level={1}>Xác nhận email</Heading>
        <EmptyState
          headingLevel={2}
          title="Chưa có email nào đang chờ xác nhận."
          description="Nhập email bạn đã dùng để đăng ký để nhận lại thư xác nhận."
        />
        <VStack gap={2}>
          <Button label="Gửi lại thư xác nhận" variant="primary" onClick={() => onGuiLai('')} />
          <Button label="Về đăng nhập" variant="ghost" onClick={onVeDangNhap} />
        </VStack>
      </VStack>
    )
  }

  return (
    <VStack gap={4}>
      <TieuDe
        ten="Xác nhận email"
        moTa={`Thư xác nhận đã được gửi tới ${email}. Mở thư và bấm đường dẫn trong đó, rồi quay lại đăng nhập.`}
      />
      <BannerDaGui thongBao={thongBao} />
      <BannerLoi loi={loi} />
      {moPhong && (
        <VStack gap={2}>
          <Text color="secondary">
            Bản chạy thử không gửi thư thật. Bấm nút dưới đây thay cho việc bấm đường dẫn trong thư.
          </Text>
          <Button
            label="Xác nhận email (mô phỏng)"
            variant="primary"
            isDisabled={dangXacNhan}
            onClick={xacNhanMoPhong}
          />
          <DangTai dangChay={dangXacNhan} nhan="Đang xác nhận email…" />
        </VStack>
      )}
      <VStack gap={2}>
        <Button
          label="Gửi lại thư xác nhận"
          variant={moPhong ? 'secondary' : 'primary'}
          onClick={() => onGuiLai(email)}
        />
        <Button label="Về đăng nhập" variant="ghost" onClick={onVeDangNhap} />
      </VStack>
    </VStack>
  )
}

// ---------------------------------------------------------------------------------------------
// Màn gửi lại thư xác nhận

interface PropsGuiLai {
  emailBanDau: string
  onDaGui: (email: string, thongBao: string) => void
  onVeDangNhap: () => void
}

/** Gửi lại thư xác nhận: luôn cùng một thông báo, không lộ email có tài khoản hay không. */
export function ManGuiLaiThuXacNhan({ emailBanDau, onDaGui, onVeDangNhap }: PropsGuiLai) {
  const kho = useKho()
  const [email, setEmail] = useState(emailBanDau)
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)

  async function gui() {
    if (dangGui) return
    setDangGui(true)
    setLoi(null)
    const kq = await kho.guiLaiThuXacNhan({ email })
    setDangGui(false)
    if (kq.ok) onDaGui(chuanHoaEmail(email), kq.giaTri.thongBao)
    else setLoi(kq.loi)
  }

  return (
    <VStack gap={4}>
      <TieuDe ten="Gửi lại thư xác nhận" moTa="Nhập email bạn đã dùng để đăng ký, chúng tôi sẽ gửi lại thư xác nhận." />
      <BannerLoi loi={loi} />
      <FormLayout>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          description={email.trim() === '' ? 'Chưa nhập email.' : undefined}
          value={email}
          onChange={setEmail}
          onEnter={gui}
          status={trangThaiO(loi, 'email')}
        />
      </FormLayout>
      <VStack gap={2}>
        <Button label="Gửi lại thư" variant="primary" isDisabled={dangGui} onClick={gui} />
        <DangTai dangChay={dangGui} nhan="Đang gửi lại thư xác nhận…" />
        <Button label="Về đăng nhập" variant="ghost" onClick={onVeDangNhap} />
      </VStack>
    </VStack>
  )
}

// ---------------------------------------------------------------------------------------------
// Màn quên mật khẩu

interface PropsQuenMatKhau {
  emailBanDau: string
  dongHo: () => Date
  onDaGui: (email: string, thongBao: string) => void
  onDaCoMa: (email: string) => void
  onVeDangNhap: () => void
}

/** Yêu cầu mã đặt lại mật khẩu: luôn cùng một thông báo, dù email có tài khoản hay không. */
export function ManQuenMatKhau({ emailBanDau, dongHo, onDaGui, onDaCoMa, onVeDangNhap }: PropsQuenMatKhau) {
  const kho = useKho()
  const [email, setEmail] = useState(emailBanDau)
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)

  async function gui() {
    if (dangGui) return
    setDangGui(true)
    setLoi(null)
    const kq = await kho.yeuCauDatLaiMatKhau({ email }, dongHo())
    setDangGui(false)
    if (kq.ok) onDaGui(chuanHoaEmail(email), kq.giaTri.thongBao)
    else setLoi(kq.loi)
  }

  return (
    <VStack gap={4}>
      <TieuDe
        ten="Quên mật khẩu"
        moTa="Nhập email của tài khoản, chúng tôi sẽ gửi một mã dùng một lần để đặt mật khẩu mới."
      />
      <BannerLoi loi={loi} />
      <FormLayout>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          description={email.trim() === '' ? 'Chưa nhập email.' : undefined}
          value={email}
          onChange={setEmail}
          onEnter={gui}
          status={trangThaiO(loi, 'email')}
        />
      </FormLayout>
      <VStack gap={2}>
        <Button label="Gửi mã đặt lại" variant="primary" isDisabled={dangGui} onClick={gui} />
        <DangTai dangChay={dangGui} nhan="Đang gửi mã đặt lại…" />
        <Button label="Đã có mã? Đặt mật khẩu mới" variant="ghost" onClick={() => onDaCoMa(email)} />
        <Button label="Về đăng nhập" variant="ghost" onClick={onVeDangNhap} />
      </VStack>
    </VStack>
  )
}

// ---------------------------------------------------------------------------------------------
// Màn đặt mật khẩu mới

interface PropsDatLai {
  emailBanDau: string
  /** Thông báo chung sau khi yêu cầu mã. */
  thongBao: string | null
  moPhong: MoPhongThu | null
  dongHo: () => Date
  onDaDatLai: (email: string, thongBao: string) => void
  onYeuCauMaMoi: (email: string) => void
  onVeDangNhap: () => void
}

/** Nhập mã trong thư cùng mật khẩu mới. */
export function ManDatLaiMatKhau({
  emailBanDau,
  thongBao,
  moPhong,
  dongHo,
  onDaDatLai,
  onYeuCauMaMoi,
  onVeDangNhap,
}: PropsDatLai) {
  const kho = useKho()
  const [email, setEmail] = useState(emailBanDau)
  const [ma, setMa] = useState('')
  const [matKhauMoi, setMatKhauMoi] = useState('')
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)

  async function gui() {
    if (dangGui) return
    setDangGui(true)
    setLoi(null)
    const kq = await kho.datLaiMatKhau({ email, ma, matKhauMoi }, dongHo())
    setDangGui(false)
    if (kq.ok) onDaDatLai(chuanHoaEmail(email), kq.giaTri.thongBao)
    else setLoi(kq.loi)
  }

  return (
    <VStack gap={4}>
      <TieuDe ten="Đặt mật khẩu mới" moTa="Nhập mã trong thư đặt lại mật khẩu và mật khẩu mới của bạn." />
      <BannerDaGui thongBao={loi ? null : thongBao} />
      <BannerLoi loi={loi} />
      {moPhong && <ThuDatLaiMoPhong moPhong={moPhong} email={emailBanDau} />}
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
          label="Mã đặt lại"
          autoComplete="one-time-code"
          hasAutoCorrect={false}
          hasSpellCheck={false}
          autoCapitalize="none"
          description={ma.trim() === '' ? 'Chưa nhập mã. Mã nằm trong thư đặt lại mật khẩu.' : undefined}
          value={ma}
          onChange={setMa}
          onEnter={gui}
          status={trangThaiO(loi, 'ma')}
        />
        <TextInput
          label="Mật khẩu mới"
          type="password"
          autoComplete="new-password"
          description={`Ít nhất ${DO_DAI_MAT_KHAU_TOI_THIEU} ký tự.`}
          value={matKhauMoi}
          onChange={setMatKhauMoi}
          onEnter={gui}
          status={trangThaiO(loi, 'matKhauMoi')}
        />
      </FormLayout>
      <VStack gap={2}>
        <Button label="Đặt mật khẩu mới" variant="primary" isDisabled={dangGui} onClick={gui} />
        <DangTai dangChay={dangGui} nhan="Đang đặt mật khẩu mới…" />
        <Button label="Yêu cầu mã mới" variant="ghost" onClick={() => onYeuCauMaMoi(email)} />
        <Button label="Về đăng nhập" variant="ghost" onClick={onVeDangNhap} />
      </VStack>
    </VStack>
  )
}

/** Bản chạy thử không gửi thư thật: hiện mã trong thư đặt lại mới nhất ngay trên màn. */
function ThuDatLaiMoPhong({ moPhong, email }: { moPhong: MoPhongThu; email: string }) {
  const thuDatLai = moPhong.thuGuiToi(email).filter((thu) => thu.loai === 'DAT_LAI_MAT_KHAU')
  const moiNhat = thuDatLai[thuDatLai.length - 1]
  if (!moiNhat || moiNhat.loai !== 'DAT_LAI_MAT_KHAU') {
    return <Text color="secondary">Bản chạy thử không gửi thư thật. Chưa có thư đặt lại nào cho email này.</Text>
  }
  return (
    <Text color="secondary">
      {`Bản chạy thử không gửi thư thật. Mã trong thư mới nhất: ${moiNhat.ma} (hết hạn lúc ${GIO_VIET_NAM.format(moiNhat.hetHanLuc)}).`}
    </Text>
  )
}
