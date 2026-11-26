import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, NguoiCuaTask, NguoiTrongDuAn, Phien, Task } from '../kho/khoDuLieu'
import { dinhDangNgayGio, tenKemMa, type TrangThaiDuAn } from '../luat/duAn'
import { lyDoKhongGhiLienKet } from '../luat/github'
import { TEN_TRANG_THAI_TASK, THONG_BAO_SUA_TASK, dinhDangNgay, lyDoKhongSuaTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { MAU_TRANG_THAI_TASK } from './mauTrangThaiTask'
import { NganTruot } from './NganTruot'
import { NhanMucUuTien } from './NhanMucUuTien'
import { PhanChuyenTrangThaiTask } from './PhanChuyenTrangThaiTask'
import { PhanLichSuTask } from './PhanLichSuTask'
import { PhanLienKetTask } from './PhanLienKetTask'
import { PhanSuaTask } from './PhanSuaTask'

/** Task cần mở trong Ngăn trượt: đủ để hiện tiêu đề ngay trong lúc đọc chi tiết từ Kho. */
export interface TaskCanMo {
  id: string
  duAnId: string
  tieuDe: string
  /** Tên Dự án chứa Task, hiện dưới tiêu đề khi mở từ danh sách qua mọi Dự án. */
  tenDuAn?: string
  /** Mã của Dự án chứa Task, hiện cạnh tên Dự án. */
  maDuAn?: string
}

interface Props {
  phien: Phien
  vai: VaiHeThong
  dongHo: () => Date
  /** Task đang mở; null là ngăn đóng. Nơi gọi giữ đối tượng này trong state (so theo tham chiếu). */
  task: TaskCanMo | null
  /** Trạng thái Dự án chứa Task khi nơi gọi đã biết (trang chi tiết Dự án); không có thì ngăn tự đọc Dự án. */
  trangThaiDuAn?: TrangThaiDuAn
  onDong: () => void
  /** Task vừa đổi trong ngăn (trạng thái, nội dung, người, link): trang phía sau đọc lại dữ liệu. */
  onDaDoi: (task: Task) => void
  onHetPhien: () => void
}

/**
 * Xem một Task trong Ngăn trượt, dùng chung cho mọi chỗ mở Task (Kanban, Việc của tôi, Chờ tôi duyệt,
 * Tổng quan). Trang phía sau ở nguyên; đóng ngăn thì về đúng chỗ cũ. Nội dung giữ nguyên trong lúc
 * ngăn trượt ra, rồi mới bỏ đi.
 */
export function NganTruotTask({ phien, vai, dongHo, task, trangThaiDuAn, onDong, onDaDoi, onHetPhien }: Props) {
  const [dangHien, setDangHien] = useState<TaskCanMo | null>(null)
  const [taskMoi, setTaskMoi] = useState<Task | null>(null)
  if (task !== null && task !== dangHien) {
    setDangHien(task)
    setTaskMoi(null)
  }
  const refTask = useRef(task)
  useEffect(() => {
    refTask.current = task
  }, [task])

  // Tiêu đề đọc từ Kho (có thể vừa sửa trong ngăn) thắng tiêu đề nơi gọi truyền vào.
  const tieuDe = taskMoi !== null && taskMoi.id === dangHien?.id ? taskMoi.tieuDe : (dangHien?.tieuDe ?? 'Task')

  return (
    <NganTruot
      isOpen={task !== null}
      tieuDe={tieuDe}
      phuDe={
        dangHien?.tenDuAn === undefined ? undefined : tenKemMa({ ma: dangHien.maDuAn ?? '', ten: dangHien.tenDuAn })
      }
      onDong={onDong}
      onDaDongXong={() => {
        if (refTask.current === null) setDangHien(null)
      }}
    >
      {dangHien && (
        <ChiTietTaskTrongNgan
          key={dangHien.id}
          phien={phien}
          vai={vai}
          dongHo={dongHo}
          taskCanMo={dangHien}
          trangThaiDuAnBiet={trangThaiDuAn}
          onCoTask={setTaskMoi}
          onDaDoi={onDaDoi}
          onHetPhien={onHetPhien}
        />
      )}
    </NganTruot>
  )
}

/** Các tab phía dưới của ngăn Task, theo thứ tự hiện; tab Lịch sử mở sẵn. Tab Sửa chỉ hiện khi được sửa. */
const CAC_TAB = ['lichSu', 'lienKet', 'sua'] as const
type TabTask = (typeof CAC_TAB)[number]

const TEN_TAB: Record<TabTask, string> = {
  lichSu: 'Lịch sử',
  lienKet: 'Link GitHub',
  sua: 'Sửa',
}

function laTabTask(giaTri: string): giaTri is TabTask {
  return (CAC_TAB as readonly string[]).includes(giaTri)
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

interface PropsChiTiet {
  phien: Phien
  vai: VaiHeThong
  dongHo: () => Date
  taskCanMo: TaskCanMo
  trangThaiDuAnBiet: TrangThaiDuAn | undefined
  /** Task vừa đọc hoặc vừa đổi: ngăn lấy tiêu đề mới nhất cho phần đầu. */
  onCoTask: (task: Task) => void
  onDaDoi: (task: Task) => void
  onHetPhien: () => void
}

/**
 * Nội dung ngăn Task. Phía trên: trạng thái, người được giao, hạn, số lần bị Trả lại, các nút chuyển
 * trạng thái người dùng được phép, mô tả và dấu vết. Phía dưới: tab Lịch sử, Link GitHub và Sửa (tab
 * Sửa chỉ hiện khi luật cho phép sửa; không được thì nói lý do).
 */
function ChiTietTaskTrongNgan({
  phien,
  vai,
  dongHo,
  taskCanMo,
  trangThaiDuAnBiet,
  onCoTask,
  onDaDoi,
  onHetPhien,
}: PropsChiTiet) {
  const kho = useKho()
  const taskId = taskCanMo.id
  const duAnId = taskCanMo.duAnId
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<Task> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  // Mở từ danh sách qua mọi Dự án thì chưa biết Dự án đã Lưu trữ hay chưa: đọc Dự án chứa Task.
  const canDocDuAn = trangThaiDuAnBiet === undefined
  const [lanTaiDuAn, setLanTaiDuAn] = useState(0)
  const [daTaiDuAn, setDaTaiDuAn] = useState<{ lan: number; kq: KetQua<DuAn> } | null>(null)
  const taiDuAn = daTaiDuAn && daTaiDuAn.lan === lanTaiDuAn ? daTaiDuAn.kq : null
  // Người trong dự án: để biết có được sửa không (hiện tab Sửa) và để chọn người khi sửa.
  const [lanTaiNguoi, setLanTaiNguoi] = useState(0)
  const [daTaiNguoi, setDaTaiNguoi] = useState<{ lan: number; kq: KetQua<NguoiTrongDuAn[]> } | null>(null)
  const taiNguoi = daTaiNguoi && daTaiNguoi.lan === lanTaiNguoi ? daTaiNguoi.kq : null
  const [thongBaoSua, setThongBaoSua] = useState<string | null>(null)
  /** Tăng mỗi khi trạng thái Task đổi, để lịch sử đọc lại. */
  const [lanLichSu, setLanLichSu] = useState(0)
  const [tab, setTab] = useState<TabTask>('lichSu')
  const idTab = useId()

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

  useEffect(() => {
    if (!canDocDuAn) return
    let huy = false
    kho.layDuAn(phien, duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTaiDuAn({ lan: lanTaiDuAn, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, duAnId, canDocDuAn, lanTaiDuAn, onHetPhien])

  useEffect(() => {
    let huy = false
    kho.danhSachNguoiTrongDuAn(phien, duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTaiNguoi({ lan: lanTaiNguoi, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, duAnId, lanTaiNguoi, onHetPhien])

  const taskDaTai = tai?.ok ? tai.giaTri : null
  useEffect(() => {
    if (taskDaTai) onCoTask(taskDaTai)
  }, [taskDaTai, onCoTask])

  /** Task vừa đổi trong ngăn: hiện bản mới và báo trang phía sau đọc lại. */
  function capNhat(moi: Task) {
    setDaTai({ lan: lanTai, kq: { ok: true, giaTri: moi } })
    onDaDoi(moi)
  }

  /** Link vừa đổi nên dấu vết chỉnh sửa của Task đã đổi: đọc lại Task mà không về màn đang tải. */
  async function docLaiTask() {
    const kq = await kho.layTask(phien, taskId)
    if (kq.ok) capNhat(kq.giaTri)
  }

  if (tai === null) return <Spinner label="Đang tải Task…" />

  if (!tai.ok) {
    return (
      <Banner
        status="error"
        title="Không tải được Task."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
      />
    )
  }

  let trangThaiDuAn: TrangThaiDuAn
  if (trangThaiDuAnBiet !== undefined) {
    trangThaiDuAn = trangThaiDuAnBiet
  } else if (taiDuAn === null) {
    return <Spinner label="Đang tải Task…" />
  } else if (!taiDuAn.ok) {
    return (
      <Banner
        status="error"
        title="Không tải được Dự án chứa Task này."
        description={taiDuAn.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTaiDuAn((n) => n + 1)} />}
      />
    )
  } else {
    trangThaiDuAn = taiDuAn.giaTri.trangThai
  }

  const task = tai.giaTri
  const { taoBoi, taoLuc, suaBoi, suaLuc } = task.dauVet

  // Cùng luật với Kho: không có quyền, Dự án đã Lưu trữ hay Task đã chốt thì không có tab Sửa, chỉ có lý do.
  const lyDoKhongSua =
    taiNguoi?.ok === true
      ? lyDoKhongSuaTask({
          vaiNguoiGoi: vai,
          laNguoiTrongDuAn: taiNguoi.giaTri.some((nguoi) => nguoi.id === phien.nguoiDungId),
          trangThai: trangThaiDuAn,
          trangThaiTask: task.trangThai,
        })
      : null
  const duocSua = taiNguoi?.ok === true && lyDoKhongSua === null
  const cacTab = CAC_TAB.filter((t) => t !== 'sua' || duocSua)
  // Vừa mất quyền sửa (vd. Task vừa chốt) khi đang ở tab Sửa: về tab đầu.
  const tabHien: TabTask = cacTab.includes(tab) ? tab : 'lichSu'

  let quyenSua: ReactNode = null
  if (taiNguoi === null) {
    quyenSua = <Spinner label="Đang kiểm quyền sửa Task…" />
  } else if (!taiNguoi.ok) {
    quyenSua = (
      <Banner
        status="error"
        title="Không tải được người trong dự án để kiểm quyền và chọn người."
        description={taiNguoi.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTaiNguoi((n) => n + 1)} />}
      />
    )
  } else if (lyDoKhongSua !== null) {
    quyenSua = <Text type="supporting">{lyDoKhongSua}</Text>
  }

  let noiDungTab: ReactNode
  if (tabHien === 'lichSu') {
    noiDungTab = <PhanLichSuTask phien={phien} taskId={task.id} lanDoc={lanLichSu} onHetPhien={onHetPhien} />
  } else if (tabHien === 'lienKet') {
    noiDungTab = (
      <PhanLienKetTask
        phien={phien}
        taskId={taskId}
        // Ai mở được Task thì thấy Dự án nên ở trong Dự án (hoặc là PM): chỉ còn trạng thái Lưu trữ.
        lyDoKhongGhi={lyDoKhongGhiLienKet({ vaiNguoiGoi: vai, laNguoiTrongDuAn: true, trangThai: trangThaiDuAn })}
        dongHo={dongHo}
        onDaDoi={docLaiTask}
        onHetPhien={onHetPhien}
      />
    )
  } else {
    noiDungTab = taiNguoi?.ok === true && (
      <PhanSuaTask
        phien={phien}
        task={task}
        nguoiTrong={taiNguoi.giaTri}
        dongHo={dongHo}
        onDaCapNhat={(moi, thongBao) => {
          capNhat(moi)
          setThongBaoSua(thongBao)
          // Đổi Mức ưu tiên ghi một dòng lịch sử: tab Lịch sử đọc lại.
          setLanLichSu((n) => n + 1)
        }}
        onCanDocLai={() => {
          setLanTai((n) => n + 1)
          setLanTaiNguoi((n) => n + 1)
        }}
        onHetPhien={onHetPhien}
      />
    )
  }

  // Một vùng nội dung dùng chung cho các tab: mọi tab trỏ vào nó, nó mang tên tab đang chọn.
  const idVung = `${idTab}-vung`
  const idCuaTab = (t: TabTask) => `${idTab}-tab-${t}`

  return (
    <VStack gap={4}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Token label={TEN_TRANG_THAI_TASK[task.trangThai]} color={MAU_TRANG_THAI_TASK[task.trangThai]} />
      </HStack>
      {thongBaoSua !== null && <Banner status="success" title={thongBaoSua} role="status" />}

      <VStack gap={1} role="group" aria-label="Thông tin Task">
        <Heading level={3}>Thông tin</Heading>
        <Text>{`Trạng thái: ${TEN_TRANG_THAI_TASK[task.trangThai]}`}</Text>
        <DongNguoi nhan="Người thực hiện" nguoi={task.nguoiThucHien} />
        <DongNguoi nhan="Người kiểm tra" nguoi={task.nguoiKiemTra} />
        <HStack gap={2} vAlign="center">
          <Text>Mức ưu tiên:</Text>
          <NhanMucUuTien mucUuTien={task.mucUuTien} size="sm" />
        </HStack>
        <Text>{`Hạn: ${task.han === null ? 'Không có hạn' : dinhDangNgay(task.han)}`}</Text>
        <Text>{`Số lần bị Trả lại: ${task.soLanTraLai}`}</Text>
      </VStack>

      <PhanChuyenTrangThaiTask
        phien={phien}
        vai={vai}
        task={task}
        trangThaiDuAn={trangThaiDuAn}
        dongHo={dongHo}
        onDaCapNhat={(moi, thongBao) => {
          capNhat(moi)
          if (thongBao !== null) setThongBaoSua(thongBao)
          setLanLichSu((n) => n + 1)
        }}
        onHetPhien={onHetPhien}
      />

      <VStack gap={1} role="group" aria-label="Mô tả">
        <Heading level={3}>Mô tả</Heading>
        <Text>{task.moTa === '' ? 'Không có mô tả.' : task.moTa}</Text>
      </VStack>

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

      {quyenSua !== null && (
        <VStack gap={2} role="group" aria-label="Quyền sửa Task">
          {quyenSua}
        </VStack>
      )}

      <TabList
        role="tablist"
        aria-label="Các phần của Task"
        hasDivider
        value={tabHien}
        onChange={(giaTri) => {
          if (laTabTask(giaTri)) setTab(giaTri)
        }}
      >
        {cacTab.map((t) => (
          <Tab key={t} id={idCuaTab(t)} value={t} label={TEN_TAB[t]} panelId={idVung} />
        ))}
      </TabList>
      <VStack gap={4} id={idVung} role="tabpanel" aria-labelledby={idCuaTab(tabHien)}>
        {noiDungTab}
      </VStack>
    </VStack>
  )
}
