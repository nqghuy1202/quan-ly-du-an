import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import { thanhCong, type KetQua } from '../kho/ketQua'
import type { Phien } from '../kho/khoDuLieu'
import { docTongQuan, type DongTongQuan, type TaskCuaTongQuan, type TongQuan } from '../kho/tongQuan'
import { duocTaoDuAn } from '../luat/duAn'
import { CAC_TRANG_THAI_TASK, TEN_TRANG_THAI_TASK, dinhDangNgay, type TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { NHAN_QUA_HAN_DU_KIEN, nhanTienDo } from '../luat/tienDo'
import { SO_NGAY_TOI_HAN, type OSoTongQuan } from '../luat/tongQuan'
import { useBoGiuDuLieu, useGiuKetQua } from './boGiuDuLieu'
import { useKho } from './khoContext'
import { ManChiTietDuAnTaiLuoi } from './cacManTaiLuoi'
import { BIEN_THE_THANH_TRANG_THAI_TASK } from './mauTrangThaiTask'
import { NganTruotTaoDuAn } from './NganTruotDuAn'
import { NganTruotTask } from './NganTruotTask'

/** Hai trang mở được từ ô số. */
export type TrangTuOSo = 'viecCuaToi' | 'choToiDuyet'

interface Props {
  phien: Phien
  vai: VaiHeThong
  /** Đồng hồ: ngày hôm nay (giờ Việt Nam) cho Trễ hạn và tới hạn, và dấu vết khi sửa ở màn chi tiết. */
  dongHo: () => Date
  /** Mở trang Việc của tôi hoặc Chờ tôi duyệt (đổi mục đang chọn trên Thanh bên). */
  onMoTrang: (trang: TrangTuOSo) => void
  onHetPhien: () => void
}

/** Dấu trên dòng Dự án đang hoạt động chưa có Người phụ trách (chỉ PM và Support thấy). */
export const NHAN_CHUA_CO_NGUOI_PHU_TRACH = 'Chưa có Người phụ trách'

/** Độ rộng tối thiểu (điểm ảnh) của một ô số trước khi hàng ô số xuống dòng; là độ rộng cấu trúc. */
const RONG_O_SO = 176

/** Số dòng đầu một vùng Task ở Tổng quan hiện khi chưa bấm "Xem tất cả". */
const SO_DONG_TASK_GON = 5

/** Khoá của Tổng quan trong bộ giữ dữ liệu lần trước của phiên. */
const KHOA_GIU = 'tongQuan'

type ManCon = { loai: 'tongQuan' } | { loai: 'duAn'; duAnId: string }

const NHAN_O_SO: Record<keyof OSoTongQuan, string> = {
  duAnDangHoatDong: 'Dự án đang hoạt động',
  duAnQuaHanDuKien: 'Dự án Quá hạn dự kiến',
  taskDangMo: 'Task đang mở',
  taskTreHan: 'Task Trễ hạn',
  choToiDuyet: 'Chờ tôi duyệt',
  viecCuaToi: 'Việc của tôi',
}

/** Nội dung một ô số: nhãn và con số (số đếm, không phải Badge). */
function NoiDungOSo({ nhan, so }: { nhan: string; so: number }) {
  return (
    <VStack gap={1} role="group" aria-label={nhan}>
      <Text color="secondary">{nhan}</Text>
      <Text type="display-3" hasTabularNumbers>
        {so}
      </Text>
    </VStack>
  )
}

function HangOSo({ oSo, onMoTrang }: { oSo: OSoTongQuan; onMoTrang: (trang: TrangTuOSo) => void }) {
  const oThuong = (khoa: 'duAnDangHoatDong' | 'duAnQuaHanDuKien' | 'taskDangMo' | 'taskTreHan') => (
    <Card
      key={khoa}
      variant={(khoa === 'taskTreHan' || khoa === 'duAnQuaHanDuKien') && oSo[khoa] > 0 ? 'red' : 'default'}>
      <NoiDungOSo nhan={NHAN_O_SO[khoa]} so={oSo[khoa]} />
    </Card>
  )
  const oMoTrang = (khoa: TrangTuOSo) => (
    <ClickableCard
      key={khoa}
      label={`${NHAN_O_SO[khoa]}: ${oSo[khoa]}. Mở trang ${NHAN_O_SO[khoa]}`}
      onClick={() => onMoTrang(khoa)}>
      <NoiDungOSo nhan={NHAN_O_SO[khoa]} so={oSo[khoa]} />
    </ClickableCard>
  )
  return (
    <VStack role="group" aria-label="Số liệu chính">
      <Grid columns={{ minWidth: RONG_O_SO, max: 6, repeat: 'fit' }} gap={4}>
        {oThuong('duAnDangHoatDong')}
        {oThuong('duAnQuaHanDuKien')}
        {oThuong('taskDangMo')}
        {oThuong('taskTreHan')}
        {oMoTrang('choToiDuyet')}
        {oMoTrang('viecCuaToi')}
      </Grid>
    </VStack>
  )
}

/** Một dòng bảng Dự án (kiểu đối tượng thuần, như Table đòi). */
type DongDuAn = { id: string; ma: string; ten: string; dong: DongTongQuan }

function BangDuAnHoatDong({ dong, onMo }: { dong: DongTongQuan[]; onMo: (duAnId: string) => void }) {
  const cot: TableColumn<DongDuAn>[] = [
    { key: 'ma', header: 'Mã', width: proportional(1), renderCell: (d) => <Text weight="semibold">{d.ma}</Text> },
    {
      key: 'ten',
      header: 'Dự án',
      width: proportional(2),
      renderCell: (d) => (
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Button label={d.ten} variant="ghost" onClick={() => onMo(d.id)} />
          {d.dong.quaHanDuKien && (
            <Token
              label={NHAN_QUA_HAN_DU_KIEN}
              color="red"
              size="sm"
              description="Đã qua Ngày kết thúc dự kiến mà Tiến độ chưa đủ 100%."
            />
          )}
          {d.dong.chuaCoNguoiPhuTrach && (
            <Token
              label={NHAN_CHUA_CO_NGUOI_PHU_TRACH}
              color="yellow"
              size="sm"
              description="Dự án đang hoạt động chưa có Người phụ trách."
            />
          )}
        </HStack>
      ),
    },
    {
      key: 'tienDo',
      header: 'Tiến độ',
      width: proportional(1),
      renderCell: (d) => <Text weight="semibold">{nhanTienDo(d.dong.tomTat.tienDo)}</Text>,
    },
    {
      key: 'treHan',
      header: 'Task Trễ hạn',
      width: proportional(1),
      align: 'end',
      renderCell: (d) => (
        <Text weight={d.dong.tomTat.soTaskTreHan > 0 ? 'semibold' : 'normal'} hasTabularNumbers>
          {d.dong.tomTat.soTaskTreHan}
        </Text>
      ),
    },
  ]
  const du: DongDuAn[] = dong.map((d) => ({ id: d.duAn.id, ma: d.duAn.ma, ten: d.duAn.ten, dong: d }))
  return (
    <VStack gap={3} role="group" aria-label="Dự án đang hoạt động">
      <Heading level={3}>Dự án đang hoạt động</Heading>
      <Table aria-label="Bảng Dự án đang hoạt động" data={du} columns={cot} idKey="id" density="compact" />
    </VStack>
  )
}

/** Một dòng danh sách Task (kiểu đối tượng thuần, như Table đòi). */
type DongTask = { id: string; tieuDe: string; maDuAn: string; tenDuAn: string; nguoiThucHien: string; han: string }

function DanhSachTask({
  tieuDe,
  moTa,
  trong,
  task,
  onMo,
}: {
  tieuDe: string
  moTa: string
  trong: string
  task: TaskCuaTongQuan[]
  onMo: (task: TaskCuaTongQuan) => void
}) {
  const cot: TableColumn<DongTask>[] = [
    {
      key: 'tieuDe',
      header: 'Task',
      width: proportional(2),
      renderCell: (d) => (
        <Button
          label={d.tieuDe}
          variant="ghost"
          onClick={() => {
            const t = task.find((x) => x.id === d.id)
            if (t) onMo(t)
          }}
        />
      ),
    },
    { key: 'maDuAn', header: 'Mã Dự án', width: proportional(1), renderCell: (d) => <Text weight="semibold">{d.maDuAn}</Text> },
    { key: 'tenDuAn', header: 'Dự án', width: proportional(1), renderCell: (d) => <Text>{d.tenDuAn}</Text> },
    {
      key: 'nguoiThucHien',
      header: 'Người thực hiện',
      width: proportional(1),
      renderCell: (d) => <Text>{d.nguoiThucHien}</Text>,
    },
    { key: 'han', header: 'Hạn', width: proportional(1), renderCell: (d) => <Text>{d.han}</Text> },
  ]
  const [moHet, setMoHet] = useState(false)
  const gon = !moHet && task.length > SO_DONG_TASK_GON
  const du: DongTask[] = (gon ? task.slice(0, SO_DONG_TASK_GON) : task).map((t) => ({
    id: t.id,
    tieuDe: t.tieuDe,
    maDuAn: t.maDuAn,
    tenDuAn: t.tenDuAn,
    nguoiThucHien: t.nguoiThucHien.tenHienThi,
    han: t.han === null ? 'Không có hạn' : dinhDangNgay(t.han),
  }))
  return (
    <VStack gap={3} role="group" aria-label={tieuDe}>
      <VStack gap={1}>
        <Heading level={3}>{tieuDe}</Heading>
        <Text color="secondary">{moTa}</Text>
      </VStack>
      {task.length === 0 ? (
        <Text>{trong}</Text>
      ) : (
        <VStack gap={2}>
          <Table aria-label={tieuDe} data={du} columns={cot} idKey="id" density="compact" />
          {gon && (
            <HStack>
              <Button label={`Xem tất cả (${task.length})`} variant="secondary" onClick={() => setMoHet(true)} />
            </HStack>
          )}
        </VStack>
      )}
    </VStack>
  )
}

function PhanBoTheoTrangThai({ phanBo }: { phanBo: Record<TrangThaiTask, number> }) {
  const tong = CAC_TRANG_THAI_TASK.reduce((cong, t) => cong + phanBo[t], 0)
  return (
    <VStack gap={3} role="group" aria-label="Phân bố Task theo trạng thái">
      <VStack gap={1}>
        <Heading level={3}>Phân bố Task theo trạng thái</Heading>
        <Text color="secondary">Mọi Task của các Dự án đang hoạt động: {tong} Task.</Text>
      </VStack>
      <VStack gap={3}>
        {CAC_TRANG_THAI_TASK.map((t) => (
          <ProgressBar
            key={t}
            label={TEN_TRANG_THAI_TASK[t]}
            value={phanBo[t]}
            max={tong}
            hasValueLabel
            formatValueLabel={(so, max) => `${so} Task (${max > 0 ? Math.round((so * 100) / max) : 0}%)`}
            variant={BIEN_THE_THANH_TRANG_THAI_TASK[t]}
          />
        ))}
      </VStack>
    </VStack>
  )
}

/**
 * Trang Tổng quan: chỗ nắm tổng thể, chỉ tính trong các Dự án người dùng được xem (Dự án Lưu trữ không
 * tính). Các vùng xếp dọc một cột, mỗi vùng chiếm hết chiều ngang: hàng ô số (bấm Chờ tôi duyệt, Việc
 * của tôi để tới trang đó); Task Trễ hạn; Task tới hạn trong 7 ngày; bảng Dự án đang hoạt động; phân bố
 * Task theo trạng thái. Mỗi vùng Task hiện tối đa 5 dòng đầu, nhiều hơn thì có nút "Xem tất cả (N)"; trạng
 * thái mở hết nằm trong vùng nên về 5 dòng khi rời Tổng quan rồi quay lại. Có trạng thái trống, đang tải
 * (lần đầu trong phiên và khi Thử lại; các lần sau hiện số liệu lần trước trong lúc đọc lại ngầm) và lỗi.
 * Mọi số liệu do `luat/tongQuan.ts` tính; màn này chỉ hiển thị. Bấm một Task
 * thì mở Task trong Ngăn trượt, Tổng quan ở nguyên phía sau và đọc lại khi Task đổi trong ngăn.
 */
export function ManTongQuan({ phien, vai, dongHo, onMoTrang, onHetPhien }: Props) {
  const kho = useKho()
  const boGiu = useBoGiuDuLieu()
  // Đã xem Tổng quan trong phiên này thì hiện ngay số liệu lần trước, rồi đọc lại ngầm và thay.
  const [tai, setTai] = useState<KetQua<TongQuan> | null>(() => {
    const daGiu = boGiu.lay<TongQuan>(KHOA_GIU)
    return daGiu ? thanhCong(daGiu) : null
  })
  useGiuKetQua(KHOA_GIU, tai)
  const [lanTai, setLanTai] = useState(0)
  const [man, setMan] = useState<ManCon>({ loai: 'tongQuan' })
  const [taskDangMo, setTaskDangMo] = useState<TaskCuaTongQuan | null>(null)
  const [dangTaoDuAn, setDangTaoDuAn] = useState(false)
  const [daTaoDuAn, setDaTaoDuAn] = useState<string | null>(null)
  // Vừa tạo Dự án: đọc lại khi ngăn đã đóng hẳn, để focus kịp về nút "Tạo Dự án" trước khi trạng thái
  // trống (chứa nút đó) nhường chỗ cho số liệu.
  const canDocLaiRef = useRef(false)

  useEffect(() => {
    if (man.loai !== 'tongQuan') return
    let huy = false
    docTongQuan(kho, phien, dongHo()).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      // Đọc lại ngầm (đang hiện số liệu) mà lỗi thì giữ số liệu đang hiện.
      else setTai((cu) => (!kq.ok && cu?.ok ? cu : kq))
    })
    return () => {
      huy = true
    }
  }, [kho, phien, dongHo, lanTai, man.loai, onHetPhien])

  function taiLai() {
    setTai(null)
    setLanTai((n) => n + 1)
  }

  /** Task vừa đổi trong Ngăn trượt: đọc lại Tổng quan mà không qua trạng thái đang tải. */
  async function docLaiNgam() {
    const kq = await docTongQuan(kho, phien, dongHo())
    if (kq.ok) setTai(kq)
    else if (kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
  }

  /**
   * Quay về Tổng quan thì hiện ngay số liệu lần trước và đọc lại ngầm: Task có thể đã đổi trạng thái,
   * hạn, hay Dự án đã đổi.
   */
  function veTongQuan() {
    setDaTaoDuAn(null)
    setMan({ loai: 'tongQuan' })
  }

  if (man.loai === 'duAn') {
    return (
      <ManChiTietDuAnTaiLuoi
        key={man.duAnId}
        phien={phien}
        vai={vai}
        duAnId={man.duAnId}
        dongHo={dongHo}
        onQuayLai={veTongQuan}
        onHetPhien={onHetPhien}
      />
    )
  }

  let noiDung: ReactNode
  if (tai === null) {
    noiDung = <Spinner label="Đang tải tổng quan…" />
  } else if (!tai.ok) {
    noiDung = (
      <Banner
        status="error"
        title="Không tải được tổng quan."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={taiLai} />}
      />
    )
  } else if (tai.giaTri.hoatDong.length === 0) {
    const taoDuoc = duocTaoDuAn(vai)
    noiDung = taoDuoc ? (
      <EmptyState
        headingLevel={3}
        title="Chưa có Dự án đang hoạt động nào."
        description="Tạo một Dự án và thêm người vào; Tiến độ, Task Trễ hạn và Task sắp tới hạn sẽ hiện ở đây."
        actions={
          <Button
            label="Tạo Dự án"
            variant="primary"
            onClick={() => {
              setDaTaoDuAn(null)
              setDangTaoDuAn(true)
            }}
          />
        }
      />
    ) : (
      <EmptyState
        headingLevel={3}
        title="Bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn."
        description="Khi được thêm vào một Dự án đang hoạt động, Tiến độ và các Task của Dự án đó sẽ hiện ở đây."
      />
    )
  } else {
    const tq = tai.giaTri
    const moTask = (task: TaskCuaTongQuan) => setTaskDangMo(task)
    noiDung = (
      <VStack gap={8}>
        <HangOSo oSo={tq.oSo} onMoTrang={onMoTrang} />
        <DanhSachTask
          tieuDe="Task Trễ hạn"
          moTa="Hạn đã qua mà chưa Hoàn thành, chưa Huỷ; trễ lâu nhất đứng đầu."
          trong="Không có Task Trễ hạn."
          task={tq.taskTreHan}
          onMo={moTask}
        />
        <DanhSachTask
          tieuDe={`Task tới hạn trong ${SO_NGAY_TOI_HAN} ngày`}
          moTa={`Chưa Hoàn thành, chưa Huỷ, hạn từ hôm nay đến hết ${SO_NGAY_TOI_HAN} ngày tới; hạn gần nhất đứng đầu.`}
          trong={`Không có Task tới hạn trong ${SO_NGAY_TOI_HAN} ngày.`}
          task={tq.taskToiHan}
          onMo={moTask}
        />
        <BangDuAnHoatDong dong={tq.hoatDong} onMo={(duAnId) => setMan({ loai: 'duAn', duAnId })} />
        <PhanBoTheoTrangThai phanBo={tq.phanBo} />
      </VStack>
    )
  }

  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <Heading level={2}>Tổng quan</Heading>
        <Text>
          {vai === 'PM'
            ? 'Mọi Dự án đang hoạt động: việc đang mở, Task Trễ hạn, Task sắp tới hạn và Tiến độ.'
            : 'Các Dự án đang hoạt động bạn ở trong: việc đang mở, Task Trễ hạn, Task sắp tới hạn và Tiến độ.'}
        </Text>
      </VStack>
      {daTaoDuAn !== null && <Banner status="success" title={daTaoDuAn} role="status" />}
      {noiDung}
      <NganTruotTask
        phien={phien}
        vai={vai}
        dongHo={dongHo}
        task={taskDangMo}
        onDong={() => setTaskDangMo(null)}
        onDaDoi={docLaiNgam}
        onHetPhien={onHetPhien}
      />
      {duocTaoDuAn(vai) && (
        <NganTruotTaoDuAn
          isOpen={dangTaoDuAn}
          phien={phien}
          dongHo={dongHo}
          onDong={() => setDangTaoDuAn(false)}
          onDaTao={(duAn) => {
            canDocLaiRef.current = true
            setDangTaoDuAn(false)
            setDaTaoDuAn(`Đã tạo Dự án ${duAn.ten}.`)
          }}
          onDaDongXong={() => {
            if (!canDocLaiRef.current) return
            canDocLaiRef.current = false
            void docLaiNgam()
          }}
          onHetPhien={onHetPhien}
        />
      )}
    </VStack>
  )
}
