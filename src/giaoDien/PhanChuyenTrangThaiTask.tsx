import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua, LoiKho, MaLoi } from '../kho/ketQua'
import type { DuAnTomTat, Phien, Task } from '../kho/khoDuLieu'
import {
  cacBuocLamDuoc,
  lyDoKhongCoBuoc,
  type BuocChuyen,
  type TinhHuongChuyen,
} from '../luat/chuyenTrangThai'
import type { TrangThaiDuAn } from '../luat/duAn'
import { TEN_TRANG_THAI_TASK } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { HopNhapLyDo } from './HopNhapLyDo'
import { useKho } from './khoContext'

interface Props {
  phien: Phien
  vai: VaiHeThong
  task: Task
  trangThaiDuAn: TrangThaiDuAn
  dongHo: () => Date
  /** Task vừa đổi trạng thái (thông báo thành công) hoặc vừa đọc lại cho khớp Kho (thông báo null). */
  onDaCapNhat: (task: Task, thongBao: string | null) => void
  onHetPhien: () => void
}

/** Lỗi cho thấy Task, Dự án hay quyền đã đổi ở nơi khác: đọc lại Task cho khớp với Kho. */
const LOI_CAN_DOC_LAI: readonly MaLoi[] = ['DU_AN_DA_LUU_TRU', 'KHONG_CO_QUYEN', 'KHONG_TIM_THAY', 'TASK_DA_CHOT', 'BUOC_KHONG_HOP_LE']

/**
 * Phần "Chuyển trạng thái" trong Ngăn trượt của Task: chỉ hiện nút các bước người dùng làm được (cùng
 * luật thuần với Kho). Bước cần lý do mở hộp nhập lý do trước khi áp dụng. Khi Kho từ chối (vd. Task
 * vừa đổi ở nơi khác) thì hiện lý do bằng tiếng Việt.
 */
export function PhanChuyenTrangThaiTask({ phien, vai, task, trangThaiDuAn, dongHo, onDaCapNhat, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<DuAnTomTat[]> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const [dangMo, setDangMo] = useState<BuocChuyen | null>(null)
  const [dangLam, setDangLam] = useState<BuocChuyen | null>(null)
  const [loi, setLoi] = useState<LoiKho | null>(null)
  // Chặn lệnh trùng (bấm hai lần trước khi kịp vẽ lại) bằng ref chứ không bằng state.
  const dangGuiRef = useRef(false)

  useEffect(() => {
    let huy = false
    kho.danhSachDuAnCuaToi(phien).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ lan: lanTai, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, lanTai, onHetPhien])

  const khung = (noiDung: ReactNode) => (
    <VStack gap={3} role="group" aria-label="Chuyển trạng thái">
      <Heading level={3}>Chuyển trạng thái</Heading>
      {noiDung}
    </VStack>
  )

  if (tai === null) return khung(<Spinner label="Đang kiểm các bước làm được…" />)

  if (!tai.ok) {
    return khung(
      <Banner
        status="error"
        title="Không tải được thông tin để kiểm các bước làm được."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
      />,
    )
  }

  // Cùng luật với Kho: chỉ hiện nút bước người dùng làm được.
  const tinhHuong: TinhHuongChuyen = {
    vaiNguoiGoi: vai,
    laNguoiTrongDuAn: tai.giaTri.some((duAn) => duAn.id === task.duAnId),
    nguoiGoiId: phien.nguoiDungId,
    nguoiThucHienId: task.nguoiThucHien.id,
    nguoiKiemTraId: task.nguoiKiemTra.id,
    trangThaiDuAn,
    trangThaiTask: task.trangThai,
  }
  const cacBuoc = cacBuocLamDuoc(tinhHuong)
  const lyDoKhongCo = lyDoKhongCoBuoc(tinhHuong)

  async function thucHien(buoc: BuocChuyen, lyDo: string | null) {
    if (dangGuiRef.current) return
    dangGuiRef.current = true
    setDangLam(buoc)
    setLoi(null)
    const kq = await kho.doiTrangThaiTask(phien, task.id, lyDo === null ? { sang: buoc.sang } : { sang: buoc.sang, lyDo }, dongHo())
    dangGuiRef.current = false
    setDangLam(null)
    if (kq.ok) {
      setDangMo(null)
      onDaCapNhat(kq.giaTri, `Đã chuyển Task sang ${TEN_TRANG_THAI_TASK[kq.giaTri.trangThai]}.`)
      return
    }
    if (kq.loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
      return
    }
    setLoi(kq.loi)
    if (LOI_CAN_DOC_LAI.includes(kq.loi.ma)) {
      // Đọc lại Task cho khớp Kho nhưng giữ nguyên thông báo lỗi đang hiện.
      void kho.layTask(phien, task.id).then((moi) => {
        if (moi.ok) onDaCapNhat(moi.giaTri, null)
      })
    }
  }

  function bam(buoc: BuocChuyen) {
    if (buoc.canLyDo) {
      setLoi(null)
      setDangMo(buoc)
    } else {
      void thucHien(buoc, null)
    }
  }

  return khung(
    <>
      {loi && !dangMo && loi.thongBao !== lyDoKhongCo && (
        <Banner status="error" title="Chưa chuyển được trạng thái." description={loi.thongBao} role="alert" />
      )}
      {cacBuoc.length > 0 ? (
        <HStack gap={2} wrap="wrap">
          {cacBuoc.map((buoc, i) => (
            <Button
              key={buoc.sang}
              label={buoc.nhan}
              variant={buoc.sang === 'HUY' ? 'destructive' : i === 0 ? 'primary' : 'secondary'}
              isLoading={dangLam?.sang === buoc.sang && !buoc.canLyDo}
              onClick={() => bam(buoc)}
            />
          ))}
        </HStack>
      ) : (
        lyDoKhongCo !== null && <Banner status="info" title={lyDoKhongCo} role="status" />
      )}
      {dangMo && (
        <HopNhapLyDo
          tieuDe={`${dangMo.nhan}: nhập lý do`}
          nhanGui={dangMo.nhan}
          dangGui={dangLam !== null}
          loi={loi ? loi.thongBao : null}
          onGui={(lyDo) => void thucHien(dangMo, lyDo)}
          onDong={() => {
            if (dangGuiRef.current) return
            setDangMo(null)
            setLoi(null)
          }}
        />
      )}
    </>,
  )
}
