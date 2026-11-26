import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { LoiKho } from '../kho/ketQua'
import type { DuAn, Phien } from '../kho/khoDuLieu'
import { DO_DAI_TEN_DU_AN_TOI_DA } from '../luat/duAn'
import { useKho } from './khoContext'
import { NganTruot } from './NganTruot'
import { trangThaiO } from './trangThaiO'
import { useLanMoNgan } from './useLanMoNgan'

const TIEU_DE_TAO = 'Tạo Dự án'
const TIEU_DE_SUA = 'Sửa Dự án'

/** Lỗi của Kho cho thấy Dự án hay quyền đã đổi ở nơi khác: trang phía sau cần đọc lại. */
const LOI_CAN_DOC_LAI: ReadonlyArray<LoiKho['ma']> = ['DU_AN_DA_LUU_TRU', 'DU_AN_DANG_HOAT_DONG', 'KHONG_CO_QUYEN']

interface PropsTruong {
  ten: string
  moTa: string
  onDoiTen: (ten: string) => void
  onDoiMoTa: (moTa: string) => void
  onLuu: () => void
  loi: LoiKho | null
  moTaMoTa: string
  /** Lý do không ghi được (cùng luật với Kho); có thì ô bị vô hiệu kèm lý do. */
  lyDoKhongGhi?: string | null
}

/** Hai ô của một Dự án: tên bắt buộc, mô tả tuỳ chọn; lỗi của Kho hiện cạnh ô tương ứng. */
function TruongDuAn({ ten, moTa, onDoiTen, onDoiMoTa, onLuu, loi, moTaMoTa, lyDoKhongGhi = null }: PropsTruong) {
  return (
    <FormLayout>
      <TextInput
        label="Tên Dự án"
        description={`Bắt buộc, tối đa ${DO_DAI_TEN_DU_AN_TOI_DA} ký tự.`}
        autoComplete="off"
        value={ten}
        onChange={onDoiTen}
        onEnter={lyDoKhongGhi === null ? onLuu : undefined}
        isDisabled={lyDoKhongGhi !== null}
        disabledMessage={lyDoKhongGhi ?? undefined}
        status={trangThaiO(loi, 'ten')}
      />
      <TextArea
        label="Mô tả"
        description={moTaMoTa}
        value={moTa}
        onChange={onDoiMoTa}
        isDisabled={lyDoKhongGhi !== null}
        disabledMessage={lyDoKhongGhi ?? undefined}
        status={trangThaiO(loi, 'moTa')}
      />
    </FormLayout>
  )
}

/** Hàng nút ở chân ngăn: Huỷ, và nút lưu khi được lưu. */
function ChanBieuMau({ nhanLuu, dangGui, onLuu, onHuy }: { nhanLuu: string | null; dangGui: boolean; onLuu: () => void; onHuy: () => void }) {
  return (
    <HStack gap={2} hAlign="end">
      <Button label="Huỷ" variant="secondary" onClick={onHuy} />
      {nhanLuu !== null && <Button label={nhanLuu} variant="primary" isLoading={dangGui} onClick={onLuu} />}
    </HStack>
  )
}

interface PropsTao {
  /** Ngăn đang mở; mỗi lần mở là một biểu mẫu trống mới. */
  isOpen: boolean
  phien: Phien
  dongHo: () => Date
  /** Huỷ, Esc hoặc nút đóng: đóng ngăn, không tạo gì. */
  onDong: () => void
  /** Kho đã tạo Dự án: nơi gọi đóng ngăn và đọc lại danh sách. */
  onDaTao: (duAn: DuAn) => void
  /** Ngăn đã trượt ra hẳn và focus đã về nút mở ngăn. */
  onDaDongXong?: () => void
  onHetPhien: () => void
}

/**
 * Tạo Dự án trong Ngăn trượt: tên bắt buộc, mô tả tuỳ chọn. Nơi gọi chỉ hiện nút mở ngăn cho người
 * được tạo Dự án (PM); Kho vẫn tự kiểm quyền. Lỗi hiện cạnh ô và ngăn vẫn mở.
 */
export function NganTruotTaoDuAn(props: PropsTao) {
  const lanMo = useLanMoNgan(props.isOpen)
  if (lanMo === 0) return null
  return <BieuMauTaoDuAn key={lanMo} {...props} />
}

function BieuMauTaoDuAn({ isOpen, phien, dongHo, onDong, onDaTao, onDaDongXong, onHetPhien }: PropsTao) {
  const kho = useKho()
  const [ten, setTen] = useState('')
  const [moTa, setMoTa] = useState('')
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)

  async function tao() {
    if (dangGui) return
    setDangGui(true)
    setLoi(null)
    const kq = await kho.taoDuAn(phien, { ten, moTa }, dongHo())
    setDangGui(false)
    if (kq.ok) onDaTao(kq.giaTri)
    else if (kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
    else setLoi(kq.loi)
  }

  return (
    <NganTruot
      isOpen={isOpen}
      tieuDe={TIEU_DE_TAO}
      onDong={onDong}
      onDaDongXong={onDaDongXong}
      laBieuMau
      chan={<ChanBieuMau nhanLuu={TIEU_DE_TAO} dangGui={dangGui} onLuu={tao} onHuy={onDong} />}
    >
      <VStack gap={4}>
        {loi && <Banner status="error" title="Chưa tạo được Dự án." description={loi.thongBao} role="alert" />}
        <TruongDuAn
          ten={ten}
          moTa={moTa}
          onDoiTen={setTen}
          onDoiMoTa={setMoTa}
          onLuu={tao}
          loi={loi}
          moTaMoTa="Tuỳ chọn."
        />
      </VStack>
    </NganTruot>
  )
}

interface PropsSua {
  /** Ngăn đang mở; mỗi lần mở biểu mẫu lấy lại tên và mô tả đang có của Dự án. */
  isOpen: boolean
  phien: Phien
  duAn: DuAn
  /** Lý do không sửa được (cùng luật với Kho); có thì ngăn chỉ nói lý do, không có nút lưu. */
  lyDoKhongSua: string | null
  dongHo: () => Date
  /** Huỷ, Esc hoặc nút đóng: đóng ngăn, không lưu gì. */
  onDong: () => void
  /** Kho đã lưu: nơi gọi đóng ngăn và hiện Dự án mới. */
  onDaLuu: (duAn: DuAn) => void
  /** Dự án hay quyền đã đổi ở nơi khác (Kho từ chối): trang phía sau đọc lại. */
  onCanDocLai: () => void
  onHetPhien: () => void
}

/** Sửa tên và mô tả của Dự án trong Ngăn trượt, mở từ tab Thông tin. */
export function NganTruotSuaDuAn(props: PropsSua) {
  const lanMo = useLanMoNgan(props.isOpen)
  if (lanMo === 0) return null
  return <BieuMauSuaDuAn key={lanMo} {...props} />
}

function BieuMauSuaDuAn({ isOpen, phien, duAn, lyDoKhongSua, dongHo, onDong, onDaLuu, onCanDocLai, onHetPhien }: PropsSua) {
  const kho = useKho()
  const [ten, setTen] = useState(duAn.ten)
  const [moTa, setMoTa] = useState(duAn.moTa)
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)

  async function luu() {
    if (dangGui || lyDoKhongSua !== null) return
    setDangGui(true)
    setLoi(null)
    const kq = await kho.suaDuAn(phien, duAn.id, { ten, moTa }, dongHo())
    setDangGui(false)
    if (kq.ok) {
      onDaLuu(kq.giaTri)
      return
    }
    if (kq.loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
      return
    }
    setLoi(kq.loi)
    if (LOI_CAN_DOC_LAI.includes(kq.loi.ma)) onCanDocLai()
  }

  return (
    <NganTruot
      isOpen={isOpen}
      tieuDe={TIEU_DE_SUA}
      phuDe={duAn.ten}
      onDong={onDong}
      laBieuMau
      chan={
        <ChanBieuMau
          nhanLuu={lyDoKhongSua === null ? 'Lưu thay đổi' : null}
          dangGui={dangGui}
          onLuu={luu}
          onHuy={onDong}
        />
      }
    >
      <VStack gap={4}>
        {loi && <Banner status="error" title="Chưa lưu được thay đổi." description={loi.thongBao} role="alert" />}
        {lyDoKhongSua !== null && <Banner status="info" title={lyDoKhongSua} role="status" />}
        <TruongDuAn
          ten={ten}
          moTa={moTa}
          onDoiTen={setTen}
          onDoiMoTa={setMoTa}
          onLuu={luu}
          loi={loi}
          moTaMoTa="Tuỳ chọn. Để trống để xoá mô tả."
          lyDoKhongGhi={lyDoKhongSua}
        />
      </VStack>
    </NganTruot>
  )
}
