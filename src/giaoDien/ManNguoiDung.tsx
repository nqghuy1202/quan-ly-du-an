import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { NguoiDungTomTat, Phien } from '../kho/khoDuLieu'
import { CAC_VAI, TEN_VAI, xepTheoTen, type VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'

interface Props {
  phien: Phien
  onHetPhien: () => void
  /** Gọi khi PM vừa đổi vai của chính mình, để khung cập nhật vai và mục điều hướng. */
  onVaiCuaToiDoi: (vai: VaiHeThong) => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = {
  id: string
  tenHienThi: string
  email: string
  vai: VaiHeThong
}

type ThongBaoDoiVai =
  | { loai: 'thanhCong'; noiDung: string }
  | { loai: 'loi'; tieuDe: string; noiDung: string }

function laVai(giaTri: string): giaTri is VaiHeThong {
  return (CAC_VAI as readonly string[]).includes(giaTri)
}

/** Màn Người dùng của PM: mọi tài khoản (tên, email, vai) và đổi vai hệ thống. */
export function ManNguoiDung({ phien, onHetPhien, onVaiCuaToiDoi }: Props) {
  const kho = useKho()
  const [tai, setTai] = useState<KetQua<NguoiDungTomTat[]> | null>(null)
  const [lanTai, setLanTai] = useState(0)
  const [dangDoiId, setDangDoiId] = useState<string | null>(null)
  const dangGuiRef = useRef(false)
  const [thongBao, setThongBao] = useState<ThongBaoDoiVai | null>(null)

  useEffect(() => {
    let huy = false
    kho.danhSachNguoiDung(phien).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setTai(kq)
    })
    return () => {
      huy = true
    }
  }, [kho, phien, lanTai, onHetPhien])

  function taiLai() {
    setTai(null)
    setLanTai((n) => n + 1)
  }

  async function doiVai(nguoiDung: Dong, vaiMoi: string) {
    // Bấm chuột vào một vai báo chọn hai lần (khi nhận focus và khi bấm) trước khi kịp vẽ lại,
    // nên chặn lệnh trùng bằng ref chứ không bằng state.
    if (dangGuiRef.current || !laVai(vaiMoi) || vaiMoi === nguoiDung.vai) return
    dangGuiRef.current = true
    setDangDoiId(nguoiDung.id)
    setThongBao(null)
    const kq = await kho.doiVai(phien, nguoiDung.id, { vai: vaiMoi })
    dangGuiRef.current = false
    setDangDoiId(null)
    if (kq.ok) {
      const moi = kq.giaTri
      setTai((cu) =>
        cu && cu.ok ? { ok: true, giaTri: cu.giaTri.map((nd) => (nd.id === moi.id ? moi : nd)) } : cu,
      )
      setThongBao({
        loai: 'thanhCong',
        noiDung: `Đã đổi vai của ${moi.tenHienThi} thành ${TEN_VAI[moi.vai]}.`,
      })
      if (moi.id === phien.nguoiDungId) onVaiCuaToiDoi(moi.vai)
    } else if (kq.loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
    } else {
      setThongBao({
        loai: 'loi',
        tieuDe: `Không đổi được vai của ${nguoiDung.tenHienThi}.`,
        noiDung: kq.loi.thongBao,
      })
    }
  }

  const cot: TableColumn<Dong>[] = [
    {
      key: 'tenHienThi',
      header: 'Tên',
      width: proportional(1),
      renderCell: (nd) => <Text weight="semibold">{nd.tenHienThi}</Text>,
    },
    {
      key: 'email',
      header: 'Email',
      width: proportional(1),
      renderCell: (nd) => <Text>{nd.email}</Text>,
    },
    {
      key: 'vai',
      header: 'Vai',
      width: proportional(2),
      renderCell: (nd) => (
        <SegmentedControl
          label={`Vai của ${nd.tenHienThi}`}
          size="sm"
          value={nd.vai}
          isDisabled={dangDoiId === nd.id}
          onChange={(vai) => doiVai(nd, vai)}
        >
          {CAC_VAI.map((vai) => (
            <SegmentedControlItem key={vai} value={vai} label={TEN_VAI[vai]} />
          ))}
        </SegmentedControl>
      ),
    },
  ]

  let noiDung: ReactNode
  if (tai === null) {
    noiDung = <Spinner label="Đang tải danh sách người dùng…" />
  } else if (!tai.ok) {
    noiDung = (
      <Banner
        status="error"
        title="Không tải được danh sách người dùng."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={taiLai} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    noiDung = (
      <EmptyState
        headingLevel={3}
        title="Chưa có tài khoản nào."
        description="Khi có người đăng ký, tài khoản của họ sẽ hiện ở đây để bạn đặt vai."
      />
    )
  } else {
    const dong: Dong[] = xepTheoTen(tai.giaTri).map(({ id, tenHienThi, email, vai }) => ({
      id,
      tenHienThi,
      email,
      vai,
    }))
    noiDung = <Table aria-label="Danh sách người dùng" data={dong} columns={cot} idKey="id" />
  }

  return (
    <VStack gap={4}>
      <Heading level={2}>Người dùng</Heading>
      <Text>Đổi vai hệ thống của mỗi tài khoản giữa PM, Support và Thành viên. Hệ thống luôn giữ ít nhất một PM.</Text>
      {thongBao?.loai === 'loi' && (
        <Banner status="error" title={thongBao.tieuDe} description={thongBao.noiDung} role="alert" />
      )}
      {thongBao?.loai === 'thanhCong' && <Banner status="success" title={thongBao.noiDung} role="status" />}
      {noiDung}
    </VStack>
  )
}
