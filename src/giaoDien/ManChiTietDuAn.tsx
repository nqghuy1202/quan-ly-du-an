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
import type { DuAn, NguoiTrongDuAn, Phien } from '../kho/khoDuLieu'
import {
  DO_DAI_TEN_DU_AN_TOI_DA,
  TEN_TRANG_THAI_DU_AN,
  dinhDangNgayGio,
  kiemMoLaiDuAn,
  lyDoKhongSuaDuAn,
} from '../luat/duAn'
import { lyDoKhongGanRepo, lyDoKhongGhiLienKet } from '../luat/github'
import { lyDoKhongTaoTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { ManChiTietTask } from './ManChiTietTask'
import { ManTaoTask } from './ManTaoTask'
import { PhanNguoiTrongDuAn } from './PhanNguoiTrongDuAn'
import { PhanRepoGitHub } from './PhanRepoGitHub'
import { PhanTaskCuaDuAn } from './PhanTaskCuaDuAn'
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

/** Màn con về Task mở từ trang Dự án: biểu mẫu tạo, hoặc chi tiết một Task. */
type ManTask = { loai: 'tao' } | { loai: 'chiTiet'; taskId: string; thongBao: string | null }

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

/** Quyền của Support phụ thuộc danh sách người trong dự án; chưa có danh sách thì chưa rõ quyền. */
const LY_DO_CHUA_RO_QUYEN = {
  dangTai: 'Đang kiểm quyền của bạn trên Dự án này…',
  loi: 'Chưa kiểm được quyền của bạn vì không tải được người trong dự án.',
} as const

/** Chi tiết một Dự án: dấu vết, sửa tên và mô tả, Lưu trữ và mở lại, người trong dự án, Task. */
export function ManChiTietDuAn({ phien, vai, duAnId, thongBaoBanDau, dongHo, onQuayLai, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<DuAn> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const [lanTaiNguoi, setLanTaiNguoi] = useState(0)
  const [daTaiNguoi, setDaTaiNguoi] = useState<{ lan: number; kq: KetQua<NguoiTrongDuAn[]> } | null>(null)
  const taiNguoi = daTaiNguoi && daTaiNguoi.lan === lanTaiNguoi ? daTaiNguoi.kq : null
  const [ten, setTen] = useState('')
  const [moTa, setMoTa] = useState('')
  const [dangLam, setDangLam] = useState<Viec | null>(null)
  const [thongBao, setThongBao] = useState<ThongBao | null>(
    thongBaoBanDau ? { loai: 'thanhCong', noiDung: thongBaoBanDau } : null,
  )
  const [manTask, setManTask] = useState<ManTask | null>(null)

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

  useEffect(() => {
    let huy = false
    kho.danhSachNguoiTrongDuAn(phien, duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') {
        onHetPhien()
        return
      }
      setDaTaiNguoi({ lan: lanTaiNguoi, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, duAnId, lanTaiNguoi, onHetPhien])

  function taiLaiTatCa() {
    setLanTai((n) => n + 1)
    setLanTaiNguoi((n) => n + 1)
  }

  function doiDanhSachNguoi(capNhat: (cu: NguoiTrongDuAn[]) => NguoiTrongDuAn[]) {
    setDaTaiNguoi((cu) => (cu && cu.kq.ok ? { lan: cu.lan, kq: { ok: true, giaTri: capNhat(cu.kq.giaTri) } } : cu))
  }

  /** Dự án hay quyền đã đổi ở nơi khác: đọc lại Dự án và người trong dự án. */
  async function docLai() {
    setLanTaiNguoi((n) => n + 1)
    const docLaiDuAn = await kho.layDuAn(phien, duAnId)
    if (docLaiDuAn.ok) setDaTai({ lan: lanTai, kq: docLaiDuAn })
  }

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
    // Dự án hay quyền đã đổi ở nơi khác (vd. vừa bị Lưu trữ, bị gỡ khỏi Dự án): đọc lại để nút và
    // lý do khớp với Kho.
    if (
      kq.loi.ma === 'DU_AN_DA_LUU_TRU' ||
      kq.loi.ma === 'DU_AN_DANG_HOAT_DONG' ||
      kq.loi.ma === 'KHONG_CO_QUYEN'
    ) {
      await docLai()
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
          endContent={<Button label="Thử lại" variant="secondary" onClick={taiLaiTatCa} />}
        />
      </VStack>
    )
  }

  const duAn = tai.giaTri
  const { taoBoi, taoLuc, suaBoi, suaLuc } = duAn.dauVet
  // Cùng luật với Kho: không có quyền hoặc đã Lưu trữ thì ẩn nút ghi và nói lý do. Quyền của
  // Support tuỳ việc có nằm trong danh sách người trong dự án hay không.
  const tinhHuong = {
    vaiNguoiGoi: vai,
    laNguoiTrongDuAn:
      taiNguoi !== null && taiNguoi.ok && taiNguoi.giaTri.some((nguoi) => nguoi.id === phien.nguoiDungId),
    trangThai: duAn.trangThai,
  }
  const quyenDaRo = vai !== 'SUPPORT' || taiNguoi?.ok === true
  const lyDoKhongSua = quyenDaRo
    ? lyDoKhongSuaDuAn(tinhHuong)
    : taiNguoi === null
      ? LY_DO_CHUA_RO_QUYEN.dangTai
      : LY_DO_CHUA_RO_QUYEN.loi
  const moLaiDuoc = quyenDaRo && kiemMoLaiDuAn(tinhHuong) === null
  const lyDoKhongGanRepoMoi = quyenDaRo
    ? lyDoKhongGanRepo(tinhHuong)
    : taiNguoi === null
      ? LY_DO_CHUA_RO_QUYEN.dangTai
      : LY_DO_CHUA_RO_QUYEN.loi
  const lyDoKhongTaoTaskMoi = quyenDaRo
    ? lyDoKhongTaoTask(tinhHuong)
    : taiNguoi === null
      ? LY_DO_CHUA_RO_QUYEN.dangTai
      : LY_DO_CHUA_RO_QUYEN.loi

  if (manTask?.loai === 'tao') {
    return (
      <ManTaoTask
        phien={phien}
        vai={vai}
        duAn={duAn}
        dongHo={dongHo}
        onDaTao={(task) => setManTask({ loai: 'chiTiet', taskId: task.id, thongBao: `Đã tạo Task ${task.tieuDe}.` })}
        onQuayLai={() => setManTask(null)}
        onHetPhien={onHetPhien}
      />
    )
  }

  if (manTask?.loai === 'chiTiet') {
    return (
      <ManChiTietTask
        key={manTask.taskId}
        phien={phien}
        taskId={manTask.taskId}
        tenDuAn={duAn.ten}
        thongBaoBanDau={manTask.thongBao}
        // Ai mở được Task thì thấy Dự án nên ở trong Dự án (hoặc là PM): chỉ còn trạng thái Lưu trữ.
        lyDoKhongGhiLienKet={lyDoKhongGhiLienKet({ ...tinhHuong, laNguoiTrongDuAn: true })}
        dongHo={dongHo}
        onQuayLai={() => setManTask(null)}
        onHetPhien={onHetPhien}
      />
    )
  }

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

      <PhanNguoiTrongDuAn
        phien={phien}
        duAnId={duAnId}
        tai={taiNguoi}
        lyDoKhongGhi={lyDoKhongSua}
        onThuLai={() => setLanTaiNguoi((n) => n + 1)}
        onDoiDanhSach={doiDanhSachNguoi}
        onCanDocLai={docLai}
        onHetPhien={onHetPhien}
      />

      <PhanRepoGitHub
        phien={phien}
        duAnId={duAnId}
        lyDoKhongGhi={lyDoKhongGanRepoMoi}
        onCanDocLai={docLai}
        onHetPhien={onHetPhien}
      />

      <PhanTaskCuaDuAn
        phien={phien}
        duAnId={duAnId}
        lyDoKhongTao={lyDoKhongTaoTaskMoi}
        onTao={() => setManTask({ loai: 'tao' })}
        onMo={(taskId) => setManTask({ loai: 'chiTiet', taskId, thongBao: null })}
        onHetPhien={onHetPhien}
      />
    </VStack>
  )
}
