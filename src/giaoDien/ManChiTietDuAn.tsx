import { useEffect, useId, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua, LoiKho } from '../kho/ketQua'
import type { DuAn, NguoiTrongDuAn, Phien, Task } from '../kho/khoDuLieu'
import { TEN_TRANG_THAI_DU_AN, dinhDangNgayGio, kiemMoLaiDuAn, lyDoKhongSuaDuAn } from '../luat/duAn'
import { lyDoKhongGanRepo } from '../luat/github'
import { lyDoKhongTaoTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { nhanTienDo, taskTreHan, tinhTienDo } from '../luat/tienDo'
import { useKho } from './khoContext'
import { NganTruotSuaDuAn } from './NganTruotDuAn'
import { NganTruotTaoTask } from './NganTruotTaoTask'
import { NganTruotTask, type TaskCanMo } from './NganTruotTask'
import { PhanNguoiTrongDuAn } from './PhanNguoiTrongDuAn'
import { PhanRepoGitHub } from './PhanRepoGitHub'
import { PhanTaskCuaDuAn } from './PhanTaskCuaDuAn'

interface Props {
  phien: Phien
  vai: VaiHeThong
  duAnId: string
  dongHo: () => Date
  onQuayLai: () => void
  onHetPhien: () => void
}

type Viec = 'luuTru' | 'moLai'

/** Các tab của trang chi tiết Dự án, theo thứ tự hiện; tab Task mở sẵn. */
const CAC_TAB = ['task', 'nguoi', 'thongTin', 'github'] as const
type TabDuAn = (typeof CAC_TAB)[number]

const TEN_TAB: Record<TabDuAn, string> = {
  task: 'Task',
  nguoi: 'Người trong dự án',
  thongTin: 'Thông tin',
  github: 'GitHub',
}

function laTabDuAn(giaTri: string): giaTri is TabDuAn {
  return (CAC_TAB as readonly string[]).includes(giaTri)
}

type ThongBao = { loai: 'thanhCong'; noiDung: string } | { loai: 'loi'; tieuDe: string; loi: LoiKho }

/** Thông báo sau khi lưu biểu mẫu sửa Dự án trong Ngăn trượt. */
const DA_LUU_DU_AN = 'Đã lưu thay đổi.'

const TIEU_DE_LOI: Record<Viec, string> = {
  luuTru: 'Không Lưu trữ được Dự án.',
  moLai: 'Không mở lại được Dự án.',
}

const DA_XONG: Record<Viec, string> = {
  luuTru: 'Đã Lưu trữ Dự án. Dự án giờ chỉ xem được.',
  moLai: 'Đã mở lại Dự án. Bạn có thể sửa tiếp.',
}

/** Quyền của Support phụ thuộc danh sách người trong dự án; chưa có danh sách thì chưa rõ quyền. */
const LY_DO_CHUA_RO_QUYEN = {
  dangTai: 'Đang kiểm quyền của bạn trên Dự án này…',
  loi: 'Chưa kiểm được quyền của bạn vì không tải được người trong dự án.',
} as const

/**
 * Chi tiết một Dự án: dải tóm tắt cố định (tên, trạng thái, Tiến độ, số Task Trễ hạn) và bốn tab:
 * Task (Kanban, mở sẵn), Người trong dự án, Thông tin (mô tả, dấu vết, Lưu trữ và mở lại), GitHub
 * (repo đã gắn). Đổi tab vẫn ở cùng Dự án; chỉ tab đang chọn được vẽ. Xem Task, tạo Task và sửa Dự
 * án đều mở trong Ngăn trượt đè lên trang, nên đóng ngăn là về đúng tab và bộ lọc Kanban đang đặt.
 */
export function ManChiTietDuAn({ phien, vai, duAnId, dongHo, onQuayLai, onHetPhien }: Props) {
  const kho = useKho()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<DuAn> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const [lanTaiNguoi, setLanTaiNguoi] = useState(0)
  const [daTaiNguoi, setDaTaiNguoi] = useState<{ lan: number; kq: KetQua<NguoiTrongDuAn[]> } | null>(null)
  const taiNguoi = daTaiNguoi && daTaiNguoi.lan === lanTaiNguoi ? daTaiNguoi.kq : null
  const [dangLam, setDangLam] = useState<Viec | null>(null)
  const [thongBao, setThongBao] = useState<ThongBao | null>(null)
  const [dangTaoTask, setDangTaoTask] = useState(false)
  const [dangSuaDuAn, setDangSuaDuAn] = useState(false)
  const [taskDangMo, setTaskDangMo] = useState<TaskCanMo | null>(null)
  const [tab, setTab] = useState<TabDuAn>('task')
  const idTab = useId()
  // Task của Dự án đọc ở đây (không ở tab Task) vì dải tóm tắt cần Tiến độ và số Task Trễ hạn.
  // Thêm hay gỡ người đổi dấu hiệu "đã rời dự án" trên Task nên đọc lại bảng Task. Task tạo hay đổi
  // trong Ngăn trượt thì đọc lại ngầm (xem docLaiTaskNgam).
  const [lanTaiTask, setLanTaiTask] = useState(0)
  const [daTaiTask, setDaTaiTask] = useState<{ lan: number; kq: KetQua<Task[]> } | null>(null)
  const taiTask = daTaiTask && daTaiTask.lan === lanTaiTask ? daTaiTask.kq : null

  useEffect(() => {
    let huy = false
    kho.layDuAn(phien, duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') {
        onHetPhien()
        return
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

  useEffect(() => {
    let huy = false
    kho.danhSachTask(phien, duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') {
        onHetPhien()
        return
      }
      setDaTaiTask({ lan: lanTaiTask, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, duAnId, lanTaiTask, onHetPhien])

  function taiLaiTatCa() {
    setLanTai((n) => n + 1)
    setLanTaiNguoi((n) => n + 1)
    setLanTaiTask((n) => n + 1)
  }

  /** Thay một Task trong bảng đã tải bằng bản mới (vừa đổi trạng thái hoặc vừa đọc lại trên Kanban). */
  function thayTask(moi: Task) {
    setDaTaiTask((cu) =>
      cu && cu.kq.ok
        ? { lan: cu.lan, kq: { ok: true, giaTri: cu.kq.giaTri.map((task) => (task.id === moi.id ? moi : task)) } }
        : cu,
    )
  }

  /**
   * Task vừa tạo hay vừa đổi trong Ngăn trượt: đọc lại bảng Task mà không qua trạng thái đang tải, để
   * Kanban (và bộ lọc đang đặt, nút mở ngăn) ở nguyên phía sau ngăn, chỉ thẻ và dải tóm tắt cập nhật.
   * Đọc lỗi thì giữ bảng cũ (và thay riêng Task vừa đổi nếu có).
   */
  async function docLaiTaskNgam(moi?: Task) {
    if (moi) thayTask(moi)
    const kq = await kho.danhSachTask(phien, duAnId)
    if (!kq.ok) {
      if (kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      return
    }
    setDaTaiTask((cu) => (cu && cu.kq.ok ? { lan: cu.lan, kq } : cu))
  }

  /** Mở một Task của Dự án này trong Ngăn trượt (từ Kanban, danh sách Task Trễ hạn hay Task đang giữ). */
  function moTask(taskId: string) {
    const daBiet = taiTask?.ok ? taiTask.giaTri.find((task) => task.id === taskId) : undefined
    setTaskDangMo({ id: taskId, duAnId, tieuDe: daBiet?.tieuDe ?? 'Task' })
  }

  function doiDanhSachNguoi(capNhat: (cu: NguoiTrongDuAn[]) => NguoiTrongDuAn[]) {
    setLanTaiTask((n) => n + 1)
    setDaTaiNguoi((cu) => (cu && cu.kq.ok ? { lan: cu.lan, kq: { ok: true, giaTri: capNhat(cu.kq.giaTri) } } : cu))
  }

  /** Dự án hay quyền đã đổi ở nơi khác: đọc lại Dự án và người trong dự án. */
  async function docLai() {
    setLanTaiNguoi((n) => n + 1)
    const docLaiDuAn = await kho.layDuAn(phien, duAnId)
    if (docLaiDuAn.ok) setDaTai({ lan: lanTai, kq: docLaiDuAn })
  }

  function hienDuAn(duAn: DuAn) {
    setDaTai({ lan: lanTai, kq: { ok: true, giaTri: duAn } })
  }

  async function lam(viec: Viec) {
    if (dangLam) return
    setDangLam(viec)
    setThongBao(null)
    const bayGio = dongHo()
    const kq =
      viec === 'luuTru' ? await kho.luuTruDuAn(phien, duAnId, bayGio) : await kho.moLaiDuAn(phien, duAnId, bayGio)
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

  const thongTin = (
    <VStack gap={4}>
      <VStack gap={1} role="group" aria-label="Mô tả Dự án">
        <Heading level={3}>Mô tả</Heading>
        <Text>{duAn.moTa === '' ? 'Dự án chưa có mô tả.' : duAn.moTa}</Text>
      </VStack>

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

      <HStack gap={2} wrap="wrap">
        {lyDoKhongSua === null && (
          <>
            <Button
              label="Sửa Dự án"
              variant="primary"
              onClick={() => {
                setThongBao(null)
                setDangSuaDuAn(true)
              }}
            />
            <Button label="Lưu trữ Dự án" variant="secondary" isLoading={dangLam === 'luuTru'} onClick={() => lam('luuTru')} />
          </>
        )}
        {moLaiDuoc && (
          <Button label="Mở lại Dự án" variant="primary" isLoading={dangLam === 'moLai'} onClick={() => lam('moLai')} />
        )}
      </HStack>
    </VStack>
  )

  let noiDungTab: ReactNode
  if (tab === 'task') {
    noiDungTab = (
      <PhanTaskCuaDuAn
        vai={vai}
        trangThaiDuAn={duAn.trangThai}
        laNguoiTrongDuAn={
          taiNguoi?.ok === true
            ? taiNguoi.giaTri.some((nguoi) => nguoi.id === phien.nguoiDungId)
            : vai === 'PM'
              ? false
              : null
        }
        dongHo={dongHo}
        key={lanTaiTask}
        phien={phien}
        tai={taiTask}
        lyDoKhongTao={lyDoKhongTaoTaskMoi}
        onThuLai={() => setLanTaiTask((n) => n + 1)}
        onDaDoi={thayTask}
        onTao={() => {
          setThongBao(null)
          setDangTaoTask(true)
        }}
        onMo={(taskId) => moTask(taskId)}
        onHetPhien={onHetPhien}
      />
    )
  } else if (tab === 'nguoi') {
    noiDungTab = (
      <PhanNguoiTrongDuAn
        phien={phien}
        duAnId={duAnId}
        tai={taiNguoi}
        lyDoKhongGhi={lyDoKhongSua}
        onThuLai={() => setLanTaiNguoi((n) => n + 1)}
        onDoiDanhSach={doiDanhSachNguoi}
        onCanDocLai={docLai}
        onMoTask={(taskId) => moTask(taskId)}
        onHetPhien={onHetPhien}
      />
    )
  } else if (tab === 'thongTin') {
    noiDungTab = thongTin
  } else {
    noiDungTab = (
      <PhanRepoGitHub
        phien={phien}
        duAnId={duAnId}
        lyDoKhongGhi={lyDoKhongGanRepoMoi}
        onCanDocLai={docLai}
        onHetPhien={onHetPhien}
      />
    )
  }

  // Một vùng nội dung dùng chung cho cả bốn tab: mọi tab trỏ vào nó, nó mang tên tab đang chọn.
  const idVung = `${idTab}-vung`
  const idCuaTab = (t: TabDuAn) => `${idTab}-tab-${t}`

  return (
    <VStack gap={4}>
      {nutVe}
      <DaiTomTat duAn={duAn} taiTask={taiTask} bayGio={dongHo()} />

      {thongBao?.loai === 'thanhCong' && <Banner status="success" title={thongBao.noiDung} role="status" />}
      {thongBao?.loai === 'loi' && (
        <Banner status="error" title={thongBao.tieuDe} description={thongBao.loi.thongBao} role="alert" />
      )}
      {lyDoKhongSua && <Banner status="info" title={lyDoKhongSua} />}

      <TabList
        role="tablist"
        aria-label="Các phần của Dự án"
        hasDivider
        value={tab}
        onChange={(giaTri) => {
          if (laTabDuAn(giaTri)) setTab(giaTri)
        }}
      >
        {CAC_TAB.map((t) => (
          <Tab key={t} id={idCuaTab(t)} value={t} label={TEN_TAB[t]} panelId={idVung} />
        ))}
      </TabList>
      <VStack gap={4} id={idVung} role="tabpanel" aria-labelledby={idCuaTab(tab)}>
        {noiDungTab}
      </VStack>

      <NganTruotTask
        phien={phien}
        vai={vai}
        dongHo={dongHo}
        task={taskDangMo}
        trangThaiDuAn={duAn.trangThai}
        onDong={() => setTaskDangMo(null)}
        onDaDoi={docLaiTaskNgam}
        onHetPhien={onHetPhien}
      />
      <NganTruotTaoTask
        isOpen={dangTaoTask}
        phien={phien}
        vai={vai}
        duAn={duAn}
        dongHo={dongHo}
        onDong={() => setDangTaoTask(false)}
        onDaTao={(task) => {
          // Ngăn đóng, Kanban phía sau đọc lại ngầm nên Task mới hiện ở cột Mới.
          setDangTaoTask(false)
          setThongBao({ loai: 'thanhCong', noiDung: `Đã tạo Task ${task.tieuDe}.` })
          void docLaiTaskNgam()
        }}
        onHetPhien={onHetPhien}
      />
      <NganTruotSuaDuAn
        isOpen={dangSuaDuAn}
        phien={phien}
        duAn={duAn}
        lyDoKhongSua={lyDoKhongSua}
        dongHo={dongHo}
        onDong={() => setDangSuaDuAn(false)}
        onDaLuu={(moi) => {
          // Ngăn đóng; dải tóm tắt và tab Thông tin hiện ngay tên, mô tả và dấu vết mới.
          setDangSuaDuAn(false)
          hienDuAn(moi)
          setThongBao({ loai: 'thanhCong', noiDung: DA_LUU_DU_AN })
        }}
        onCanDocLai={() => void docLai()}
        onHetPhien={onHetPhien}
      />
    </VStack>
  )
}

/**
 * Dải tóm tắt ở đầu trang chi tiết Dự án: tên, trạng thái, Tiến độ và số Task Trễ hạn (cùng luật với
 * Tổng quan). Task chưa tải xong hay tải lỗi thì nói rõ thay vì hiện số sai.
 */
function DaiTomTat({ duAn, taiTask, bayGio }: { duAn: DuAn; taiTask: KetQua<Task[]> | null; bayGio: Date }) {
  const tienDo =
    taiTask === null ? 'Đang tính…' : taiTask.ok ? nhanTienDo(tinhTienDo(taiTask.giaTri)) : 'Chưa tính được'
  const soTreHan =
    taiTask === null ? 'Đang tính…' : taiTask.ok ? String(taskTreHan(taiTask.giaTri, bayGio).length) : 'Chưa tính được'
  return (
    <VStack gap={2} role="group" aria-label="Tóm tắt Dự án">
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Heading level={2}>{duAn.ten}</Heading>
        <Token
          label={TEN_TRANG_THAI_DU_AN[duAn.trangThai]}
          color={duAn.trangThai === 'LUU_TRU' ? 'gray' : 'green'}
        />
      </HStack>
      <HStack gap={6} wrap="wrap">
        <VStack gap={1} role="group" aria-label="Tiến độ của Dự án">
          <Text type="supporting">Tiến độ</Text>
          <Text weight="semibold" hasTabularNumbers>
            {tienDo}
          </Text>
        </VStack>
        <VStack gap={1} role="group" aria-label="Số Task Trễ hạn">
          <Text type="supporting">Task Trễ hạn</Text>
          <Text weight="semibold" hasTabularNumbers>
            {soTreHan}
          </Text>
        </VStack>
      </HStack>
    </VStack>
  )
}
