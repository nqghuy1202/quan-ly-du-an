import { useEffect, useRef, useState } from 'react'
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
import { THONG_BAO_MAC_DINH, type KetQua, type LoiKho } from '../kho/ketQua'
import type { DuAn, NguoiTrongDuAn, Phien, Task } from '../kho/khoDuLieu'
import { DO_DAI_TIEU_DE_TASK_TOI_DA, THONG_BAO_TASK, lyDoKhongTaoTask } from '../luat/task'
import { xepTheoTen, type VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'

/** Ngày `YYYY-MM-DD` như DateInput của Astryx nhận và trả. */
type NgayISO = NonNullable<DateInputProps['value']>

interface Props {
  phien: Phien
  vai: VaiHeThong
  duAn: DuAn
  dongHo: () => Date
  onDaTao: (task: Task) => void
  onQuayLai: () => void
  onHetPhien: () => void
}

/**
 * Biểu mẫu tạo Task trong một Dự án: tiêu đề, mô tả, hạn tuỳ chọn, một Người thực hiện và một Người
 * kiểm tra chọn từ người trong dự án. Chỉ PM hoặc Support của Dự án; người khác thấy lý do.
 */
export function ManTaoTask({ phien, vai, duAn, dongHo, onDaTao, onQuayLai, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<NguoiTrongDuAn[]> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const [tieuDe, setTieuDe] = useState('')
  const [moTa, setMoTa] = useState('')
  const [han, setHan] = useState<NgayISO | undefined>(undefined)
  const [loiNhapHan, setLoiNhapHan] = useState(false)
  const [nguoiThucHienId, setNguoiThucHienId] = useState<string | undefined>(undefined)
  const [nguoiKiemTraId, setNguoiKiemTraId] = useState<string | undefined>(undefined)
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)
  // Chặn lệnh trùng (bấm hai lần trước khi kịp vẽ lại) bằng ref chứ không bằng state.
  const dangGuiRef = useRef(false)

  useEffect(() => {
    let huy = false
    kho.danhSachNguoiTrongDuAn(phien, duAn.id).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ lan: lanTai, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, duAn.id, lanTai, onHetPhien])

  const nutVe = (
    <HStack gap={2}>
      <Button label={`Về Dự án ${duAn.ten}`} variant="ghost" onClick={onQuayLai} />
    </HStack>
  )
  const tieuDeMan = <Heading level={2}>Tạo Task</Heading>

  if (tai === null) {
    return (
      <VStack gap={4}>
        {nutVe}
        {tieuDeMan}
        <Spinner label="Đang tải người trong dự án…" />
      </VStack>
    )
  }

  if (!tai.ok) {
    return (
      <VStack gap={4}>
        {nutVe}
        {tieuDeMan}
        <Banner
          status="error"
          title="Không tải được người trong dự án để chọn Người thực hiện và Người kiểm tra."
          description={tai.loi.thongBao}
          role="alert"
          endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
        />
      </VStack>
    )
  }

  const nguoiTrong = tai.giaTri
  // Cùng luật với Kho: không có quyền hoặc Dự án đã Lưu trữ thì không có biểu mẫu, chỉ có lý do.
  const lyDo = lyDoKhongTaoTask({
    vaiNguoiGoi: vai,
    laNguoiTrongDuAn: nguoiTrong.some((nguoi) => nguoi.id === phien.nguoiDungId),
    trangThai: duAn.trangThai,
  })
  if (lyDo !== null) {
    return (
      <VStack gap={4}>
        {nutVe}
        {tieuDeMan}
        <Banner status="info" title={lyDo} role="status" />
      </VStack>
    )
  }

  const luaChon = xepTheoTen(nguoiTrong).map((nguoi) => ({
    value: nguoi.id,
    label: `${nguoi.tenHienThi} (${nguoi.email})`,
  }))

  async function tao() {
    if (dangGuiRef.current) return
    if (loiNhapHan) {
      setLoi({ ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO: { han: THONG_BAO_TASK.hanSai } })
      return
    }
    dangGuiRef.current = true
    setDangGui(true)
    setLoi(null)
    const kq = await kho.taoTask(
      phien,
      duAn.id,
      {
        tieuDe,
        moTa,
        han: han ?? null,
        nguoiThucHienId: nguoiThucHienId ?? null,
        nguoiKiemTraId: nguoiKiemTraId ?? null,
      },
      dongHo(),
    )
    dangGuiRef.current = false
    setDangGui(false)
    if (kq.ok) onDaTao(kq.giaTri)
    else if (kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
    else setLoi(kq.loi)
  }

  return (
    <VStack gap={4}>
      {nutVe}
      {tieuDeMan}
      {loi && <Banner status="error" title="Chưa tạo được Task." description={loi.thongBao} role="alert" />}
      {nguoiTrong.length < 2 && (
        <Banner
          status="info"
          title="Dự án cần ít nhất hai người để giao một Task (Người thực hiện và Người kiểm tra là hai người khác nhau). Hãy thêm người vào Dự án trước."
        />
      )}
      <FormLayout>
        <TextInput
          label="Tiêu đề"
          description={`Bắt buộc, tối đa ${DO_DAI_TIEU_DE_TASK_TOI_DA} ký tự.`}
          autoComplete="off"
          value={tieuDe}
          onChange={setTieuDe}
          status={trangThaiO(loi, 'tieuDe')}
        />
        <TextArea
          label="Mô tả"
          description="Tuỳ chọn."
          value={moTa}
          onChange={setMoTa}
          status={trangThaiO(loi, 'moTa')}
        />
        <DateInput
          label="Hạn"
          description="Tuỳ chọn. Một ngày, không có giờ; ngày đã qua vẫn được."
          placeholder="Chọn ngày"
          format="system_date"
          hasClear
          value={han}
          onChange={setHan}
          onEntryErrorChange={(loiNhap) => setLoiNhapHan(loiNhap !== null)}
          status={loiNhapHan ? { type: 'error', message: THONG_BAO_TASK.hanSai } : trangThaiO(loi, 'han')}
        />
        <Selector
          label="Người thực hiện"
          description="Bắt buộc. Chọn một người đang ở trong Dự án."
          placeholder="Chọn Người thực hiện"
          emptyText="Dự án chưa có ai."
          options={luaChon}
          value={nguoiThucHienId}
          onChange={setNguoiThucHienId}
          status={trangThaiO(loi, 'nguoiThucHienId')}
        />
        <Selector
          label="Người kiểm tra"
          description="Bắt buộc. Phải khác Người thực hiện."
          placeholder="Chọn Người kiểm tra"
          emptyText="Dự án chưa có ai."
          options={luaChon}
          value={nguoiKiemTraId}
          onChange={setNguoiKiemTraId}
          status={trangThaiO(loi, 'nguoiKiemTraId')}
        />
      </FormLayout>
      <HStack gap={2}>
        <Button label="Tạo Task" variant="primary" isLoading={dangGui} onClick={tao} />
      </HStack>
    </VStack>
  )
}
