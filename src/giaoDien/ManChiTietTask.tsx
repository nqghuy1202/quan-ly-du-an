import { useEffect, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, NguoiCuaTask, Phien, Task } from '../kho/khoDuLieu'
import { dinhDangNgayGio } from '../luat/duAn'
import { TEN_TRANG_THAI_TASK, THONG_BAO_SUA_TASK, dinhDangNgay } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { PhanLienKetTask } from './PhanLienKetTask'
import { MAU_TRANG_THAI_TASK } from './mauTrangThaiTask'
import { PhanSuaTask } from './PhanSuaTask'

interface Props {
  phien: Phien
  /** Vai hệ thống của người đang đăng nhập, để ẩn biểu mẫu sửa theo cùng luật với Kho. */
  vai: VaiHeThong
  taskId: string
  /** Trạng thái của Dự án chứa Task: Dự án đã Lưu trữ thì Task chỉ xem. */
  trangThaiDuAn: DuAn['trangThai']
  dongHo: () => Date
  /** Tên Dự án chứa Task, cho nút quay lại. */
  tenDuAn: string
  /** Nhãn nút quay lại khi không quay về Dự án (vd. quay về "Việc của tôi"); mặc định "Về Dự án <tên>". */
  nhanQuayLai?: string
  /** Thông báo thành công mang sang từ màn trước (vd. vừa tạo xong). */
  thongBaoBanDau: string | null
  /** Lý do không thêm, gỡ được link GitHub (Dự án đã Lưu trữ); null nếu được. */
  lyDoKhongGhiLienKet: string | null
  onQuayLai: () => void
  onHetPhien: () => void
}

/** Dòng người được giao; người đã rời Dự án kèm dấu hiệu "đã rời dự án". */
function DongNguoi({ nhan, nguoi }: { nhan: string; nguoi: NguoiCuaTask }) {
  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      <Text>{`${nhan}: ${nguoi.tenHienThi}`}</Text>
      {nguoi.daRoiDuAn && <Token label={THONG_BAO_SUA_TASK.daRoiDuAn} color="orange" />}
    </HStack>
  )
}

/**
 * Chi tiết một Task: người được giao, hạn, trạng thái, số lần bị Trả lại và dấu vết. PM hoặc Support
 * của Dự án sửa được và đổi người khi Task chưa ở trạng thái cuối; người khác chỉ xem, kèm lý do.
 */
export function ManChiTietTask({
  phien,
  vai,
  taskId,
  nhanQuayLai,
  lyDoKhongGhiLienKet,
  trangThaiDuAn,
  dongHo,
  tenDuAn,
  thongBaoBanDau,
  onQuayLai,
  onHetPhien,
}: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<Task> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const [thongBaoSua, setThongBaoSua] = useState<string | null>(null)

  useEffect(() => {
    let huy = false
    kho.layTask(phien, taskId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ lan: lanTai, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, taskId, lanTai, onHetPhien])

  /** Link vừa đổi nên dấu vết chỉnh sửa của Task đã đổi: đọc lại Task mà không về màn đang tải. */
  async function docLaiTask() {
    const kq = await kho.layTask(phien, taskId)
    if (kq.ok) setDaTai({ lan: lanTai, kq })
  }

  const nutVe = (
    <HStack gap={2}>
      <Button label={nhanQuayLai ?? `Về Dự án ${tenDuAn}`} variant="ghost" onClick={onQuayLai} />
    </HStack>
  )

  if (tai === null) {
    return (
      <VStack gap={4}>
        {nutVe}
        <Spinner label="Đang tải Task…" />
      </VStack>
    )
  }

  if (!tai.ok) {
    return (
      <VStack gap={4}>
        {nutVe}
        <Banner
          status="error"
          title="Không tải được Task."
          description={tai.loi.thongBao}
          role="alert"
          endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
        />
      </VStack>
    )
  }

  const task = tai.giaTri
  const { taoBoi, taoLuc, suaBoi, suaLuc } = task.dauVet

  return (
    <VStack gap={4}>
      {nutVe}
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Heading level={2}>{task.tieuDe}</Heading>
        <Token label={TEN_TRANG_THAI_TASK[task.trangThai]} color={MAU_TRANG_THAI_TASK[task.trangThai]} />
      </HStack>
      {thongBaoBanDau && thongBaoSua === null && <Banner status="success" title={thongBaoBanDau} role="status" />}
      {thongBaoSua !== null && <Banner status="success" title={thongBaoSua} role="status" />}

      <VStack gap={1} role="group" aria-label="Thông tin Task">
        <Heading level={3}>Thông tin</Heading>
        <Text>{`Trạng thái: ${TEN_TRANG_THAI_TASK[task.trangThai]}`}</Text>
        <DongNguoi nhan="Người thực hiện" nguoi={task.nguoiThucHien} />
        <DongNguoi nhan="Người kiểm tra" nguoi={task.nguoiKiemTra} />
        <Text>{`Hạn: ${task.han === null ? 'Không có hạn' : dinhDangNgay(task.han)}`}</Text>
        <Text>{`Số lần bị Trả lại: ${task.soLanTraLai}`}</Text>
      </VStack>

      <VStack gap={1} role="group" aria-label="Mô tả">
        <Heading level={3}>Mô tả</Heading>
        <Text>{task.moTa === '' ? 'Không có mô tả.' : task.moTa}</Text>
      </VStack>

      <PhanLienKetTask
        phien={phien}
        taskId={taskId}
        lyDoKhongGhi={lyDoKhongGhiLienKet}
        dongHo={dongHo}
        onDaDoi={docLaiTask}
        onHetPhien={onHetPhien}
      />

      <VStack gap={1} role="group" aria-label="Dấu vết">
        <Heading level={3}>Dấu vết</Heading>
        <Text>{`Người tạo: ${taoBoi.tenHienThi}`}</Text>
        <Text>{`Ngày tạo: ${dinhDangNgayGio(taoLuc)}`}</Text>
        {suaBoi && suaLuc ? (
          <>
            <Text>{`Người chỉnh sửa gần nhất: ${suaBoi.tenHienThi}`}</Text>
            <Text>{`Ngày chỉnh sửa gần nhất: ${dinhDangNgayGio(suaLuc)}`}</Text>
          </>
        ) : (
          <Text>Chưa có ai chỉnh sửa.</Text>
        )}
        <Text>Ngày giờ theo giờ Việt Nam.</Text>
      </VStack>

      <PhanSuaTask
        key={task.id}
        phien={phien}
        vai={vai}
        task={task}
        trangThaiDuAn={trangThaiDuAn}
        dongHo={dongHo}
        onDaCapNhat={(moi, thongBao) => {
          setDaTai({ lan: lanTai, kq: { ok: true, giaTri: moi } })
          setThongBaoSua(thongBao)
        }}
        onCanDocLai={() => setLanTai((n) => n + 1)}
        onHetPhien={onHetPhien}
      />
    </VStack>
  )
}
