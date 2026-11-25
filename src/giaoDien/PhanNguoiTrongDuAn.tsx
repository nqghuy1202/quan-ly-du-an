import { useRef, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua, LoiKho, MaLoi } from '../kho/ketQua'
import type { NguoiTrongDuAn, Phien, Task } from '../kho/khoDuLieu'
import { TEN_TRANG_THAI_TASK, THONG_BAO_SUA_TASK, vaiGiuTask, xepTask } from '../luat/task'
import { TEN_VAI, xepTheoTen, type VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'

interface Props {
  phien: Phien
  duAnId: string
  /** Danh sách đang có: null khi đang tải. */
  tai: KetQua<NguoiTrongDuAn[]> | null
  /** Lý do không thêm, gỡ được (cùng luật với Kho); null nếu được. */
  lyDoKhongGhi: string | null
  onThuLai: () => void
  /** Cập nhật danh sách sau một lần thêm hoặc gỡ thành công. */
  onDoiDanhSach: (capNhat: (cu: NguoiTrongDuAn[]) => NguoiTrongDuAn[]) => void
  /** Kho từ chối vì Dự án hay quyền đã đổi ở nơi khác: đọc lại để nút và lý do khớp với Kho. */
  onCanDocLai: () => void
  /** Mở một Task (để giao lại trước khi gỡ người giữ nó); không truyền thì danh sách Task chỉ để xem. */
  onMoTask?: (taskId: string) => void
  onHetPhien: () => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = {
  id: string
  tenHienThi: string
  email: string
  vai: VaiHeThong
}

/**
 * Việc gỡ đang chờ người dùng xác nhận: người sắp gỡ và các Task chưa chốt họ đang giữ; `tasks` là
 * null khi không kiểm được (lỗi), kèm lỗi để hiện.
 */
type ChoXacNhanGo = { nguoi: { id: string; tenHienThi: string }; tasks: Task[] | null; loi: LoiKho | null }

/** Một dòng của bảng Task đang giữ. */
type DongTaskDangGiu = { id: string; tieuDe: string; trangThai: string; vai: string }

type ThongBao = { loai: 'thanhCong'; noiDung: string } | { loai: 'loi'; tieuDe: string; loi: LoiKho }

/** Lỗi cho thấy Dự án hay quyền của người dùng đã đổi ở nơi khác. */
const LOI_CAN_DOC_LAI: readonly MaLoi[] = ['DU_AN_DA_LUU_TRU', 'KHONG_CO_QUYEN', 'KHONG_TIM_THAY']

/** Phần "Người trong dự án" của màn chi tiết Dự án: xem, thêm bằng email và gỡ người. */
export function PhanNguoiTrongDuAn({
  phien,
  duAnId,
  tai,
  lyDoKhongGhi,
  onThuLai,
  onDoiDanhSach,
  onCanDocLai,
  onMoTask,
  onHetPhien,
}: Props) {
  const kho = useKho()
  const [email, setEmail] = useState('')
  const [dangThem, setDangThem] = useState(false)
  const [dangGoId, setDangGoId] = useState<string | null>(null)
  // Chặn lệnh trùng (bấm hai lần trước khi kịp vẽ lại) bằng ref chứ không bằng state.
  const dangGuiRef = useRef(false)
  const [thongBao, setThongBao] = useState<ThongBao | null>(null)
  const [choXacNhan, setChoXacNhan] = useState<ChoXacNhanGo | null>(null)
  const duocGhi = lyDoKhongGhi === null

  function xuLyLoi(tieuDe: string, loi: LoiKho) {
    if (loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
      return
    }
    setThongBao({ loai: 'loi', tieuDe, loi })
    if (LOI_CAN_DOC_LAI.includes(loi.ma)) onCanDocLai()
  }

  async function them() {
    if (dangGuiRef.current || !duocGhi) return
    dangGuiRef.current = true
    setDangThem(true)
    setThongBao(null)
    const kq = await kho.themNguoiVaoDuAn(phien, duAnId, { email })
    dangGuiRef.current = false
    setDangThem(false)
    if (kq.ok) {
      const moi = kq.giaTri
      onDoiDanhSach((cu) => [...cu.filter((nguoi) => nguoi.id !== moi.id), moi])
      setEmail('')
      setThongBao({ loai: 'thanhCong', noiDung: `Đã thêm ${moi.tenHienThi} vào Dự án.` })
    } else {
      xuLyLoi('Chưa thêm được người vào Dự án.', kq.loi)
    }
  }

  /** Gỡ hẳn khỏi Dự án (sau khi đã cho người dùng xem Task người đó đang giữ). */
  async function thucHienGo(nguoi: { id: string; tenHienThi: string }) {
    dangGuiRef.current = true
    setDangGoId(nguoi.id)
    setThongBao(null)
    setChoXacNhan(null)
    const kq = await kho.goNguoiKhoiDuAn(phien, duAnId, nguoi.id)
    dangGuiRef.current = false
    setDangGoId(null)
    if (kq.ok) {
      onDoiDanhSach((cu) => cu.filter((n) => n.id !== nguoi.id))
      setThongBao({
        loai: 'thanhCong',
        noiDung: `Đã gỡ ${nguoi.tenHienThi} khỏi Dự án. Tài khoản và hồ sơ của họ vẫn giữ nguyên.`,
      })
    } else {
      xuLyLoi(`Không gỡ được ${nguoi.tenHienThi} khỏi Dự án.`, kq.loi)
    }
  }

  /**
   * Bấm "Gỡ": trước hết xem người đó đang giữ Task chưa chốt nào. Không giữ Task nào thì gỡ ngay;
   * có thì hiện danh sách để giao lại, người dùng vẫn gỡ được (Task giữ nguyên người cũ).
   */
  async function go(nguoi: { id: string; tenHienThi: string }) {
    if (dangGuiRef.current || !duocGhi) return
    dangGuiRef.current = true
    setDangGoId(nguoi.id)
    setThongBao(null)
    setChoXacNhan(null)
    const kq = await kho.danhSachTaskNguoiDangGiu(phien, duAnId, nguoi.id)
    if (kq.ok && kq.giaTri.length === 0) {
      await thucHienGo(nguoi)
      return
    }
    dangGuiRef.current = false
    setDangGoId(null)
    if (kq.ok) {
      setChoXacNhan({ nguoi, tasks: kq.giaTri, loi: null })
    } else if (LOI_CAN_DOC_LAI.includes(kq.loi.ma) || kq.loi.ma === 'CHUA_DANG_NHAP') {
      xuLyLoi(`Không gỡ được ${nguoi.tenHienThi} khỏi Dự án.`, kq.loi)
    } else {
      setChoXacNhan({ nguoi, tasks: null, loi: kq.loi })
    }
  }

  const cotTaskDangGiu: TableColumn<DongTaskDangGiu>[] = [
    {
      key: 'tieuDe',
      header: 'Task',
      width: proportional(2),
      renderCell: (task) =>
        onMoTask ? (
          <Button label={task.tieuDe} variant="ghost" onClick={() => onMoTask(task.id)} />
        ) : (
          <Text weight="semibold">{task.tieuDe}</Text>
        ),
    },
    { key: 'trangThai', header: 'Trạng thái', width: proportional(1), renderCell: (task) => <Text>{task.trangThai}</Text> },
    { key: 'vai', header: 'Đang giữ ở vai', width: proportional(1), renderCell: (task) => <Text>{task.vai}</Text> },
  ]

  const cot: TableColumn<Dong>[] = [
    {
      key: 'tenHienThi',
      header: 'Tên',
      width: proportional(1),
      renderCell: (nguoi) => <Text weight="semibold">{nguoi.tenHienThi}</Text>,
    },
    { key: 'email', header: 'Email', width: proportional(1), renderCell: (nguoi) => <Text>{nguoi.email}</Text> },
    {
      key: 'vai',
      header: 'Vai hệ thống',
      width: proportional(1),
      renderCell: (nguoi) => <Token label={TEN_VAI[nguoi.vai]} />,
    },
  ]
  if (duocGhi) {
    cot.push({
      key: 'thaoTac',
      header: 'Thao tác',
      width: proportional(1),
      renderCell: (nguoi) => (
        <Button
          label={`Gỡ ${nguoi.tenHienThi}`}
          variant="secondary"
          size="sm"
          isLoading={dangGoId === nguoi.id}
          onClick={() => go(nguoi)}
        />
      ),
    })
  }

  let danhSach: ReactNode
  if (tai === null) {
    danhSach = <Spinner label="Đang tải người trong dự án…" />
  } else if (!tai.ok) {
    danhSach = (
      <Banner
        status="error"
        title="Không tải được người trong dự án."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={onThuLai} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    danhSach = (
      <EmptyState
        headingLevel={4}
        title="Dự án chưa có ai."
        description={
          duocGhi
            ? 'Thêm người bằng email của một tài khoản đã đăng ký.'
            : 'Khi PM hoặc Support của Dự án thêm người, họ sẽ hiện ở đây.'
        }
      />
    )
  } else {
    const dong: Dong[] = xepTheoTen(tai.giaTri).map(({ id, tenHienThi, email: e, vai }) => ({
      id,
      tenHienThi,
      email: e,
      vai,
    }))
    danhSach = <Table aria-label="Danh sách người trong dự án" data={dong} columns={cot} idKey="id" />
  }

  const loiO = thongBao?.loai === 'loi' ? thongBao.loi : null

  return (
    <VStack gap={3} role="group" aria-label="Người trong dự án">
      <Heading level={3}>Người trong dự án</Heading>
      {thongBao?.loai === 'thanhCong' && <Banner status="success" title={thongBao.noiDung} role="status" />}
      {thongBao?.loai === 'loi' && (
        <Banner status="error" title={thongBao.tieuDe} description={thongBao.loi.thongBao} role="alert" />
      )}
      {choXacNhan && (
        <VStack gap={2} role="group" aria-label="Task đang giữ">
          {choXacNhan.tasks === null ? (
            <Banner
              status="warning"
              title={`Chưa kiểm được Task ${choXacNhan.nguoi.tenHienThi} đang giữ.`}
              description={choXacNhan.loi?.thongBao}
              role="alert"
            />
          ) : (
            <Banner
              status="warning"
              title={`${choXacNhan.nguoi.tenHienThi} đang giữ ${choXacNhan.tasks.length} Task chưa chốt.`}
              description={`Giao lại các Task này trước khi gỡ nếu cần. Vẫn gỡ được: Task giữ nguyên ${choXacNhan.nguoi.tenHienThi} và hiện "${THONG_BAO_SUA_TASK.daRoiDuAn}" cho đến khi được giao lại.`}
            />
          )}
          {choXacNhan.tasks !== null && (
            <Table
              aria-label={`Task chưa chốt của ${choXacNhan.nguoi.tenHienThi}`}
              data={xepTask(choXacNhan.tasks).map((task) => ({
                id: task.id,
                tieuDe: task.tieuDe,
                trangThai: TEN_TRANG_THAI_TASK[task.trangThai],
                vai:
                  vaiGiuTask(task, choXacNhan.nguoi.id) === 'NGUOI_THUC_HIEN' ? 'Người thực hiện' : 'Người kiểm tra',
              }))}
              columns={cotTaskDangGiu}
              idKey="id"
            />
          )}
          <HStack gap={2} wrap="wrap">
            <Button
              label={`Vẫn gỡ ${choXacNhan.nguoi.tenHienThi}`}
              variant="primary"
              onClick={() => thucHienGo(choXacNhan.nguoi)}
            />
            {choXacNhan.tasks === null && (
              <Button label="Thử lại" variant="secondary" onClick={() => go(choXacNhan.nguoi)} />
            )}
            <Button label="Không gỡ" variant="ghost" onClick={() => setChoXacNhan(null)} />
          </HStack>
        </VStack>
      )}
      <FormLayout>
        <TextInput
          label="Email người cần thêm"
          description="Người được thêm phải đã đăng ký tài khoản. Hệ thống không gửi thư mời."
          autoComplete="off"
          value={email}
          onChange={setEmail}
          onEnter={duocGhi ? them : undefined}
          isDisabled={!duocGhi}
          disabledMessage={lyDoKhongGhi ?? undefined}
          status={trangThaiO(loiO, 'email')}
        />
      </FormLayout>
      {duocGhi && (
        <HStack gap={2}>
          <Button label="Thêm vào Dự án" variant="primary" isLoading={dangThem} onClick={them} />
        </HStack>
      )}
      {danhSach}
    </VStack>
  )
}
