import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { DateInput, type DateInputProps } from '@astryxdesign/core/DateInput'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Selector } from '@astryxdesign/core/Selector'
import { Spinner } from '@astryxdesign/core/Spinner'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { THONG_BAO_MAC_DINH, type KetQua, type LoiKho, type MaLoi } from '../kho/ketQua'
import type { DuAn, NguoiTrongDuAn, Phien, Task } from '../kho/khoDuLieu'
import { DO_DAI_TIEU_DE_TASK_TOI_DA, THONG_BAO_SUA_TASK, THONG_BAO_TASK, lyDoKhongSuaTask } from '../luat/task'
import { xepTheoTen, type VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'

/** Ngày `YYYY-MM-DD` như DateInput của Astryx nhận và trả. */
type NgayISO = NonNullable<DateInputProps['value']>

interface Props {
  phien: Phien
  vai: VaiHeThong
  task: Task
  trangThaiDuAn: DuAn['trangThai']
  dongHo: () => Date
  /** Task vừa được lưu (sửa hay đổi người) thành công. */
  onDaCapNhat: (task: Task, thongBao: string) => void
  /** Kho từ chối vì Task, Dự án hay quyền đã đổi ở nơi khác: đọc lại Task cho khớp với Kho. */
  onCanDocLai: () => void
  onHetPhien: () => void
}

type Viec = 'sua' | 'doiNguoi'

/** Lỗi cho thấy Task, Dự án hay quyền của người dùng đã đổi ở nơi khác. */
const LOI_CAN_DOC_LAI: readonly MaLoi[] = ['DU_AN_DA_LUU_TRU', 'KHONG_CO_QUYEN', 'KHONG_TIM_THAY', 'TASK_DA_CHOT']

const TIEU_DE_LOI: Record<Viec, string> = {
  sua: 'Chưa lưu được thay đổi của Task.',
  doiNguoi: 'Chưa đổi được người của Task.',
}

/**
 * Phần "Sửa Task" của màn chi tiết Task: sửa tiêu đề, mô tả, hạn và đổi Người thực hiện, Người kiểm
 * tra. Chỉ PM hoặc Support của Dự án, và chỉ khi Task chưa ở trạng thái cuối; người khác (hay Task đã
 * chốt) thấy lý do thay cho biểu mẫu.
 */
export function PhanSuaTask({ phien, vai, task, trangThaiDuAn, dongHo, onDaCapNhat, onCanDocLai, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<NguoiTrongDuAn[]> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const [tieuDe, setTieuDe] = useState(task.tieuDe)
  const [moTa, setMoTa] = useState(task.moTa)
  const [han, setHan] = useState<NgayISO | undefined>((task.han ?? undefined) as NgayISO | undefined)
  const [loiNhapHan, setLoiNhapHan] = useState(false)
  const [nguoiThucHienId, setNguoiThucHienId] = useState<string | undefined>(task.nguoiThucHien.id)
  const [nguoiKiemTraId, setNguoiKiemTraId] = useState<string | undefined>(task.nguoiKiemTra.id)
  const [loi, setLoi] = useState<{ viec: Viec; loi: LoiKho } | null>(null)
  const [dangLam, setDangLam] = useState<Viec | null>(null)
  // Chặn lệnh trùng (bấm hai lần trước khi kịp vẽ lại) bằng ref chứ không bằng state.
  const dangGuiRef = useRef(false)

  useEffect(() => {
    let huy = false
    kho.danhSachNguoiTrongDuAn(phien, task.duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ lan: lanTai, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, task.duAnId, lanTai, onHetPhien])

  const khung = (noiDung: ReactNode) => (
    <VStack gap={3} role="group" aria-label="Sửa Task">
      <Heading level={3}>Sửa Task</Heading>
      {noiDung}
    </VStack>
  )

  if (tai === null) return khung(<Spinner label="Đang kiểm quyền sửa Task…" />)

  if (!tai.ok) {
    return khung(
      <Banner
        status="error"
        title="Không tải được người trong dự án để kiểm quyền và chọn người."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
      />,
    )
  }

  const nguoiTrong = tai.giaTri
  // Cùng luật với Kho: không có quyền, Dự án đã Lưu trữ hay Task đã chốt thì không có biểu mẫu, chỉ có lý do.
  const lyDo = lyDoKhongSuaTask({
    vaiNguoiGoi: vai,
    laNguoiTrongDuAn: nguoiTrong.some((nguoi) => nguoi.id === phien.nguoiDungId),
    trangThai: trangThaiDuAn,
    trangThaiTask: task.trangThai,
  })
  if (lyDo !== null) return khung(<Banner status="info" title={lyDo} role="status" />)

  const luaChon = xepTheoTen(nguoiTrong).map((nguoi) => ({
    value: nguoi.id,
    label: `${nguoi.tenHienThi} (${nguoi.email})`,
  }))
  // Người đang ghi trên Task đã rời Dự án: vẫn hiện làm lựa chọn hiện tại để thấy họ đang được ghi.
  function luaChonCho(nguoi: Task['nguoiThucHien']) {
    return luaChon.some((l) => l.value === nguoi.id)
      ? luaChon
      : [{ value: nguoi.id, label: `${nguoi.tenHienThi} (${THONG_BAO_SUA_TASK.daRoiDuAn})` }, ...luaChon]
  }

  function xuLyLoi(viec: Viec, loiKho: LoiKho) {
    if (loiKho.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
      return
    }
    setLoi({ viec, loi: loiKho })
    if (LOI_CAN_DOC_LAI.includes(loiKho.ma)) onCanDocLai()
  }

  function hienTask(moi: Task) {
    setTieuDe(moi.tieuDe)
    setMoTa(moi.moTa)
    setHan((moi.han ?? undefined) as NgayISO | undefined)
    setNguoiThucHienId(moi.nguoiThucHien.id)
    setNguoiKiemTraId(moi.nguoiKiemTra.id)
  }

  async function lam(viec: Viec) {
    if (dangGuiRef.current) return
    if (viec === 'sua' && loiNhapHan) {
      setLoi({
        viec,
        loi: { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO: { han: THONG_BAO_TASK.hanSai } },
      })
      return
    }
    dangGuiRef.current = true
    setDangLam(viec)
    setLoi(null)
    const bayGio = dongHo()
    const kq =
      viec === 'sua'
        ? await kho.suaTask(phien, task.id, { tieuDe, moTa, han: han ?? null }, bayGio)
        : await kho.doiNguoiTask(
            phien,
            task.id,
            { nguoiThucHienId: nguoiThucHienId ?? null, nguoiKiemTraId: nguoiKiemTraId ?? null },
            bayGio,
          )
    dangGuiRef.current = false
    setDangLam(null)
    if (kq.ok) {
      hienTask(kq.giaTri)
      onDaCapNhat(kq.giaTri, viec === 'sua' ? 'Đã lưu thay đổi của Task.' : 'Đã đổi người của Task.')
    } else {
      xuLyLoi(viec, kq.loi)
    }
  }

  const loiSua = loi?.viec === 'sua' ? loi.loi : null
  const loiNguoi = loi?.viec === 'doiNguoi' ? loi.loi : null

  return khung(
    <>
      {loi && <Banner status="error" title={TIEU_DE_LOI[loi.viec]} description={loi.loi.thongBao} role="alert" />}
      <FormLayout>
        <TextInput
          label="Tiêu đề"
          description={`Bắt buộc, tối đa ${DO_DAI_TIEU_DE_TASK_TOI_DA} ký tự.`}
          autoComplete="off"
          value={tieuDe}
          onChange={setTieuDe}
          status={trangThaiO(loiSua, 'tieuDe')}
        />
        <TextArea
          label="Mô tả"
          description="Tuỳ chọn. Để trống để xoá mô tả."
          value={moTa}
          onChange={setMoTa}
          status={trangThaiO(loiSua, 'moTa')}
        />
        <DateInput
          label="Hạn"
          description="Tuỳ chọn. Một ngày, không có giờ; bấm xoá để bỏ hạn."
          placeholder="Chọn ngày"
          format="system_date"
          hasClear
          value={han}
          onChange={setHan}
          onEntryErrorChange={(loiNhap) => setLoiNhapHan(loiNhap !== null)}
          status={loiNhapHan ? { type: 'error', message: THONG_BAO_TASK.hanSai } : trangThaiO(loiSua, 'han')}
        />
      </FormLayout>
      <HStack gap={2}>
        <Button label="Lưu thay đổi" variant="primary" isLoading={dangLam === 'sua'} onClick={() => lam('sua')} />
      </HStack>

      <VStack gap={3} role="group" aria-label="Đổi người">
        <Heading level={3}>Đổi người</Heading>
        <FormLayout>
          <Selector
            label="Người thực hiện"
            description="Chọn một người đang ở trong Dự án."
            placeholder="Chọn Người thực hiện"
            emptyText="Dự án chưa có ai."
            options={luaChonCho(task.nguoiThucHien)}
            value={nguoiThucHienId}
            onChange={setNguoiThucHienId}
            status={trangThaiO(loiNguoi, 'nguoiThucHienId')}
          />
          <Selector
            label="Người kiểm tra"
            description="Phải khác Người thực hiện."
            placeholder="Chọn Người kiểm tra"
            emptyText="Dự án chưa có ai."
            options={luaChonCho(task.nguoiKiemTra)}
            value={nguoiKiemTraId}
            onChange={setNguoiKiemTraId}
            status={trangThaiO(loiNguoi, 'nguoiKiemTraId')}
          />
        </FormLayout>
        <HStack gap={2}>
          <Button label="Đổi người" variant="secondary" isLoading={dangLam === 'doiNguoi'} onClick={() => lam('doiNguoi')} />
        </HStack>
      </VStack>
    </>,
  )
}
