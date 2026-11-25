import { useEffect, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua, LoiKho } from '../kho/ketQua'
import type { DuAn, Phien } from '../kho/khoDuLieu'
import {
  DO_DAI_TEN_DU_AN_TOI_DA,
  TEN_TRANG_THAI_DU_AN,
  dinhDangNgayGio,
  kiemMoLaiDuAn,
  lyDoKhongSuaDuAn,
} from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'

interface Props {
  phien: Phien
  vai: VaiHeThong
  duAnId: string
  /** Thông báo thành công mang sang từ màn trước (vd. vừa tạo xong). */
  thongBaoBanDau: string | null
  dongHo: () => Date
  onQuayLai: () => void
  onHetPhien: () => void
}

type Viec = 'luu' | 'luuTru' | 'moLai'

type ThongBao = { loai: 'thanhCong'; noiDung: string } | { loai: 'loi'; tieuDe: string; loi: LoiKho }

const TIEU_DE_LOI: Record<Viec, string> = {
  luu: 'Chưa lưu được thay đổi.',
  luuTru: 'Không Lưu trữ được Dự án.',
  moLai: 'Không mở lại được Dự án.',
}

const DA_XONG: Record<Viec, string> = {
  luu: 'Đã lưu thay đổi.',
  luuTru: 'Đã Lưu trữ Dự án. Dự án giờ chỉ xem được.',
  moLai: 'Đã mở lại Dự án. Bạn có thể sửa tiếp.',
}

/** Chi tiết một Dự án: dấu vết, sửa tên và mô tả, Lưu trữ và mở lại. */
export function ManChiTietDuAn({ phien, vai, duAnId, thongBaoBanDau, dongHo, onQuayLai, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<DuAn> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const [ten, setTen] = useState('')
  const [moTa, setMoTa] = useState('')
  const [dangLam, setDangLam] = useState<Viec | null>(null)
  const [thongBao, setThongBao] = useState<ThongBao | null>(
    thongBaoBanDau ? { loai: 'thanhCong', noiDung: thongBaoBanDau } : null,
  )

  useEffect(() => {
    let huy = false
    kho.layDuAn(phien, duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') {
        onHetPhien()
        return
      }
      if (kq.ok) {
        setTen(kq.giaTri.ten)
        setMoTa(kq.giaTri.moTa)
      }
      setDaTai({ lan: lanTai, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, duAnId, lanTai, onHetPhien])

  function hienDuAn(duAn: DuAn) {
    setTen(duAn.ten)
    setMoTa(duAn.moTa)
    setDaTai({ lan: lanTai, kq: { ok: true, giaTri: duAn } })
  }

  async function lam(viec: Viec) {
    if (dangLam) return
    setDangLam(viec)
    setThongBao(null)
    const bayGio = dongHo()
    const kq =
      viec === 'luu'
        ? await kho.suaDuAn(phien, duAnId, { ten, moTa }, bayGio)
        : viec === 'luuTru'
          ? await kho.luuTruDuAn(phien, duAnId, bayGio)
          : await kho.moLaiDuAn(phien, duAnId, bayGio)
    setDangLam(null)
    if (kq.ok) {
      hienDuAn(kq.giaTri)
      setThongBao({ loai: 'thanhCong', noiDung: DA_XONG[viec] })
      return
    }
    if (kq.loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
      return
    }
    setThongBao({ loai: 'loi', tieuDe: TIEU_DE_LOI[viec], loi: kq.loi })
    // Dự án đã đổi ở nơi khác (vd. vừa bị Lưu trữ): đọc lại để nút và lý do khớp với Kho.
    if (kq.loi.ma === 'DU_AN_DA_LUU_TRU' || kq.loi.ma === 'DU_AN_DANG_HOAT_DONG') {
      const docLai = await kho.layDuAn(phien, duAnId)
      if (docLai.ok) {
        setDaTai({ lan: lanTai, kq: docLai })
      }
    }
  }

  const nutVe = (
    <HStack gap={2}>
      <Button label="Về danh sách Dự án" variant="ghost" onClick={onQuayLai} />
    </HStack>
  )

  if (tai === null) {
    return (
      <VStack gap={4}>
        {nutVe}
        <Spinner label="Đang tải Dự án…" />
      </VStack>
    )
  }

  if (!tai.ok) {
    return (
      <VStack gap={4}>
        {nutVe}
        <Banner
          status="error"
          title="Không tải được Dự án."
          description={tai.loi.thongBao}
          role="alert"
          endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
        />
      </VStack>
    )
  }

  const duAn = tai.giaTri
  const { taoBoi, taoLuc, suaBoi, suaLuc } = duAn.dauVet
  // Cùng luật với Kho: không có quyền hoặc đã Lưu trữ thì ẩn nút ghi và nói lý do.
  const lyDoKhongSua = lyDoKhongSuaDuAn({ vaiNguoiGoi: vai, trangThai: duAn.trangThai })
  const moLaiDuoc = kiemMoLaiDuAn({ vaiNguoiGoi: vai, trangThai: duAn.trangThai }) === null

  return (
    <VStack gap={4}>
      {nutVe}
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Heading level={2}>{duAn.ten}</Heading>
        <Token
          label={TEN_TRANG_THAI_DU_AN[duAn.trangThai]}
          color={duAn.trangThai === 'LUU_TRU' ? 'gray' : 'green'}
        />
      </HStack>

      {thongBao?.loai === 'thanhCong' && <Banner status="success" title={thongBao.noiDung} role="status" />}
      {thongBao?.loai === 'loi' && (
        <Banner status="error" title={thongBao.tieuDe} description={thongBao.loi.thongBao} role="alert" />
      )}
      {lyDoKhongSua && <Banner status="info" title={lyDoKhongSua} />}

      <VStack gap={1} role="group" aria-label="Dấu vết">
        <Heading level={3}>Dấu vết</Heading>
        <Text>{`Người tạo: ${taoBoi.tenHienThi}`}</Text>
        <Text>{`Ngày tạo: ${dinhDangNgayGio(taoLuc)}`}</Text>
        {suaBoi && suaLuc && (
          <>
            <Text>{`Người chỉnh sửa gần nhất: ${suaBoi.tenHienThi}`}</Text>
            <Text>{`Ngày chỉnh sửa gần nhất: ${dinhDangNgayGio(suaLuc)}`}</Text>
          </>
        )}
        <Text>Ngày giờ theo giờ Việt Nam.</Text>
      </VStack>

      <FormLayout>
        <TextInput
          label="Tên Dự án"
          description={`Bắt buộc, tối đa ${DO_DAI_TEN_DU_AN_TOI_DA} ký tự.`}
          autoComplete="off"
          value={ten}
          onChange={setTen}
          onEnter={lyDoKhongSua ? undefined : () => lam('luu')}
          isDisabled={lyDoKhongSua !== null}
          disabledMessage={lyDoKhongSua ?? undefined}
          status={thongBao?.loai === 'loi' ? trangThaiO(thongBao.loi, 'ten') : undefined}
        />
        <TextArea
          label="Mô tả"
          description="Tuỳ chọn. Để trống để xoá mô tả."
          value={moTa}
          onChange={setMoTa}
          isDisabled={lyDoKhongSua !== null}
          disabledMessage={lyDoKhongSua ?? undefined}
          status={thongBao?.loai === 'loi' ? trangThaiO(thongBao.loi, 'moTa') : undefined}
        />
      </FormLayout>

      <HStack gap={2} wrap="wrap">
        {lyDoKhongSua === null && (
          <>
            <Button label="Lưu thay đổi" variant="primary" isLoading={dangLam === 'luu'} onClick={() => lam('luu')} />
            <Button label="Lưu trữ Dự án" variant="secondary" isLoading={dangLam === 'luuTru'} onClick={() => lam('luuTru')} />
          </>
        )}
        {moLaiDuoc && (
          <Button label="Mở lại Dự án" variant="primary" isLoading={dangLam === 'moLai'} onClick={() => lam('moLai')} />
        )}
      </HStack>
    </VStack>
  )
}
