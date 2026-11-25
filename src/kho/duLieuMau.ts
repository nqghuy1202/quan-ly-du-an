// Dữ liệu mẫu cho bản bộ nhớ khi chạy thử (`npm run dev`): 3 Dự án, 5 người, Task ở đủ trạng thái.
// Dựng bằng chính các lệnh của Kho dữ liệu (như người dùng thật), nên mọi luật vẫn được áp. Chỉ dành
// cho chạy thử: bản Supabase không có dữ liệu mẫu.
import { homNayGioVietNam } from '../luat/tienDo'
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
}

export const NGUOI_MAU: readonly NguoiMau[] = [
  { khoa: 'lan', email: 'lan@vi-du.vn', tenHienThi: 'Lan (Support)', vai: 'SUPPORT' },
  { khoa: 'an', email: 'an@vi-du.vn', tenHienThi: 'An', vai: 'THANH_VIEN' },
  { khoa: 'binh', email: 'binh@vi-du.vn', tenHienThi: 'Bình', vai: 'THANH_VIEN' },
  { khoa: 'chi', email: 'chi@vi-du.vn', tenHienThi: 'Chi', vai: 'THANH_VIEN' },
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
}

interface DuAnMau {
  ten: string
  moTa: string
  nguoi: Khoa[]
  repo?: string
  tasks: TaskMau[]
}

const DU_AN_MAU: readonly DuAnMau[] = [
  {
    ten: 'Website bán hàng An Phát',
    moTa: 'Làm lại website bán hàng: trang chủ, giỏ hàng, thanh toán và trang quản trị đơn.',
    nguoi: ['lan', 'an', 'binh', 'chi'],
    repo: 'an-phat/website',
    tasks: [
      { tieuDe: 'Thiết kế lại trang chủ', han: 3, thucHien: 'an', kiemTra: 'lan', trangThai: 'DANG_LAM' },
      { tieuDe: 'Giỏ hàng và tính phí vận chuyển', han: -2, thucHien: 'binh', kiemTra: 'lan', trangThai: 'DANG_LAM' },
      { tieuDe: 'Tích hợp cổng thanh toán', han: 7, thucHien: 'chi', kiemTra: 'binh', trangThai: 'CHO_DUYET' },
      { tieuDe: 'Trang quản trị đơn hàng', han: 10, thucHien: 'an', kiemTra: 'chi', trangThai: 'MOI' },
      { tieuDe: 'Tối ưu tốc độ tải ảnh sản phẩm', han: -1, thucHien: 'binh', kiemTra: 'an', trangThai: 'CHO_DUYET' },
      { tieuDe: 'Email xác nhận đơn hàng', han: 5, thucHien: 'chi', kiemTra: 'lan', trangThai: 'TRA_LAI', traLaiMotLan: true },
      { tieuDe: 'Lỗi hiển thị giá trên điện thoại', han: 1, thucHien: 'an', kiemTra: 'binh', trangThai: 'BI_LOI' },
      { tieuDe: 'Cài đặt tên miền và chứng chỉ bảo mật', han: -6, thucHien: 'lan', kiemTra: 'chi', trangThai: 'HOAN_THANH' },
      { tieuDe: 'Bản dùng thử cho khách hàng', thucHien: 'binh', kiemTra: 'lan', trangThai: 'HUY' },
    ],
  },
  {
    ten: 'Ứng dụng đặt lịch khám',
    moTa: 'Ứng dụng cho phòng khám: đặt lịch, nhắc lịch qua tin nhắn, quản lý bác sĩ.',
    nguoi: ['lan', 'an', 'chi', 'dung'],
    repo: 'phong-kham-minh-tam/dat-lich',
    tasks: [
      { tieuDe: 'Màn hình đặt lịch theo bác sĩ', han: 4, thucHien: 'dung', kiemTra: 'lan', trangThai: 'DANG_LAM' },
      { tieuDe: 'Nhắc lịch bằng tin nhắn', han: 8, thucHien: 'chi', kiemTra: 'dung', trangThai: 'MOI' },
      { tieuDe: 'Quản lý ca làm việc của bác sĩ', han: 12, thucHien: 'an', kiemTra: 'lan', trangThai: 'MOI' },
      { tieuDe: 'Trang lịch sử khám của bệnh nhân', han: 2, thucHien: 'dung', kiemTra: 'an', trangThai: 'CHO_DUYET' },
      { tieuDe: 'Đăng nhập bằng số điện thoại', han: 0, thucHien: 'chi', kiemTra: 'lan', trangThai: 'TRA_LAI', traLaiMotLan: true },
      { tieuDe: 'Khảo sát nhu cầu với 5 phòng khám', han: -10, thucHien: 'an', kiemTra: 'lan', trangThai: 'HOAN_THANH' },
    ],
  },
  {
    ten: 'Chiến dịch Tết 2027',
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
    phien.set(nguoi.khoa, lay(await kho.dangNhap({ email: nguoi.email, matKhau: MAT_KHAU_MAU }), `đăng nhập ${nguoi.email}`))
  }
  const emailCua = (khoa: Khoa): string => NGUOI_MAU.find((n) => n.khoa === khoa)!.email

  for (const duAnMau of DU_AN_MAU) {
    const duAn = lay(await kho.taoDuAn(pm, { ten: duAnMau.ten, moTa: duAnMau.moTa }, bayGio), `tạo ${duAnMau.ten}`)
    for (const khoa of duAnMau.nguoi) {
      lay(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailCua(khoa) }), `thêm ${khoa} vào ${duAnMau.ten}`)
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
            nguoiThucHienId: idNguoi.get(taskMau.thucHien)!,
            nguoiKiemTraId: idNguoi.get(taskMau.kiemTra)!,
          },
          bayGio,
        ),
        `tạo Task ${taskMau.tieuDe}`,
      )
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
