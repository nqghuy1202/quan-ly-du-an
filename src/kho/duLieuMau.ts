// Dữ liệu mẫu cho bản bộ nhớ khi chạy thử (`npm run dev`): 3 Dự án (mỗi Dự án một Mã riêng, hai Dự
// án có Khách hàng, ba Mức ưu tiên khác nhau, hai Dự án có Người phụ trách), 5 người, Task ở đủ trạng thái
// và đủ ba Mức ưu tiên (một Task có dòng lịch sử đổi Mức ưu tiên). Người mẫu tự nhập Thông tin nhân sự
// (một người để trống để thấy trạng thái chưa có). Hai Dự án có Vai trò trong Dự án cho vài người.
// Dựng bằng chính các lệnh của Kho dữ liệu (như người dùng thật), nên mọi luật vẫn được áp. Chỉ dành
// cho chạy thử: bản Supabase không có dữ liệu mẫu.
import { homNayGioVietNam } from '../luat/tienDo'
import type { MucUuTien } from '../luat/mucUuTien'
import type { TrangThaiTask } from '../luat/task'
import type { Phien } from './khoDuLieu'
import { PM_CHAY_THU, type KhoBoNho } from './khoBoNho'
import type { KetQua } from './ketQua'

/** Mật khẩu chung của các tài khoản mẫu (trừ PM chạy thử, có mật khẩu riêng). */
export const MAT_KHAU_MAU = 'matkhau-mau'

interface NguoiMau {
  khoa: 'lan' | 'an' | 'binh' | 'chi' | 'dung'
  email: string
  tenHienThi: string
  vai: 'SUPPORT' | 'THANH_VIEN'
  /** Thông tin nhân sự người đó tự nhập ở trang Hồ sơ; không có là để trống. */
  nhanSu?: { soDienThoai: string; chucDanh: string; phongBan: string }
}

export const NGUOI_MAU: readonly NguoiMau[] = [
  {
    khoa: 'lan',
    email: 'lan@vi-du.vn',
    tenHienThi: 'Lan (Support)',
    vai: 'SUPPORT',
    nhanSu: { soDienThoai: '0901 234 567', chucDanh: 'Trưởng nhóm hỗ trợ', phongBan: 'Phòng Dự án' },
  },
  {
    khoa: 'an',
    email: 'an@vi-du.vn',
    tenHienThi: 'An',
    vai: 'THANH_VIEN',
    nhanSu: { soDienThoai: '0912.345.678', chucDanh: 'Lập trình viên', phongBan: 'Phòng Phần mềm' },
  },
  {
    khoa: 'binh',
    email: 'binh@vi-du.vn',
    tenHienThi: 'Bình',
    vai: 'THANH_VIEN',
    nhanSu: { soDienThoai: '+84 987 654 321', chucDanh: 'Kiểm thử viên', phongBan: 'Phòng Phần mềm' },
  },
  {
    khoa: 'chi',
    email: 'chi@vi-du.vn',
    tenHienThi: 'Chi',
    vai: 'THANH_VIEN',
    nhanSu: { soDienThoai: '0933-111-222', chucDanh: 'Thiết kế giao diện', phongBan: 'Phòng Thiết kế' },
  },
  { khoa: 'dung', email: 'dung@vi-du.vn', tenHienThi: 'Dũng', vai: 'THANH_VIEN' },
]

type Khoa = NguoiMau['khoa']

interface TaskMau {
  tieuDe: string
  moTa?: string
  /** Số ngày so với hôm nay (âm là đã qua, 0 là hôm nay); bỏ trống là không có hạn. */
  han?: number
  thucHien: Khoa
  kiemTra: Khoa
  /** Trạng thái muốn có; Task đi tới đó bằng đúng các bước của vòng duyệt. */
  trangThai: TrangThaiTask
  /** Trả lại một lần rồi làm lại, để bộ đếm Trả lại khác 0. */
  traLaiMotLan?: boolean
  /** Mức ưu tiên lúc tạo; không có là để Kho đặt mặc định (Trung bình). */
  mucUuTien?: MucUuTien
  /** PM đổi sang mức này sau khi tạo, để lịch sử Task có dòng đổi Mức ưu tiên. */
  doiMucSang?: MucUuTien
}

interface DuAnMau {
  /** Mã Dự án, duy nhất trong dữ liệu mẫu. */
  ma: string
  ten: string
  moTa: string
  khachHang: string
  /** Ngày bắt đầu, số ngày tính từ hôm nay (âm là đã qua); không có là không ghi. */
  batDau?: number
  /** Ngày kết thúc dự kiến, số ngày tính từ hôm nay; không có là không ghi. */
  ketThuc?: number
  /** Không có là để Kho đặt mặc định (Trung bình). */
  mucUuTien?: MucUuTien
  /** Người phụ trách, phải nằm trong `nguoi`; không có là chưa có Người phụ trách. */
  phuTrach?: Khoa
  nguoi: Khoa[]
  /** Vai trò trong Dự án của vài người (nhập lúc thêm vào Dự án); người không có ở đây là để trống. */
  vaiTro?: Partial<Record<Khoa, string>>
  repo?: string
  tasks: TaskMau[]
}

const DU_AN_MAU: readonly DuAnMau[] = [
  {
    ma: 'SDV-001',
    ten: 'Website bán hàng An Phát',
    khachHang: 'Công ty TNHH An Phát',
    // Đã qua Ngày kết thúc dự kiến mà Tiến độ chưa đủ 100%: Quá hạn dự kiến.
    batDau: -60,
    ketThuc: -1,
    mucUuTien: 'CAO',
    phuTrach: 'lan',
    moTa: 'Làm lại website bán hàng: trang chủ, giỏ hàng, thanh toán và trang quản trị đơn.',
    nguoi: ['lan', 'an', 'binh', 'chi'],
    vaiTro: { lan: 'Điều phối dự án', an: 'Trưởng nhóm phát triển', binh: 'Lập trình viên', chi: 'Kiểm thử' },
    repo: 'an-phat/website',
    tasks: [
      { tieuDe: 'Thiết kế lại trang chủ', han: 3, thucHien: 'an', kiemTra: 'lan', trangThai: 'DANG_LAM', mucUuTien: 'CAO' },
      { tieuDe: 'Giỏ hàng và tính phí vận chuyển', han: -2, thucHien: 'binh', kiemTra: 'lan', trangThai: 'DANG_LAM', doiMucSang: 'CAO' },
      { tieuDe: 'Tích hợp cổng thanh toán', han: 7, thucHien: 'chi', kiemTra: 'binh', trangThai: 'CHO_DUYET' },
      { tieuDe: 'Trang quản trị đơn hàng', han: 10, thucHien: 'an', kiemTra: 'chi', trangThai: 'MOI', mucUuTien: 'THAP' },
      { tieuDe: 'Tối ưu tốc độ tải ảnh sản phẩm', han: -1, thucHien: 'binh', kiemTra: 'an', trangThai: 'CHO_DUYET', mucUuTien: 'CAO' },
      { tieuDe: 'Email xác nhận đơn hàng', han: 5, thucHien: 'chi', kiemTra: 'lan', trangThai: 'TRA_LAI', traLaiMotLan: true },
      { tieuDe: 'Lỗi hiển thị giá trên điện thoại', han: 1, thucHien: 'an', kiemTra: 'binh', trangThai: 'BI_LOI' },
      { tieuDe: 'Cài đặt tên miền và chứng chỉ bảo mật', han: -6, thucHien: 'lan', kiemTra: 'chi', trangThai: 'HOAN_THANH' },
      { tieuDe: 'Bản dùng thử cho khách hàng', thucHien: 'binh', kiemTra: 'lan', trangThai: 'HUY' },
    ],
  },
  {
    ma: 'SDV-002',
    ten: 'Ứng dụng đặt lịch khám',
    khachHang: 'Phòng khám Đa khoa Bình An',
    batDau: -30,
    ketThuc: 45,
    phuTrach: 'dung',
    moTa: 'Ứng dụng cho phòng khám: đặt lịch, nhắc lịch qua tin nhắn, quản lý bác sĩ.',
    nguoi: ['lan', 'an', 'chi', 'dung'],
    vaiTro: { dung: 'Trưởng nhóm', chi: 'Lập trình viên' },
    repo: 'phong-kham-minh-tam/dat-lich',
    tasks: [
      { tieuDe: 'Màn hình đặt lịch theo bác sĩ', han: 4, thucHien: 'dung', kiemTra: 'lan', trangThai: 'DANG_LAM' },
      { tieuDe: 'Nhắc lịch bằng tin nhắn', han: 8, thucHien: 'chi', kiemTra: 'dung', trangThai: 'MOI', mucUuTien: 'CAO' },
      { tieuDe: 'Quản lý ca làm việc của bác sĩ', han: 12, thucHien: 'an', kiemTra: 'lan', trangThai: 'MOI' },
      { tieuDe: 'Trang lịch sử khám của bệnh nhân', han: 2, thucHien: 'dung', kiemTra: 'an', trangThai: 'CHO_DUYET' },
      { tieuDe: 'Đăng nhập bằng số điện thoại', han: 0, thucHien: 'chi', kiemTra: 'lan', trangThai: 'TRA_LAI', traLaiMotLan: true },
      { tieuDe: 'Khảo sát nhu cầu với 5 phòng khám', han: -10, thucHien: 'an', kiemTra: 'lan', trangThai: 'HOAN_THANH' },
    ],
  },
  {
    ma: 'SDV-003',
    ten: 'Chiến dịch Tết 2027',
    khachHang: '',
    mucUuTien: 'THAP',
    moTa: 'Chuẩn bị chiến dịch bán hàng dịp Tết: banner, khuyến mại, bài viết mạng xã hội.',
    nguoi: ['lan', 'binh', 'dung'],
    tasks: [
      { tieuDe: 'Thiết kế banner Tết', han: 6, thucHien: 'dung', kiemTra: 'lan', trangThai: 'HOAN_THANH' },
      { tieuDe: 'Kế hoạch khuyến mại theo tuần', han: 14, thucHien: 'binh', kiemTra: 'lan', trangThai: 'DANG_LAM' },
      { tieuDe: 'Lịch đăng bài mạng xã hội', han: 20, thucHien: 'dung', kiemTra: 'binh', trangThai: 'MOI' },
      { tieuDe: 'Chốt ngân sách quảng cáo', han: -3, thucHien: 'binh', kiemTra: 'lan', trangThai: 'HOAN_THANH' },
    ],
  },
]

/** Lấy giá trị của kết quả thành công; thất bại thì ném lỗi kèm thông báo của Kho. */
function lay<T>(kq: KetQua<T>, viec: string): T {
  if (!kq.ok) throw new Error(`Dữ liệu mẫu: ${viec}: ${kq.loi.ma} ${kq.loi.thongBao}`)
  return kq.giaTri
}

function ngayCach(bayGio: Date, soNgay: number): string {
  return homNayGioVietNam(new Date(bayGio.getTime() + soNgay * 24 * 60 * 60 * 1000))
}

type Nguoi = 'thucHien' | 'kiemTra' | 'pm'

/** Đường đi trong vòng duyệt từ Mới tới từng trạng thái: (người làm, trạng thái đích, có lý do không). */
function duongDen(trangThai: TrangThaiTask, traLaiMotLan: boolean): Array<[Nguoi, string, string?]> {
  const buocLamTiepDenChoDuyet: Array<[Nguoi, string, string?]> = [
    ['thucHien', 'DANG_LAM'],
    ['thucHien', 'CHO_DUYET'],
  ]
  const traLai: Array<[Nguoi, string, string?]> = traLaiMotLan
    ? [['kiemTra', 'TRA_LAI', 'Chưa đạt: cần sửa theo góp ý rồi báo lại.']]
    : []
  switch (trangThai) {
    case 'MOI':
      return []
    case 'DANG_LAM':
      return traLaiMotLan
        ? [...buocLamTiepDenChoDuyet, ...traLai, ['thucHien', 'DANG_LAM']]
        : [['thucHien', 'DANG_LAM']]
    case 'CHO_DUYET':
      return buocLamTiepDenChoDuyet
    case 'TRA_LAI':
      return [...buocLamTiepDenChoDuyet, ['kiemTra', 'TRA_LAI', 'Chưa đạt: cần sửa theo góp ý rồi báo lại.']]
    case 'BI_LOI':
      return [...buocLamTiepDenChoDuyet, ['kiemTra', 'BI_LOI', 'Lỗi ở môi trường thật, cần Support xem lại.']]
    case 'HOAN_THANH':
      return [...buocLamTiepDenChoDuyet, ['kiemTra', 'HOAN_THANH']]
    case 'HUY':
      return [['thucHien', 'DANG_LAM'], ['pm', 'HUY', 'Khách hàng không còn cần việc này.']]
  }
}

/**
 * Nạp dữ liệu mẫu vào Kho bộ nhớ vừa dựng (còn trống, chỉ có PM chạy thử). Ném lỗi nếu Kho từ chối
 * một bước nào; chỗ gọi nên bắt lỗi để không làm hỏng việc chạy thử.
 */
export async function napDuLieuMau(kho: KhoBoNho, bayGio: Date = new Date()): Promise<void> {
  const pm = lay(await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau }), 'đăng nhập PM')

  const phien = new Map<Khoa, Phien>()
  const idNguoi = new Map<Khoa, string>()
  for (const nguoi of NGUOI_MAU) {
    const hoSo = lay(
      await kho.dangKy({ email: nguoi.email, matKhau: MAT_KHAU_MAU, tenHienThi: nguoi.tenHienThi }),
      `đăng ký ${nguoi.email}`,
    )
    lay(await kho.moPhong.xacNhanEmail(nguoi.email), `xác nhận ${nguoi.email}`)
    if (nguoi.vai === 'SUPPORT') lay(await kho.doiVai(pm, hoSo.id, { vai: 'SUPPORT' }), `đặt vai ${nguoi.email}`)
    idNguoi.set(nguoi.khoa, hoSo.id)
    const phienNguoi = lay(await kho.dangNhap({ email: nguoi.email, matKhau: MAT_KHAU_MAU }), `đăng nhập ${nguoi.email}`)
    phien.set(nguoi.khoa, phienNguoi)
    // Mỗi người tự nhập Thông tin nhân sự của mình (PM không sửa hộ).
    if (nguoi.nhanSu) lay(await kho.suaHoSo(phienNguoi, hoSo.id, nguoi.nhanSu), `Thông tin nhân sự của ${nguoi.email}`)
  }
  const emailCua = (khoa: Khoa): string => NGUOI_MAU.find((n) => n.khoa === khoa)!.email

  for (const duAnMau of DU_AN_MAU) {
    const duAn = lay(await kho.taoDuAn(
        pm,
        {
          ma: duAnMau.ma,
          ten: duAnMau.ten,
          moTa: duAnMau.moTa,
          khachHang: duAnMau.khachHang,
          ngayBatDau: duAnMau.batDau !== undefined ? ngayCach(bayGio, duAnMau.batDau) : null,
          ngayKetThucDuKien: duAnMau.ketThuc !== undefined ? ngayCach(bayGio, duAnMau.ketThuc) : null,
          ...(duAnMau.mucUuTien ? { mucUuTien: duAnMau.mucUuTien } : {}),
        },
        bayGio,
      ), `tạo ${duAnMau.ten}`)
    for (const khoa of duAnMau.nguoi) {
      lay(
        await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailCua(khoa), vaiTroTrongDuAn: duAnMau.vaiTro?.[khoa] ?? null }),
        `thêm ${khoa} vào ${duAnMau.ten}`,
      )
    }
    // Người phụ trách chỉ chọn được sau khi người đó đã ở trong Dự án.
    if (duAnMau.phuTrach) {
      lay(
        await kho.suaDuAn(pm, duAn.id, { nguoiPhuTrachId: idNguoi.get(duAnMau.phuTrach)! }, bayGio),
        `đặt Người phụ trách của ${duAnMau.ten}`,
      )
    }
    if (duAnMau.repo) lay(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: duAnMau.repo }), `gắn repo ${duAnMau.repo}`)

    for (const taskMau of duAnMau.tasks) {
      const task = lay(
        await kho.taoTask(
          pm,
          duAn.id,
          {
            tieuDe: taskMau.tieuDe,
            ...(taskMau.moTa ? { moTa: taskMau.moTa } : {}),
            ...(taskMau.han !== undefined ? { han: ngayCach(bayGio, taskMau.han) } : {}),
            ...(taskMau.mucUuTien ? { mucUuTien: taskMau.mucUuTien } : {}),
            nguoiThucHienId: idNguoi.get(taskMau.thucHien)!,
            nguoiKiemTraId: idNguoi.get(taskMau.kiemTra)!,
          },
          bayGio,
        ),
        `tạo Task ${taskMau.tieuDe}`,
      )
      if (taskMau.doiMucSang) {
        lay(
          await kho.suaTask(pm, task.id, { mucUuTien: taskMau.doiMucSang }, bayGio),
          `${taskMau.tieuDe}: đổi Mức ưu tiên`,
        )
      }
      for (const [ai, sang, lyDo] of duongDen(taskMau.trangThai, taskMau.traLaiMotLan === true)) {
        const nguoiLam = ai === 'pm' ? pm : phien.get(ai === 'thucHien' ? taskMau.thucHien : taskMau.kiemTra)!
        lay(
          await kho.doiTrangThaiTask(nguoiLam, task.id, { sang, ...(lyDo ? { lyDo } : {}) }, bayGio),
          `${taskMau.tieuDe}: sang ${sang}`,
        )
      }
    }
  }
}
