import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { DateInput, type DateInputProps } from '@astryxdesign/core/DateInput'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { Selector } from '@astryxdesign/core/Selector'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { THONG_BAO_MAC_DINH, type KetQua, type LoiKho } from '../kho/ketQua'
import type { DuAn, NguoiTrongDuAn, Phien } from '../kho/khoDuLieu'
import {
  DO_DAI_KHACH_HANG_TOI_DA,
  DO_DAI_MA_DU_AN_TOI_DA,
  DO_DAI_MA_DU_AN_TOI_THIEU,
  DO_DAI_TEN_DU_AN_TOI_DA,
  THONG_BAO_DU_AN,
  tenKemMa,
} from '../luat/duAn'
import { MUC_UU_TIEN_MAC_DINH, laMucUuTien, type MucUuTien } from '../luat/mucUuTien'
import { LUA_CHON_MUC_UU_TIEN } from './mauMucUuTien'
import { xepTheoTen } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { NganTruot } from './NganTruot'
import { trangThaiO } from './trangThaiO'
import { useLanMoNgan } from './useLanMoNgan'

const TIEU_DE_TAO = 'Tạo Dự án'
const TIEU_DE_SUA = 'Sửa Dự án'

/** Ngày `YYYY-MM-DD` như DateInput của Astryx nhận và trả. */
type NgayISO = NonNullable<DateInputProps['value']>

/** Các ô của biểu mẫu Dự án; ngày chưa chọn là undefined. */
interface GiaTriDuAn {
  ma: string
  ten: string
  khachHang: string
  moTa: string
  ngayBatDau: NgayISO | undefined
  ngayKetThucDuKien: NgayISO | undefined
  mucUuTien: MucUuTien
}

/** Giá trị của lựa chọn "Chưa có" trong ô Người phụ trách (không trùng id tài khoản nào). */
const CHUA_CO_PHU_TRACH = 'chua-co-nguoi-phu-trach'

const LUA_CHON_CHUA_CO = { value: CHUA_CO_PHU_TRACH, label: 'Chưa có' }

type ONgay = 'ngayBatDau' | 'ngayKetThucDuKien'

/** Ô ngày đang chứa chữ gõ tay mà DateInput không đọc được thành một ngày có thật. */
type LoiNhapNgay = Record<ONgay, boolean>

const CHUA_CO_LOI_NHAP: LoiNhapNgay = { ngayBatDau: false, ngayKetThucDuKien: false }

const THONG_BAO_NGAY_SAI: Record<ONgay, string> = {
  ngayBatDau: THONG_BAO_DU_AN.ngayBatDauSai,
  ngayKetThucDuKien: THONG_BAO_DU_AN.ngayKetThucSai,
}

/**
 * Lỗi chặn gửi khi một ô ngày còn chữ gõ tay chưa đọc được (giống ô Hạn của Task); null nếu không có.
 * Kho không nhận được chữ đó nên phải báo ở đây, cạnh ô.
 */
function loiNhapNgay(loiNhap: LoiNhapNgay): LoiKho | null {
  const loiTheoO: Record<string, string> = {}
  for (const o of ['ngayBatDau', 'ngayKetThucDuKien'] as const) if (loiNhap[o]) loiTheoO[o] = THONG_BAO_NGAY_SAI[o]
  return Object.keys(loiTheoO).length === 0 ? null : { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO }
}

/** Dữ liệu gửi Kho: ngày chưa chọn là null (không có ngày, hoặc xoá ngày khi sửa). */
function dauVaoDuAn(giaTri: GiaTriDuAn) {
  return { ...giaTri, ngayBatDau: giaTri.ngayBatDau ?? null, ngayKetThucDuKien: giaTri.ngayKetThucDuKien ?? null }
}

/** Lỗi của Kho cho thấy Dự án hay quyền đã đổi ở nơi khác: trang phía sau cần đọc lại. */
const LOI_CAN_DOC_LAI: ReadonlyArray<LoiKho['ma']> = ['DU_AN_DA_LUU_TRU', 'DU_AN_DANG_HOAT_DONG', 'KHONG_CO_QUYEN']

interface PropsTruong {
  giaTri: GiaTriDuAn
  onDoi: (giaTri: GiaTriDuAn) => void
  onLuu: () => void
  loi: LoiKho | null
  loiNhap: LoiNhapNgay
  onLoiNhap: (loiNhap: LoiNhapNgay) => void
  moTaMoTa: string
  /** Lý do không ghi được (cùng luật với Kho); có thì ô bị vô hiệu kèm lý do. */
  lyDoKhongGhi?: string | null
  /** Ô chọn Người phụ trách (luôn có lựa chọn "Chưa có", rồi Người trong dự án). */
  oPhuTrach: OPhuTrach
}

/** Ô chọn Người phụ trách: giá trị đang chọn, lựa chọn, mô tả, và lý do khoá ô (nếu có). */
interface OPhuTrach {
  giaTri: string
  onDoi: (giaTri: string) => void
  luaChon: { value: string; label: string }[]
  moTa: string
  dangTai?: boolean
  lyDoKhoa?: string | null
}

/**
 * Các ô của một Dự án: Mã và tên bắt buộc; Khách hàng, hai ngày, mô tả tuỳ chọn. Lỗi của Kho (sai dạng,
 * Mã trùng, Ngày kết thúc dự kiến trước Ngày bắt đầu) hiện cạnh ô tương ứng.
 */
function TruongDuAn({ giaTri, onDoi, onLuu, loi, loiNhap, onLoiNhap, moTaMoTa, lyDoKhongGhi = null, oPhuTrach }: PropsTruong) {
  const lyDoKhoaPhuTrach = lyDoKhongGhi ?? oPhuTrach.lyDoKhoa ?? null
  const onEnter = lyDoKhongGhi === null ? onLuu : undefined
  const oNgay = (o: ONgay, label: string, description: string) => (
    <DateInput
      label={label}
      description={description}
      placeholder="Chọn ngày"
      format="system_date"
      hasClear
      value={giaTri[o]}
      onChange={(ngay) => onDoi({ ...giaTri, [o]: ngay })}
      onEntryErrorChange={(loiGo) => onLoiNhap({ ...loiNhap, [o]: loiGo !== null })}
      isDisabled={lyDoKhongGhi !== null}
      disabledMessage={lyDoKhongGhi ?? undefined}
      status={loiNhap[o] ? { type: 'error', message: THONG_BAO_NGAY_SAI[o] } : trangThaiO(loi, o)}
    />
  )
  return (
    <FormLayout>
      <TextInput
        label="Mã Dự án"
        description={`Bắt buộc, duy nhất, ${DO_DAI_MA_DU_AN_TOI_THIEU} đến ${DO_DAI_MA_DU_AN_TOI_DA} ký tự gồm chữ in hoa không dấu, chữ số, gạch nối (vd SDV-012). Chữ thường được đổi sang in hoa.`}
        autoComplete="off"
        autoCapitalize="characters"
        value={giaTri.ma}
        onChange={(ma) => onDoi({ ...giaTri, ma })}
        onEnter={onEnter}
        isDisabled={lyDoKhongGhi !== null}
        disabledMessage={lyDoKhongGhi ?? undefined}
        status={trangThaiO(loi, 'ma')}
      />
      <TextInput
        label="Tên Dự án"
        description={`Bắt buộc, tối đa ${DO_DAI_TEN_DU_AN_TOI_DA} ký tự.`}
        autoComplete="off"
        value={giaTri.ten}
        onChange={(ten) => onDoi({ ...giaTri, ten })}
        onEnter={onEnter}
        isDisabled={lyDoKhongGhi !== null}
        disabledMessage={lyDoKhongGhi ?? undefined}
        status={trangThaiO(loi, 'ten')}
      />
      <TextInput
        label="Khách hàng"
        description={`Tuỳ chọn, tối đa ${DO_DAI_KHACH_HANG_TOI_DA} ký tự.`}
        autoComplete="off"
        value={giaTri.khachHang}
        onChange={(khachHang) => onDoi({ ...giaTri, khachHang })}
        onEnter={onEnter}
        isDisabled={lyDoKhongGhi !== null}
        disabledMessage={lyDoKhongGhi ?? undefined}
        status={trangThaiO(loi, 'khachHang')}
      />
      <Selector
        label="Mức ưu tiên"
        description="Thấp, Trung bình hoặc Cao. Không chọn thì là Trung bình."
        options={LUA_CHON_MUC_UU_TIEN}
        value={giaTri.mucUuTien}
        onChange={(muc) => {
          if (laMucUuTien(muc)) onDoi({ ...giaTri, mucUuTien: muc })
        }}
        isDisabled={lyDoKhongGhi !== null}
        disabledMessage={lyDoKhongGhi ?? undefined}
        status={trangThaiO(loi, 'mucUuTien')}
      />
      <Selector
        label="Người phụ trách"
        description={oPhuTrach.moTa}
        options={oPhuTrach.luaChon}
        value={oPhuTrach.giaTri}
        onChange={(id) => oPhuTrach.onDoi(id ?? CHUA_CO_PHU_TRACH)}
        isLoading={oPhuTrach.dangTai === true}
        isDisabled={lyDoKhoaPhuTrach !== null}
        disabledMessage={lyDoKhoaPhuTrach ?? undefined}
        status={trangThaiO(loi, 'nguoiPhuTrachId')}
      />
      {oNgay('ngayBatDau', 'Ngày bắt đầu', 'Tuỳ chọn. Một ngày, không có giờ.')}
      {oNgay(
        'ngayKetThucDuKien',
        'Ngày kết thúc dự kiến',
        'Tuỳ chọn. Một ngày, không có giờ; không được trước Ngày bắt đầu.',
      )}
      <TextArea
        label="Mô tả"
        description={moTaMoTa}
        value={giaTri.moTa}
        onChange={(moTa) => onDoi({ ...giaTri, moTa })}
        isDisabled={lyDoKhongGhi !== null}
        disabledMessage={lyDoKhongGhi ?? undefined}
        status={trangThaiO(loi, 'moTa')}
      />
    </FormLayout>
  )
}

const CHUA_TAI_DUOC_NGUOI = 'Chưa tải được người trong dự án nên chưa chọn được Người phụ trách.'

/**
 * Lựa chọn của ô Người phụ trách: "Chưa có", rồi Người trong dự án xếp theo tên. Chưa tải xong danh sách thì
 * vẫn giữ Người phụ trách đang có làm một lựa chọn, để ô hiện đúng tên (chỉ gửi Kho khi người dùng đổi ô).
 */
function luaChonPhuTrach(nguoiTrongDuAn: KetQua<NguoiTrongDuAn[]> | null, dangCo: DuAn['nguoiPhuTrach']) {
  const nguoi = nguoiTrongDuAn?.ok ? xepTheoTen(nguoiTrongDuAn.giaTri) : []
  const luaChon = [LUA_CHON_CHUA_CO, ...nguoi.map((n) => ({ value: n.id, label: `${n.tenHienThi} (${n.email})` }))]
  if (dangCo && !nguoi.some((n) => n.id === dangCo.id)) luaChon.push({ value: dangCo.id, label: dangCo.tenHienThi })
  return luaChon
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
 * Tạo Dự án trong Ngăn trượt: Mã và tên bắt buộc; Khách hàng, hai ngày, mô tả tuỳ chọn. Nơi gọi chỉ hiện nút mở ngăn cho người
 * được tạo Dự án (PM); Kho vẫn tự kiểm quyền. Lỗi hiện cạnh ô và ngăn vẫn mở.
 */
export function NganTruotTaoDuAn(props: PropsTao) {
  const lanMo = useLanMoNgan(props.isOpen)
  if (lanMo === 0) return null
  return <BieuMauTaoDuAn key={lanMo} {...props} />
}

function BieuMauTaoDuAn({ isOpen, phien, dongHo, onDong, onDaTao, onDaDongXong, onHetPhien }: PropsTao) {
  const kho = useKho()
  const [giaTri, setGiaTri] = useState<GiaTriDuAn>({
    ma: '',
    ten: '',
    khachHang: '',
    moTa: '',
    ngayBatDau: undefined,
    ngayKetThucDuKien: undefined,
    mucUuTien: MUC_UU_TIEN_MAC_DINH,
  })
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [loiNhap, setLoiNhap] = useState<LoiNhapNgay>(CHUA_CO_LOI_NHAP)
  const [dangGui, setDangGui] = useState(false)

  async function tao() {
    if (dangGui) return
    const loiNgay = loiNhapNgay(loiNhap)
    if (loiNgay) {
      setLoi(loiNgay)
      return
    }
    setDangGui(true)
    setLoi(null)
    const kq = await kho.taoDuAn(phien, dauVaoDuAn(giaTri), dongHo())
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
          giaTri={giaTri}
          onDoi={setGiaTri}
          onLuu={tao}
          loi={loi}
          loiNhap={loiNhap}
          onLoiNhap={setLoiNhap}
          moTaMoTa="Tuỳ chọn."
          oPhuTrach={{
            // Dự án mới chưa có Người trong dự án nào: chỉ có "Chưa có"; chọn khi sửa Dự án.
            giaTri: CHUA_CO_PHU_TRACH,
            onDoi: () => {},
            luaChon: [LUA_CHON_CHUA_CO],
            moTa: 'Dự án mới chưa có ai. Thêm người vào Dự án rồi chọn Người phụ trách khi sửa Dự án.',
          }}
        />
      </VStack>
    </NganTruot>
  )
}

interface PropsSua {
  /** Ngăn đang mở; mỗi lần mở biểu mẫu lấy lại các ô đang có của Dự án. */
  isOpen: boolean
  phien: Phien
  duAn: DuAn
  /** Người trong dự án đã đọc ở trang phía sau (null khi đang tải): lựa chọn của ô Người phụ trách. */
  nguoiTrongDuAn: KetQua<NguoiTrongDuAn[]> | null
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

/**
 * Sửa Mã, tên, Khách hàng, Mức ưu tiên, Người phụ trách, hai ngày và mô tả của Dự án trong Ngăn trượt, mở
 * từ tab Thông tin. Ô Người phụ trách chỉ liệt kê Người trong dự án (và "Chưa có").
 */
export function NganTruotSuaDuAn(props: PropsSua) {
  const lanMo = useLanMoNgan(props.isOpen)
  if (lanMo === 0) return null
  return <BieuMauSuaDuAn key={lanMo} {...props} />
}

function BieuMauSuaDuAn({
  isOpen,
  phien,
  duAn,
  nguoiTrongDuAn,
  lyDoKhongSua,
  dongHo,
  onDong,
  onDaLuu,
  onCanDocLai,
  onHetPhien,
}: PropsSua) {
  const kho = useKho()
  const [giaTri, setGiaTri] = useState<GiaTriDuAn>({
    ma: duAn.ma,
    ten: duAn.ten,
    khachHang: duAn.khachHang,
    moTa: duAn.moTa,
    ngayBatDau: (duAn.ngayBatDau ?? undefined) as NgayISO | undefined,
    ngayKetThucDuKien: (duAn.ngayKetThucDuKien ?? undefined) as NgayISO | undefined,
    mucUuTien: duAn.mucUuTien,
  })
  const phuTrachBanDau = duAn.nguoiPhuTrach?.id ?? CHUA_CO_PHU_TRACH
  const [phuTrach, setPhuTrach] = useState(phuTrachBanDau)
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [loiNhap, setLoiNhap] = useState<LoiNhapNgay>(CHUA_CO_LOI_NHAP)
  const [dangGui, setDangGui] = useState(false)

  async function luu() {
    if (dangGui || lyDoKhongSua !== null) return
    const loiNgay = loiNhapNgay(loiNhap)
    if (loiNgay) {
      setLoi(loiNgay)
      return
    }
    setDangGui(true)
    setLoi(null)
    // Chỉ gửi Người phụ trách khi người dùng đổi ô đó; "Chưa có" là bỏ Người phụ trách.
    const doiPhuTrach =
      phuTrach === phuTrachBanDau ? {} : { nguoiPhuTrachId: phuTrach === CHUA_CO_PHU_TRACH ? null : phuTrach }
    const kq = await kho.suaDuAn(phien, duAn.id, { ...dauVaoDuAn(giaTri), ...doiPhuTrach }, dongHo())
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
      phuDe={tenKemMa(duAn)}
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
          giaTri={giaTri}
          onDoi={setGiaTri}
          onLuu={luu}
          loi={loi}
          loiNhap={loiNhap}
          onLoiNhap={setLoiNhap}
          moTaMoTa="Tuỳ chọn. Để trống để xoá mô tả."
          lyDoKhongGhi={lyDoKhongSua}
          oPhuTrach={{
            giaTri: phuTrach,
            onDoi: setPhuTrach,
            luaChon: luaChonPhuTrach(nguoiTrongDuAn, duAn.nguoiPhuTrach),
            moTa: 'Tuỳ chọn. Chỉ chọn được người đang ở trong Dự án. Người phụ trách không có thêm quyền nào.',
            dangTai: nguoiTrongDuAn === null,
            lyDoKhoa: nguoiTrongDuAn !== null && !nguoiTrongDuAn.ok ? CHUA_TAI_DUOC_NGUOI : null,
          }}
        />
      </VStack>
    </NganTruot>
  )
}
