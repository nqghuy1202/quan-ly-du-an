// Bộ test hợp đồng của Kho dữ liệu. Mọi bản cài (bộ nhớ, Supabase, ...) gọi
// `chayBoTestHopDong` trong một file `*.test.ts` của mình để chạy lại cùng bộ.
// Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`, không kiểm cách cài bên trong.
// Thư (xác nhận email, mã đặt lại) đi ra ngoài Kho, nên mỗi bản cài đưa kèm cách đọc hộp thư
// và cách thay cho việc bấm đường dẫn xác nhận (`BanCaiHopDong`).
import { beforeEach, describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import type { KhoDuLieu, NguoiDungTomTat, Phien, ThongBaoChung } from './khoDuLieu'
import { CAC_VAI, THONG_BAO, type VaiHeThong } from '../luat/taiKhoan'
import { DO_DAI_TEN_DU_AN_TOI_DA, THONG_BAO_DU_AN } from '../luat/duAn'
import { DO_DAI_TIEU_DE_TASK_TOI_DA, THONG_BAO_TASK, type TaoTaskDauVao, type TrangThaiTask } from '../luat/task'
import { BANG_CA_QUYEN, laHanhDongTask, type CaQuyen, type KetQuaMongDoi } from './bangCaQuyen'

export interface BanCaiHopDong {
  kho: KhoDuLieu
  /**
   * Thay cho việc người dùng bấm đường dẫn trong thư xác nhận gửi tới `email`
   * (bản bộ nhớ: bước xác nhận mô phỏng).
   */
  xacNhanEmail(email: string): Promise<KetQua<ThongBaoChung>>
  /** Mã đặt lại mật khẩu trong thư mới nhất gửi tới `email`, hoặc null nếu chưa có thư nào. */
  maDatLaiMoiNhat(email: string): Promise<string | null>
  /** Thời hạn mã đặt lại mà bản cài được cấu hình, tính bằng mili giây. */
  thoiHanMaDatLaiMs: number
  /**
   * Đặt vai PM cho tài khoản có email `email`, ngoài luồng của ứng dụng (thay cho việc chủ dự án
   * tự đặt PM đầu tiên trên kho thật; bản bộ nhớ: `chuDuAn.datVaiPM`).
   */
  datVaiPM(email: string): Promise<void>
  /**
   * Đặt Task `taskId` sang trạng thái bất kỳ, ngoài luồng của ứng dụng (lát này chưa có cách đi tới
   * trạng thái cuối; bản bộ nhớ: `chuDuAn.datTrangThaiTask`). Bản cài chưa có thì bỏ trống: các ca
   * cần nó (hopDongSuaTask.ts) bị bỏ qua, mang tên "CHƯA KIỂM".
   */
  datTrangThaiTask?(taskId: string, trangThai: TrangThaiTask): Promise<void>
}

export interface TuyChonHopDong {
  /** Sinh email chưa dùng cho mỗi ca (bản cài dùng DB thật cần email khác nhau mỗi lần chạy). */
  emailMoi?: (ten: string) => string
  /**
   * Mỗi ca bắt đầu với kho chưa có PM nào (mặc định đúng). Kho thật đã có PM của chủ dự án thì
   * đặt `false`: các ca "PM cuối cùng" bị bỏ qua vì không dựng được tình huống đó.
   */
  khoChuaCoPM?: boolean
  /**
   * Kho tự lấy giờ của mình, bỏ qua `bayGio` truyền vào (bản Supabase: cơ sở dữ liệu và Auth dùng
   * giờ máy chủ). Khi đúng: ngày trong dấu vết chỉ được kiểm là một ngày, không so với giờ truyền
   * vào, và ca "mã hết hạn theo đồng hồ truyền vào" bị bỏ qua. Mặc định sai.
   */
  dongHoCuaKho?: boolean
  /**
   * Kho không phân biệt mã đặt lại sai, đã dùng hay hết hạn (Supabase Auth trả cùng một lỗi): khi
   * đúng, dùng lại mã đã dùng phải trả `MA_KHONG_HOP_LE` thay cho `MA_DA_DUNG`. Mặc định sai.
   */
  gopLoiMaDatLai?: boolean
  /**
   * Bản cài đã có các lệnh Task (ticket 07). Mặc định đúng. Đặt `false` khi bản cài chưa cài Task
   * (bản Supabase trước ticket 10): các ca Task và dòng Task của bảng ca bị bỏ qua, mang tên "CHƯA KIỂM".
   */
  coTask?: boolean
}

const MAT_KHAU = 'matkhau-dung-1'
const MAT_KHAU_MOI = 'matkhau-moi-2'
/** Đồng hồ của các ca đặt lại mật khẩu: truyền vào, không đọc giờ thật. */
const LUC_YEU_CAU = new Date('2026-03-01T08:00:00+07:00')
/** Đồng hồ của các ca Dự án: truyền vào, không đọc giờ thật. */
const LUC_TAO_DU_AN = new Date('2026-04-10T09:30:00+07:00')

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

function sau(moc: Date, ms: number): Date {
  return new Date(moc.getTime() + ms)
}

export function chayBoTestHopDong(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const khoChuaCoPM = tuyChon.khoChuaCoPM ?? true
  const dongHoCuaKho = tuyChon.dongHoCuaKho ?? false
  const gopLoiMaDatLai = tuyChon.gopLoiMaDatLai ?? false
  const coTask = tuyChon.coTask ?? true
  /** Ngày mong đợi trong dấu vết: đúng giờ truyền vào, hoặc chỉ là một ngày nếu kho tự lấy giờ. */
  const luc = (moc: Date): Date => (dongHoCuaKho ? expect.any(Date) : moc)

  describe(`Kho dữ liệu (hợp đồng) — ${tenBanCai}`, () => {
    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    beforeEach(async () => {
      banCai = await taoBanCai()
      kho = banCai.kho
    })

    /** Đăng ký và xác nhận email; trả email đã dùng. */
    async function dangKyDaXacNhan(ten: string, tenHienThi = ten, matKhau = MAT_KHAU): Promise<string> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau, tenHienThi }))
      giaTri(await banCai.xacNhanEmail(email))
      return email
    }

    async function dangKyVaDangNhap(ten: string, tenHienThi = ten): Promise<Phien> {
      const email = await dangKyDaXacNhan(ten, tenHienThi)
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    /** Đăng ký, xác nhận, đặt vai PM ngoài luồng ứng dụng rồi đăng nhập. */
    async function taoPM(ten: string, tenHienThi = ten): Promise<Phien> {
      const email = await dangKyDaXacNhan(ten, tenHienThi)
      await banCai.datVaiPM(email)
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    /** Tạo một người có vai `vai` (PM `phienPM` đổi vai giúp nếu cần). */
    async function taoNguoiCoVai(phienPM: Phien, ten: string, vai: VaiHeThong, tenHienThi = ten): Promise<Phien> {
      const phien = await dangKyVaDangNhap(ten, tenHienThi)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(phienPM, phien.nguoiDungId, { vai }))
      return phien
    }

    async function maDatLai(email: string): Promise<string> {
      const ma = await banCai.maDatLaiMoiNhat(email)
      if (ma === null) throw new Error(`Không có thư đặt lại nào gửi tới ${email}`)
      return ma
    }

    describe('đăng ký', () => {
      it('email hợp lệ, mật khẩu đủ 8 ký tự và tên không rỗng thì tạo hồ sơ vai Thành viên', async () => {
        const email = emailMoi('an')
        const hoSo = giaTri(await kho.dangKy({ email, matKhau: '12345678', tenHienThi: '  An Nguyễn  ' }))
        expect(hoSo.email).toBe(email.toLowerCase())
        expect(hoSo.tenHienThi).toBe('An Nguyễn')
        expect(hoSo.vai).toBe('THANH_VIEN')
        expect(hoSo.githubUsername).toBeNull()

        giaTri(await banCai.xacNhanEmail(email))
        const phien = giaTri(await kho.dangNhap({ email, matKhau: '12345678' }))
        expect(giaTri(await kho.layHoSoCuaToi(phien))).toEqual(hoSo)
      })

      it('email đã dùng (không phân biệt hoa thường) trả EMAIL_DA_DUNG', async () => {
        const email = await dangKyDaXacNhan('binh', 'Bình')
        const lan2 = await kho.dangKy({ email: email.toUpperCase(), matKhau: MAT_KHAU, tenHienThi: 'Bình 2' })
        expect(maLoi(lan2)).toBe('EMAIL_DA_DUNG')

        // Tài khoản đầu không bị ghi đè.
        const phien = giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
        expect(giaTri(await kho.layHoSoCuaToi(phien)).tenHienThi).toBe('Bình')
      })

      interface CaSai {
        ten: string
        email: string | null // null = dùng một email hợp lệ chưa đăng ký
        matKhau: string
        tenHienThi: string
        o: 'email' | 'matKhau' | 'tenHienThi'
        thongBao: string
      }
      const caSai: CaSai[] = [
        { ten: 'email sai định dạng', email: 'khong-phai-email', matKhau: MAT_KHAU, tenHienThi: 'Chi', o: 'email', thongBao: THONG_BAO.emailSai },
        { ten: 'email rỗng', email: '', matKhau: MAT_KHAU, tenHienThi: 'Chi', o: 'email', thongBao: THONG_BAO.emailSai },
        { ten: 'mật khẩu ngắn hơn 8 ký tự', email: null, matKhau: '1234567', tenHienThi: 'Chi', o: 'matKhau', thongBao: THONG_BAO.matKhauNgan },
        { ten: 'tên rỗng', email: null, matKhau: MAT_KHAU, tenHienThi: '', o: 'tenHienThi', thongBao: THONG_BAO.tenTrong },
        { ten: 'tên chỉ toàn khoảng trắng', email: null, matKhau: MAT_KHAU, tenHienThi: ' \t  ', o: 'tenHienThi', thongBao: THONG_BAO.tenTrong },
      ]

      it.each(caSai)('$ten bị từ chối kèm thông báo tiếng Việt và không tạo gì', async (ca) => {
        const email = ca.email ?? emailMoi('chi')
        const kq = await kho.dangKy({ email, matKhau: ca.matKhau, tenHienThi: ca.tenHienThi })
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (kq.ok) return
        expect(kq.loi.loiTheoO?.[ca.o]).toBe(ca.thongBao)

        // Không tạo gì: đăng nhập bằng chính dữ liệu đó thất bại, và email hợp lệ vẫn đăng ký được.
        expect(maLoi(await kho.dangNhap({ email, matKhau: ca.matKhau }))).toBe('SAI_THONG_TIN_DANG_NHAP')
        if (ca.email === null) {
          expect(maLoi(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Chi' }))).toBe('THANH_CONG')
        }
      })
    })

    describe('xác nhận email', () => {
      it('đăng ký xong chưa xác nhận: đúng mật khẩu vẫn bị từ chối với EMAIL_CHUA_XAC_NHAN', async () => {
        const email = emailMoi('xuan')
        giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Xuân' }))
        const kq = await kho.dangNhap({ email, matKhau: MAT_KHAU })
        expect(maLoi(kq)).toBe('EMAIL_CHUA_XAC_NHAN')
        if (!kq.ok) expect(kq.loi.thongBao).toMatch(/chưa được xác nhận/)
      })

      it('chưa xác nhận mà sai mật khẩu thì vẫn chỉ trả lỗi chung, không lộ trạng thái xác nhận', async () => {
        const email = emailMoi('yen')
        giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Yến' }))
        expect(maLoi(await kho.dangNhap({ email, matKhau: 'sai-mat-khau' }))).toBe('SAI_THONG_TIN_DANG_NHAP')
      })

      it('sau khi xác nhận thì đăng nhập được', async () => {
        const email = emailMoi('vy')
        giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Vy' }))
        giaTri(await banCai.xacNhanEmail(email))
        const phien = giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
        expect(giaTri(await kho.layHoSoCuaToi(phien)).tenHienThi).toBe('Vy')
      })

      it('xác nhận lần hai và xác nhận email không tồn tại trả đúng cùng kết quả như lần đầu và không đổi gì', async () => {
        const email = emailMoi('uyen')
        giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Uyên' }))
        const lanDau = await banCai.xacNhanEmail(email)
        const lanHai = await banCai.xacNhanEmail(email)
        const khongTonTai = await banCai.xacNhanEmail(emailMoi('khong-ton-tai'))
        expect(lanDau.ok).toBe(true)
        expect(lanHai).toEqual(lanDau)
        expect(khongTonTai).toEqual(lanDau)

        // Tài khoản vẫn dùng như cũ.
        const phien = giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
        expect(giaTri(await kho.layHoSoCuaToi(phien)).tenHienThi).toBe('Uyên')

        // Xác nhận email chưa đăng ký không tạo gì và không "xác nhận trước" cho người đăng ký sau.
        const emailSau = emailMoi('dang-ky-sau')
        giaTri(await banCai.xacNhanEmail(emailSau))
        expect(maLoi(await kho.dangNhap({ email: emailSau, matKhau: MAT_KHAU }))).toBe('SAI_THONG_TIN_DANG_NHAP')
        giaTri(await kho.dangKy({ email: emailSau, matKhau: MAT_KHAU, tenHienThi: 'Sau' }))
        expect(maLoi(await kho.dangNhap({ email: emailSau, matKhau: MAT_KHAU }))).toBe('EMAIL_CHUA_XAC_NHAN')
      })

      it('gửi lại thư xác nhận trả cùng một thông báo dù email chưa xác nhận, đã xác nhận hay không tồn tại', async () => {
        const chuaXacNhan = emailMoi('tam')
        giaTri(await kho.dangKy({ email: chuaXacNhan, matKhau: MAT_KHAU, tenHienThi: 'Tâm' }))
        const daXacNhan = await dangKyDaXacNhan('thu')

        const kqChua = await kho.guiLaiThuXacNhan({ email: chuaXacNhan })
        const kqDa = await kho.guiLaiThuXacNhan({ email: daXacNhan })
        const kqKhong = await kho.guiLaiThuXacNhan({ email: emailMoi('khong-co') })
        expect(giaTri(kqChua).thongBao).toBe(THONG_BAO.daGuiLaiThuXacNhan)
        expect(kqDa).toEqual(kqChua)
        expect(kqKhong).toEqual(kqChua)

        // Gửi lại không tự xác nhận hộ.
        expect(maLoi(await kho.dangNhap({ email: chuaXacNhan, matKhau: MAT_KHAU }))).toBe('EMAIL_CHUA_XAC_NHAN')
      })

      it('gửi lại thư với email sai định dạng bị từ chối kèm thông báo tiếng Việt', async () => {
        const kq = await kho.guiLaiThuXacNhan({ email: 'khong-phai-email' })
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.email).toBe(THONG_BAO.emailSai)
      })
    })

    describe('quên mật khẩu', () => {
      it('yêu cầu đặt lại trả cùng một thông báo dù email có tài khoản hay không', async () => {
        const email = await dangKyDaXacNhan('quynh')
        const coTaiKhoan = await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU)
        const khongCo = await kho.yeuCauDatLaiMatKhau({ email: emailMoi('khong-co-ai') }, LUC_YEU_CAU)
        expect(giaTri(coTaiKhoan).thongBao).toBe(THONG_BAO.daGuiMaDatLai)
        expect(khongCo).toEqual(coTaiKhoan)
        expect(await banCai.maDatLaiMoiNhat(emailMoi('khong-co-ai'))).toBeNull()
      })

      it('yêu cầu đặt lại không đổi mật khẩu hiện tại', async () => {
        const email = await dangKyDaXacNhan('rang')
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU))
        expect(maLoi(await kho.dangNhap({ email, matKhau: MAT_KHAU }))).toBe('THANH_CONG')
      })

      it('mã hợp lệ cùng mật khẩu mới: mật khẩu mới đăng nhập được, mật khẩu cũ thì không', async () => {
        const email = await dangKyDaXacNhan('phat', 'Phát')
        giaTri(await kho.yeuCauDatLaiMatKhau({ email: email.toUpperCase() }, LUC_YEU_CAU))
        const ma = await maDatLai(email)

        const kq = await kho.datLaiMatKhau({ email, ma, matKhauMoi: MAT_KHAU_MOI }, sau(LUC_YEU_CAU, 60_000))
        expect(giaTri(kq).thongBao).toBe(THONG_BAO.daDatLaiMatKhau)

        const phien = giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU_MOI }))
        expect(giaTri(await kho.layHoSoCuaToi(phien)).tenHienThi).toBe('Phát')
        expect(maLoi(await kho.dangNhap({ email, matKhau: MAT_KHAU }))).toBe('SAI_THONG_TIN_DANG_NHAP')
      })

      it('mã chỉ dùng được một lần: lần hai trả MA_DA_DUNG và mật khẩu không đổi nữa', async () => {
        const email = await dangKyDaXacNhan('oanh')
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU))
        const ma = await maDatLai(email)
        giaTri(await kho.datLaiMatKhau({ email, ma, matKhauMoi: MAT_KHAU_MOI }, LUC_YEU_CAU))

        const lanHai = await kho.datLaiMatKhau({ email, ma, matKhauMoi: 'mat-khau-thu-ba' }, LUC_YEU_CAU)
        expect(maLoi(lanHai)).toBe(gopLoiMaDatLai ? 'MA_KHONG_HOP_LE' : 'MA_DA_DUNG')
        expect(maLoi(await kho.dangNhap({ email, matKhau: MAT_KHAU_MOI }))).toBe('THANH_CONG')
        expect(maLoi(await kho.dangNhap({ email, matKhau: 'mat-khau-thu-ba' }))).toBe('SAI_THONG_TIN_DANG_NHAP')
      })

      it.skipIf(dongHoCuaKho)('mã hết hạn theo thời hạn cấu hình tính bằng đồng hồ truyền vào: trả MA_HET_HAN', async () => {
        const email = await dangKyDaXacNhan('nhung')
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU))
        const ma = await maDatLai(email)
        const hetHan = sau(LUC_YEU_CAU, banCai.thoiHanMaDatLaiMs)

        const kq = await kho.datLaiMatKhau({ email, ma, matKhauMoi: MAT_KHAU_MOI }, hetHan)
        expect(maLoi(kq)).toBe('MA_HET_HAN')
        expect(maLoi(await kho.dangNhap({ email, matKhau: MAT_KHAU }))).toBe('THANH_CONG')
        expect(maLoi(await kho.dangNhap({ email, matKhau: MAT_KHAU_MOI }))).toBe('SAI_THONG_TIN_DANG_NHAP')
      })

      it('ngay trước khi hết hạn mã vẫn dùng được', async () => {
        const email = await dangKyDaXacNhan('mai')
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU))
        const ma = await maDatLai(email)
        const ngayTruoc = sau(LUC_YEU_CAU, banCai.thoiHanMaDatLaiMs - 1)
        expect(maLoi(await kho.datLaiMatKhau({ email, ma, matKhauMoi: MAT_KHAU_MOI }, ngayTruoc))).toBe('THANH_CONG')
      })

      it('sai mã hoặc email không có mã trả MA_KHONG_HOP_LE và không đổi gì', async () => {
        const email = await dangKyDaXacNhan('lien')
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU))
        const ma = await maDatLai(email)

        expect(maLoi(await kho.datLaiMatKhau({ email, ma: `${ma}9`, matKhauMoi: MAT_KHAU_MOI }, LUC_YEU_CAU))).toBe(
          'MA_KHONG_HOP_LE',
        )
        expect(
          maLoi(await kho.datLaiMatKhau({ email: emailMoi('khong-co-ma'), ma, matKhauMoi: MAT_KHAU_MOI }, LUC_YEU_CAU)),
        ).toBe('MA_KHONG_HOP_LE')
        expect(maLoi(await kho.dangNhap({ email, matKhau: MAT_KHAU }))).toBe('THANH_CONG')

        // Mã đúng vẫn còn dùng được sau các lần thử sai.
        expect(maLoi(await kho.datLaiMatKhau({ email, ma, matKhauMoi: MAT_KHAU_MOI }, LUC_YEU_CAU))).toBe('THANH_CONG')
      })

      it('mật khẩu mới ngắn hơn 8 ký tự bị từ chối, không tiêu mã', async () => {
        const email = await dangKyDaXacNhan('kim')
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU))
        const ma = await maDatLai(email)

        const kq = await kho.datLaiMatKhau({ email, ma, matKhauMoi: '1234567' }, LUC_YEU_CAU)
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.matKhauMoi).toBe(THONG_BAO.matKhauNgan)
        expect(maLoi(await kho.dangNhap({ email, matKhau: '1234567' }))).toBe('SAI_THONG_TIN_DANG_NHAP')

        expect(maLoi(await kho.datLaiMatKhau({ email, ma, matKhauMoi: MAT_KHAU_MOI }, LUC_YEU_CAU))).toBe('THANH_CONG')
      })

      it('yêu cầu mã mới thì mã cũ không còn dùng được', async () => {
        const email = await dangKyDaXacNhan('hong')
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU))
        const maCu = await maDatLai(email)
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, sau(LUC_YEU_CAU, 1000)))
        const maMoi = await maDatLai(email)
        expect(maMoi).not.toBe(maCu)

        expect(maLoi(await kho.datLaiMatKhau({ email, ma: maCu, matKhauMoi: MAT_KHAU_MOI }, LUC_YEU_CAU))).toBe(
          'MA_KHONG_HOP_LE',
        )
        expect(maLoi(await kho.datLaiMatKhau({ email, ma: maMoi, matKhauMoi: MAT_KHAU_MOI }, LUC_YEU_CAU))).toBe(
          'THANH_CONG',
        )
      })

      it('đặt lại mật khẩu cho tài khoản chưa xác nhận thì cũng xác nhận email', async () => {
        const email = emailMoi('giao')
        giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Giao' }))
        giaTri(await kho.yeuCauDatLaiMatKhau({ email }, LUC_YEU_CAU))
        giaTri(await kho.datLaiMatKhau({ email, ma: await maDatLai(email), matKhauMoi: MAT_KHAU_MOI }, LUC_YEU_CAU))
        expect(maLoi(await kho.dangNhap({ email, matKhau: MAT_KHAU_MOI }))).toBe('THANH_CONG')
      })
    })

    describe('đăng nhập và đăng xuất', () => {
      it('đăng nhập đúng thì có phiên dùng được', async () => {
        const phien = await dangKyVaDangNhap('dung', 'Dũng')
        expect(giaTri(await kho.layHoSoCuaToi(phien)).tenHienThi).toBe('Dũng')
      })

      it('email nhập khác hoa thường vẫn đăng nhập được', async () => {
        const email = await dangKyDaXacNhan('giang', 'Giang')
        expect(maLoi(await kho.dangNhap({ email: email.toUpperCase(), matKhau: MAT_KHAU }))).toBe('THANH_CONG')
      })

      it('sai mật khẩu và email chưa đăng ký trả cùng một lỗi chung', async () => {
        const email = await dangKyDaXacNhan('ha', 'Hà')
        const saiMatKhau = await kho.dangNhap({ email, matKhau: 'sai-mat-khau' })
        const chuaDangKy = await kho.dangNhap({ email: emailMoi('chua-co'), matKhau: MAT_KHAU })
        expect(saiMatKhau.ok).toBe(false)
        expect(chuaDangKy.ok).toBe(false)
        if (saiMatKhau.ok || chuaDangKy.ok) return
        expect(saiMatKhau.loi).toEqual(chuaDangKy.loi)
        expect(saiMatKhau.loi.ma).toBe('SAI_THONG_TIN_DANG_NHAP')
      })

      it('đăng xuất thì hết phiên', async () => {
        const phien = await dangKyVaDangNhap('khanh')
        expect(maLoi(await kho.dangXuat(phien))).toBe('THANH_CONG')
        expect(maLoi(await kho.layHoSoCuaToi(phien))).toBe('CHUA_DANG_NHAP')
        expect(maLoi(await kho.danhSachDuAnCuaToi(phien))).toBe('CHUA_DANG_NHAP')
      })
    })

    describe('người gọi chưa đăng nhập', () => {
      it('mọi lệnh cần danh tính trả CHUA_DANG_NHAP', async () => {
        const phienGia: Phien = { maPhien: 'khong-ton-tai', nguoiDungId: 'khong-ton-tai' }
        for (const phien of [null, phienGia]) {
          expect(maLoi(await kho.layHoSoCuaToi(phien))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.suaHoSo(phien, 'ai-do', { tenHienThi: 'X' }))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.danhSachDuAnCuaToi(phien))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.danhSachNguoiDung(phien))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.doiVai(phien, 'ai-do', { vai: 'PM' }))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.taoDuAn(phien, { ten: 'X' }, LUC_TAO_DU_AN))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.danhSachDuAn(phien))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.layDuAn(phien, 'du-an'))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.suaDuAn(phien, 'du-an', { ten: 'X' }, LUC_TAO_DU_AN))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.luuTruDuAn(phien, 'du-an', LUC_TAO_DU_AN))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.moLaiDuAn(phien, 'du-an', LUC_TAO_DU_AN))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.danhSachNguoiTrongDuAn(phien, 'du-an'))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.themNguoiVaoDuAn(phien, 'du-an', { email: 'ai@vi-du.vn' }))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.goNguoiKhoiDuAn(phien, 'du-an', 'ai-do'))).toBe('CHUA_DANG_NHAP')
          const taskMau = { tieuDe: 'X', nguoiThucHienId: 'a', nguoiKiemTraId: 'b' }
          expect(maLoi(await kho.taoTask(phien, 'du-an', taskMau, LUC_TAO_DU_AN))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.danhSachTask(phien, 'du-an'))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.layTask(phien, 'task'))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.dangXuat(phien))).toBe('CHUA_DANG_NHAP')
        }
      })
    })

    describe('sửa hồ sơ', () => {
      it('sửa được tên hiển thị và GitHub username của chính mình', async () => {
        const phien = await dangKyVaDangNhap('lan', 'Lan')
        const sua = giaTri(await kho.suaHoSo(phien, phien.nguoiDungId, { tenHienThi: ' Lan Trần ', githubUsername: 'lan-tran' }))
        expect(sua.tenHienThi).toBe('Lan Trần')
        expect(sua.githubUsername).toBe('lan-tran')
        expect(giaTri(await kho.layHoSoCuaToi(phien))).toEqual(sua)
      })

      it('để trống GitHub username thì xoá', async () => {
        const phien = await dangKyVaDangNhap('minh')
        giaTri(await kho.suaHoSo(phien, phien.nguoiDungId, { githubUsername: 'minh-gh' }))
        const sua = giaTri(await kho.suaHoSo(phien, phien.nguoiDungId, { githubUsername: '  ' }))
        expect(sua.githubUsername).toBeNull()
      })

      it.each(['-bat-dau', 'ket-thuc-', 'hai--gach', 'co khoang', 'co_gach_duoi', 'a'.repeat(40)])(
        'GitHub username sai định dạng "%s" bị từ chối và không đổi gì',
        async (username) => {
          const phien = await dangKyVaDangNhap('nam', 'Nam')
          const truoc = giaTri(await kho.layHoSoCuaToi(phien))
          const kq = await kho.suaHoSo(phien, phien.nguoiDungId, { tenHienThi: 'Tên mới', githubUsername: username })
          expect(maLoi(kq)).toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.loiTheoO?.githubUsername).toBe(THONG_BAO.githubSai)
          expect(giaTri(await kho.layHoSoCuaToi(phien))).toEqual(truoc)
        },
      )

      it('tên hiển thị rỗng hoặc toàn khoảng trắng bị từ chối và không đổi gì', async () => {
        const phien = await dangKyVaDangNhap('oanh', 'Oanh')
        const kq = await kho.suaHoSo(phien, phien.nguoiDungId, { tenHienThi: '   ' })
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.tenHienThi).toBe(THONG_BAO.tenTrong)
        expect(giaTri(await kho.layHoSoCuaToi(phien)).tenHienThi).toBe('Oanh')
      })

      it('sửa hồ sơ người khác trả KHONG_CO_QUYEN và dữ liệu không đổi', async () => {
        const phienA = await dangKyVaDangNhap('phuong', 'Phương')
        const phienB = await dangKyVaDangNhap('quang', 'Quang')
        const truocB = giaTri(await kho.layHoSoCuaToi(phienB))

        const kq = await kho.suaHoSo(phienA, phienB.nguoiDungId, { tenHienThi: 'Bị sửa', githubUsername: 'ke-gian' })
        expect(maLoi(kq)).toBe('KHONG_CO_QUYEN')
        expect(giaTri(await kho.layHoSoCuaToi(phienB))).toEqual(truocB)
      })
    })

    describe('vai hệ thống và danh sách người dùng', () => {
      async function vaiCua(phien: Phien): Promise<VaiHeThong> {
        return giaTri(await kho.layHoSoCuaToi(phien)).vai
      }

      function timTrong(danhSach: NguoiDungTomTat[], id: string): NguoiDungTomTat | undefined {
        return danhSach.find((nd) => nd.id === id)
      }

      it('PM liệt kê được mọi tài khoản với tên, email và vai', async () => {
        const pm = await taoPM('pm-an', 'An PM')
        const support = await taoNguoiCoVai(pm, 'support-binh', 'SUPPORT')
        const thanhVien = await dangKyVaDangNhap('tv-chi', 'Chi')
        // Tài khoản chưa xác nhận email cũng là một tài khoản.
        const chuaXacNhan = giaTri(await kho.dangKy({ email: emailMoi('dung'), matKhau: MAT_KHAU, tenHienThi: 'Dũng' }))

        const danhSach = giaTri(await kho.danhSachNguoiDung(pm))
        expect(timTrong(danhSach, pm.nguoiDungId)).toEqual({
          id: pm.nguoiDungId,
          email: emailMoi('pm-an'),
          tenHienThi: 'An PM',
          vai: 'PM',
        })
        expect(timTrong(danhSach, support.nguoiDungId)).toEqual({
          id: support.nguoiDungId,
          email: emailMoi('support-binh'),
          tenHienThi: 'support-binh',
          vai: 'SUPPORT',
        })
        expect(timTrong(danhSach, thanhVien.nguoiDungId)).toEqual({
          id: thanhVien.nguoiDungId,
          email: emailMoi('tv-chi'),
          tenHienThi: 'Chi',
          vai: 'THANH_VIEN',
        })
        expect(timTrong(danhSach, chuaXacNhan.id)).toEqual({
          id: chuaXacNhan.id,
          email: emailMoi('dung'),
          tenHienThi: 'Dũng',
          vai: 'THANH_VIEN',
        })
      })

      it.each<VaiHeThong>(['SUPPORT', 'THANH_VIEN'])('%s gọi danh sách người dùng trả KHONG_CO_QUYEN', async (vai) => {
        const pm = await taoPM('pm-giang')
        const nguoiGoi = await taoNguoiCoVai(pm, 'nguoi-goi', vai)
        expect(maLoi(await kho.danhSachNguoiDung(nguoiGoi))).toBe('KHONG_CO_QUYEN')
      })

      it.each(CAC_VAI.flatMap((tu) => CAC_VAI.filter((den) => den !== tu).map((den) => ({ tu, den }))))(
        'PM đổi vai $tu → $den, vai mới có hiệu lực ngay ở lần đọc sau',
        async ({ tu, den }) => {
          const pm = await taoPM('pm-hai')
          const dich = await taoNguoiCoVai(pm, 'dich', tu)
          expect(await vaiCua(dich)).toBe(tu)

          const kq = giaTri(await kho.doiVai(pm, dich.nguoiDungId, { vai: den }))
          expect(kq).toEqual(expect.objectContaining({ id: dich.nguoiDungId, vai: den }))

          // Lần đọc sau, kể cả bằng phiên đang mở của chính người đó, thấy vai mới.
          expect(await vaiCua(dich)).toBe(den)
          expect(timTrong(giaTri(await kho.danhSachNguoiDung(pm)), dich.nguoiDungId)?.vai).toBe(den)
          // Quyền theo vai mới có hiệu lực ngay.
          expect(maLoi(await kho.danhSachNguoiDung(dich))).toBe(den === 'PM' ? 'THANH_CONG' : 'KHONG_CO_QUYEN')
        },
      )

      it('PM đặt lại đúng vai đang có thì thành công và không đổi gì', async () => {
        const pm = await taoPM('pm-lap')
        const tv = await dangKyVaDangNhap('tv-lap')
        expect(giaTri(await kho.doiVai(pm, tv.nguoiDungId, { vai: 'THANH_VIEN' })).vai).toBe('THANH_VIEN')
        expect(await vaiCua(tv)).toBe('THANH_VIEN')
      })

      it.each<VaiHeThong>(['SUPPORT', 'THANH_VIEN'])(
        '%s đổi vai bất kỳ ai, kể cả tự nâng vai mình, trả KHONG_CO_QUYEN và vai không đổi',
        async (vai) => {
          const pm = await taoPM('pm-khanh')
          const nguoiGoi = await taoNguoiCoVai(pm, 'nguoi-goi', vai)
          const khac = await dangKyVaDangNhap('nguoi-khac')

          for (const vaiMoi of CAC_VAI) {
            expect(maLoi(await kho.doiVai(nguoiGoi, nguoiGoi.nguoiDungId, { vai: vaiMoi }))).toBe('KHONG_CO_QUYEN')
            expect(maLoi(await kho.doiVai(nguoiGoi, khac.nguoiDungId, { vai: vaiMoi }))).toBe('KHONG_CO_QUYEN')
            expect(maLoi(await kho.doiVai(nguoiGoi, pm.nguoiDungId, { vai: vaiMoi }))).toBe('KHONG_CO_QUYEN')
          }
          // Không lộ gì thêm: id không tồn tại hay vai sai cũng chỉ là không có quyền.
          expect(maLoi(await kho.doiVai(nguoiGoi, 'khong-ton-tai', { vai: 'PM' }))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.doiVai(nguoiGoi, khac.nguoiDungId, { vai: 'ADMIN' }))).toBe('KHONG_CO_QUYEN')

          expect(await vaiCua(nguoiGoi)).toBe(vai)
          expect(await vaiCua(khac)).toBe('THANH_VIEN')
          expect(await vaiCua(pm)).toBe('PM')
        },
      )

      it('vai không phải PM, Support hay Thành viên trả KHONG_HOP_LE và vai không đổi', async () => {
        const pm = await taoPM('pm-lam')
        const tv = await dangKyVaDangNhap('tv-lam')
        for (const vaiSai of ['ADMIN', '', 'pm']) {
          const kq = await kho.doiVai(pm, tv.nguoiDungId, { vai: vaiSai })
          expect(maLoi(kq)).toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.thongBao).toBe(THONG_BAO.vaiSai)
        }
        expect(await vaiCua(tv)).toBe('THANH_VIEN')
      })

      it('PM đổi vai tài khoản không tồn tại trả KHONG_TIM_THAY', async () => {
        const pm = await taoPM('pm-mai')
        expect(maLoi(await kho.doiVai(pm, 'khong-ton-tai', { vai: 'SUPPORT' }))).toBe('KHONG_TIM_THAY')
      })

      it.skipIf(!khoChuaCoPM)('PM cuối cùng tự hạ mình trả PHAI_CON_PM và vai không đổi', async () => {
        const pm = await taoPM('pm-cuoi')
        for (const vaiMoi of ['SUPPORT', 'THANH_VIEN'] as const) {
          const kq = await kho.doiVai(pm, pm.nguoiDungId, { vai: vaiMoi })
          expect(maLoi(kq)).toBe('PHAI_CON_PM')
          if (!kq.ok) expect(kq.loi.thongBao).toMatch(/ít nhất một PM/)
        }
        expect(await vaiCua(pm)).toBe('PM')
        expect(maLoi(await kho.danhSachNguoiDung(pm))).toBe('THANH_CONG')
      })

      it.skipIf(!khoChuaCoPM)('còn PM khác thì hạ được; tới khi chỉ còn một PM thì không hạ được nữa', async () => {
        const pmA = await taoPM('pm-a')
        const pmB = await taoNguoiCoVai(pmA, 'pm-b', 'PM')
        const pmC = await taoNguoiCoVai(pmA, 'pm-c', 'PM')

        // Hạ PM khác khi còn PM khác.
        expect(giaTri(await kho.doiVai(pmA, pmC.nguoiDungId, { vai: 'SUPPORT' })).vai).toBe('SUPPORT')
        // PM tự hạ mình khi còn PM khác.
        expect(giaTri(await kho.doiVai(pmA, pmA.nguoiDungId, { vai: 'THANH_VIEN' })).vai).toBe('THANH_VIEN')
        expect(await vaiCua(pmA)).toBe('THANH_VIEN')

        // B giờ là PM cuối cùng: tự hạ bị từ chối, vai không đổi.
        expect(maLoi(await kho.doiVai(pmB, pmB.nguoiDungId, { vai: 'SUPPORT' }))).toBe('PHAI_CON_PM')
        expect(await vaiCua(pmB)).toBe('PM')

        // Nâng lại một PM khác thì B hạ được.
        giaTri(await kho.doiVai(pmB, pmC.nguoiDungId, { vai: 'PM' }))
        expect(giaTri(await kho.doiVai(pmB, pmB.nguoiDungId, { vai: 'SUPPORT' })).vai).toBe('SUPPORT')
        expect(await vaiCua(pmC)).toBe('PM')
      })
    })

    describe('Dự án: tạo, sửa, Lưu trữ, danh sách và dấu vết', () => {
      const LUC_SUA = sau(LUC_TAO_DU_AN, 2 * 60 * 60 * 1000)
      const LUC_LUU_TRU = sau(LUC_TAO_DU_AN, 24 * 60 * 60 * 1000)
      const LUC_MO_LAI = sau(LUC_TAO_DU_AN, 48 * 60 * 60 * 1000)

      async function idCacDuAn(phienPM: Phien, trangThai?: string): Promise<string[]> {
        const ds = giaTri(await kho.danhSachDuAn(phienPM, trangThai === undefined ? undefined : { trangThai }))
        return ds.map((duAn) => duAn.id)
      }

      it('PM tạo Dự án: tên bỏ khoảng trắng hai đầu, mô tả tuỳ chọn, đang hoạt động, dấu vết theo người gọi và đồng hồ truyền vào', async () => {
        const pm = await taoPM('pm-tao', 'An PM')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: '  Website bán hàng  ' }, LUC_TAO_DU_AN))
        expect(duAn).toEqual({
          id: expect.any(String),
          ten: 'Website bán hàng',
          moTa: '',
          trangThai: 'HOAT_DONG',
          dauVet: {
            taoBoi: { id: pm.nguoiDungId, tenHienThi: 'An PM' },
            taoLuc: luc(LUC_TAO_DU_AN),
            suaBoi: null,
            suaLuc: null,
          },
        })
        // Đọc lại thấy đúng như vậy.
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)

        const coMoTa = giaTri(await kho.taoDuAn(pm, { ten: 'Ứng dụng', moTa: '  Làm lại app  ' }, LUC_TAO_DU_AN))
        expect(coMoTa.moTa).toBe('Làm lại app')
        expect(coMoTa.id).not.toBe(duAn.id)
      })

      it('tên đúng 120 ký tự được nhận', async () => {
        const pm = await taoPM('pm-dai')
        const ten = 'a'.repeat(DO_DAI_TEN_DU_AN_TOI_DA)
        expect(giaTri(await kho.taoDuAn(pm, { ten }, LUC_TAO_DU_AN)).ten).toBe(ten)
      })

      it.each([
        { ca: 'tên rỗng', ten: '', thongBao: THONG_BAO_DU_AN.tenTrong },
        { ca: 'tên chỉ khoảng trắng', ten: ' \t  ', thongBao: THONG_BAO_DU_AN.tenTrong },
        { ca: 'tên quá 120 ký tự', ten: 'a'.repeat(DO_DAI_TEN_DU_AN_TOI_DA + 1), thongBao: THONG_BAO_DU_AN.tenQuaDai },
      ])('$ca bị từ chối kèm thông báo tiếng Việt và không tạo gì', async ({ ten, thongBao }) => {
        const pm = await taoPM('pm-sai')
        const truoc = await idCacDuAn(pm)
        const kq = await kho.taoDuAn(pm, { ten, moTa: 'Mô tả' }, LUC_TAO_DU_AN)
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.ten).toBe(thongBao)
        expect(await idCacDuAn(pm)).toEqual(truoc)
      })

      it.each<VaiHeThong>(['SUPPORT', 'THANH_VIEN'])('%s tạo Dự án trả KHONG_CO_QUYEN và không tạo gì', async (vai) => {
        const pm = await taoPM('pm-quyen')
        const nguoiGoi = await taoNguoiCoVai(pm, 'nguoi-goi', vai)
        const truoc = await idCacDuAn(pm)
        expect(maLoi(await kho.taoDuAn(nguoiGoi, { ten: 'Dự án lén' }, LUC_TAO_DU_AN))).toBe('KHONG_CO_QUYEN')
        // Dữ liệu sai cũng chỉ là không có quyền: không lộ gì thêm.
        expect(maLoi(await kho.taoDuAn(nguoiGoi, { ten: '' }, LUC_TAO_DU_AN))).toBe('KHONG_CO_QUYEN')
        expect(await idCacDuAn(pm)).toEqual(truoc)
      })

      it.each<VaiHeThong>(['SUPPORT', 'THANH_VIEN'])(
        '%s không ở trong Dự án thì không thấy, không mở được và không sửa được Dự án đó',
        async (vai) => {
          const pm = await taoPM('pm-an-giau')
          const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Bí mật' }, LUC_TAO_DU_AN))
          const nguoiGoi = await taoNguoiCoVai(pm, 'nguoi-ngoai', vai)

          expect(giaTri(await kho.danhSachDuAn(nguoiGoi))).toEqual([])
          expect(maLoi(await kho.layDuAn(nguoiGoi, duAn.id))).toBe('KHONG_TIM_THAY')
          expect(maLoi(await kho.suaDuAn(nguoiGoi, duAn.id, { ten: 'Bị sửa' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.luuTruDuAn(nguoiGoi, duAn.id, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.moLaiDuAn(nguoiGoi, duAn.id, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          // Không lộ Dự án có tồn tại hay không: mở Dự án không tồn tại trả đúng cùng một lỗi.
          const khongCo = await kho.layDuAn(nguoiGoi, 'khong-ton-tai')
          const khongThuoc = await kho.layDuAn(nguoiGoi, duAn.id)
          expect(khongThuoc).toEqual(khongCo)
          expect(maLoi(await kho.suaDuAn(nguoiGoi, 'khong-ton-tai', { ten: 'X' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')

          expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
        },
      )

      it('PM sửa tên hoặc mô tả: cập nhật người và ngày chỉnh sửa gần nhất, giữ người và ngày tạo', async () => {
        const pmTao = await taoPM('pm-goc', 'An PM')
        const pmSua = await taoNguoiCoVai(pmTao, 'pm-sua', 'PM', 'Bình PM')
        const duAn = giaTri(await kho.taoDuAn(pmTao, { ten: 'Tên cũ', moTa: 'Mô tả cũ' }, LUC_TAO_DU_AN))

        const suaTen = giaTri(await kho.suaDuAn(pmSua, duAn.id, { ten: '  Tên mới  ' }, LUC_SUA))
        expect(suaTen).toEqual({
          ...duAn,
          ten: 'Tên mới',
          dauVet: {
            taoBoi: { id: pmTao.nguoiDungId, tenHienThi: 'An PM' },
            taoLuc: luc(LUC_TAO_DU_AN),
            suaBoi: { id: pmSua.nguoiDungId, tenHienThi: 'Bình PM' },
            suaLuc: luc(LUC_SUA),
          },
        })
        expect(giaTri(await kho.layDuAn(pmTao, duAn.id))).toEqual(suaTen)

        const sauNua = sau(LUC_SUA, 60_000)
        const suaMoTa = giaTri(await kho.suaDuAn(pmTao, duAn.id, { moTa: 'Mô tả mới' }, sauNua))
        expect(suaMoTa.ten).toBe('Tên mới')
        expect(suaMoTa.moTa).toBe('Mô tả mới')
        expect(suaMoTa.dauVet).toEqual({
          taoBoi: { id: pmTao.nguoiDungId, tenHienThi: 'An PM' },
          taoLuc: luc(LUC_TAO_DU_AN),
          suaBoi: { id: pmTao.nguoiDungId, tenHienThi: 'An PM' },
          suaLuc: luc(sauNua),
        })

        // Để trống mô tả là xoá mô tả.
        expect(giaTri(await kho.suaDuAn(pmTao, duAn.id, { moTa: '   ' }, sauNua)).moTa).toBe('')
      })

      it('sửa với tên sai bị từ chối và không đổi gì, kể cả dấu vết', async () => {
        const pm = await taoPM('pm-sua-sai')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Giữ nguyên' }, LUC_TAO_DU_AN))
        for (const { ten, thongBao } of [
          { ten: '   ', thongBao: THONG_BAO_DU_AN.tenTrong },
          { ten: 'b'.repeat(DO_DAI_TEN_DU_AN_TOI_DA + 1), thongBao: THONG_BAO_DU_AN.tenQuaDai },
        ]) {
          const kq = await kho.suaDuAn(pm, duAn.id, { ten, moTa: 'Không được lưu' }, LUC_SUA)
          expect(maLoi(kq)).toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.loiTheoO?.ten).toBe(thongBao)
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
      })

      it('Dự án không tồn tại trả KHONG_TIM_THAY', async () => {
        const pm = await taoPM('pm-tim')
        expect(maLoi(await kho.layDuAn(pm, 'khong-ton-tai'))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.suaDuAn(pm, 'khong-ton-tai', { ten: 'X' }, LUC_SUA))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.luuTruDuAn(pm, 'khong-ton-tai', LUC_SUA))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.moLaiDuAn(pm, 'khong-ton-tai', LUC_SUA))).toBe('KHONG_TIM_THAY')
      })

      it('Lưu trữ: mọi lệnh ghi trả DU_AN_DA_LUU_TRU nhưng vẫn đọc được; mở lại thì sửa được; cả hai bước cập nhật dấu vết', async () => {
        const pmTao = await taoPM('pm-luu', 'An PM')
        const pmKhac = await taoNguoiCoVai(pmTao, 'pm-khac', 'PM', 'Bình PM')
        const duAn = giaTri(await kho.taoDuAn(pmTao, { ten: 'Sắp xong', moTa: 'Mô tả' }, LUC_TAO_DU_AN))

        const daLuu = giaTri(await kho.luuTruDuAn(pmKhac, duAn.id, LUC_LUU_TRU))
        expect(daLuu).toEqual({
          ...duAn,
          trangThai: 'LUU_TRU',
          dauVet: { ...duAn.dauVet, suaBoi: { id: pmKhac.nguoiDungId, tenHienThi: 'Bình PM' }, suaLuc: luc(LUC_LUU_TRU) },
        })

        // Mọi lệnh ghi bị từ chối, kể cả với dữ liệu sai, và không đổi gì.
        for (const phien of [pmTao, pmKhac]) {
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { ten: 'Sửa lén' }, LUC_MO_LAI))).toBe('DU_AN_DA_LUU_TRU')
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { moTa: 'Sửa lén' }, LUC_MO_LAI))).toBe('DU_AN_DA_LUU_TRU')
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { ten: '' }, LUC_MO_LAI))).toBe('DU_AN_DA_LUU_TRU')
          expect(maLoi(await kho.luuTruDuAn(phien, duAn.id, LUC_MO_LAI))).toBe('DU_AN_DA_LUU_TRU')
        }
        const kq = await kho.suaDuAn(pmTao, duAn.id, { ten: 'Sửa lén' }, LUC_MO_LAI)
        if (!kq.ok) expect(kq.loi.thongBao).toBe(THONG_BAO_DU_AN.daLuuTru)

        // Vẫn đọc được, và vẫn nằm trong danh sách.
        expect(giaTri(await kho.layDuAn(pmTao, duAn.id))).toEqual(daLuu)
        expect(await idCacDuAn(pmTao)).toContain(duAn.id)

        // Mở lại: đang hoạt động, dấu vết cập nhật, sửa được trở lại.
        const moLai = giaTri(await kho.moLaiDuAn(pmTao, duAn.id, LUC_MO_LAI))
        expect(moLai.trangThai).toBe('HOAT_DONG')
        expect(moLai.dauVet).toEqual({
          ...duAn.dauVet,
          suaBoi: { id: pmTao.nguoiDungId, tenHienThi: 'An PM' },
          suaLuc: luc(LUC_MO_LAI),
        })
        const sauMoLai = sau(LUC_MO_LAI, 60_000)
        const sua = giaTri(await kho.suaDuAn(pmKhac, duAn.id, { ten: 'Làm tiếp' }, sauMoLai))
        expect(sua.ten).toBe('Làm tiếp')
        expect(sua.dauVet.suaLuc).toEqual(luc(sauMoLai))
        expect(sua.dauVet.taoLuc).toEqual(duAn.dauVet.taoLuc)
        expect(sua.dauVet.taoLuc).toEqual(luc(LUC_TAO_DU_AN))
      })

      it('mở lại Dự án đang hoạt động trả DU_AN_DANG_HOAT_DONG và không đổi dấu vết', async () => {
        const pm = await taoPM('pm-mo-lai')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Đang chạy' }, LUC_TAO_DU_AN))
        expect(maLoi(await kho.moLaiDuAn(pm, duAn.id, LUC_MO_LAI))).toBe('DU_AN_DANG_HOAT_DONG')
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
      })

      it('PM thấy mọi Dự án, kể cả do PM khác tạo, và lọc được giữa đang hoạt động và Lưu trữ', async () => {
        const pmA = await taoPM('pm-ds-a')
        const pmB = await taoNguoiCoVai(pmA, 'pm-ds-b', 'PM')
        const motA = giaTri(await kho.taoDuAn(pmA, { ten: 'Một' }, LUC_TAO_DU_AN))
        const haiB = giaTri(await kho.taoDuAn(pmB, { ten: 'Hai' }, LUC_TAO_DU_AN))
        const baB = giaTri(await kho.taoDuAn(pmB, { ten: 'Ba' }, LUC_TAO_DU_AN))
        giaTri(await kho.luuTruDuAn(pmA, baB.id, LUC_LUU_TRU))

        const tatCa = await idCacDuAn(pmA)
        expect(tatCa).toEqual(expect.arrayContaining([motA.id, haiB.id, baB.id]))

        const hoatDong = await idCacDuAn(pmA, 'HOAT_DONG')
        expect(hoatDong).toEqual(expect.arrayContaining([motA.id, haiB.id]))
        expect(hoatDong).not.toContain(baB.id)

        const luuTru = await idCacDuAn(pmB, 'LUU_TRU')
        expect(luuTru).toContain(baB.id)
        expect(luuTru).not.toContain(motA.id)
        expect(luuTru).not.toContain(haiB.id)

        // Bản ghi trong danh sách đầy đủ như khi đọc một Dự án.
        const ds = giaTri(await kho.danhSachDuAn(pmA))
        expect(ds.find((duAn) => duAn.id === haiB.id)).toEqual(haiB)
      })

      it('lọc với trạng thái không phải đang hoạt động hay Lưu trữ trả KHONG_HOP_LE', async () => {
        const pm = await taoPM('pm-loc-sai')
        const kq = await kho.danhSachDuAn(pm, { trangThai: 'DA_XOA' })
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.trangThai).toBe(THONG_BAO_DU_AN.trangThaiSai)
      })
    })

    describe('Dự án của tôi', () => {
      it('người mới đăng ký chưa ở Dự án nào', async () => {
        const phien = await dangKyVaDangNhap('son')
        expect(giaTri(await kho.danhSachDuAnCuaToi(phien))).toEqual([])
      })
    })

    describe('người trong dự án và quyền xem theo vai', () => {
      const LUC_SUA = sau(LUC_TAO_DU_AN, 60 * 60 * 1000)

      async function emailCua(phien: Phien): Promise<string> {
        return giaTri(await kho.layHoSoCuaToi(phien)).email
      }

      async function idNguoiTrong(phien: Phien, duAnId: string): Promise<string[]> {
        return giaTri(await kho.danhSachNguoiTrongDuAn(phien, duAnId))
          .map((nguoi) => nguoi.id)
          .sort()
      }

      async function idDuAnThay(phien: Phien): Promise<string[]> {
        return giaTri(await kho.danhSachDuAn(phien)).map((duAn) => duAn.id)
      }

      /** PM `pm` thêm `phien` vào Dự án. */
      async function them(pm: Phien, duAnId: string, phien: Phien): Promise<void> {
        giaTri(await kho.themNguoiVaoDuAn(pm, duAnId, { email: await emailCua(phien) }))
      }

      it('PM thêm người bằng email đã đăng ký (khác hoa thường): người đó vào danh sách với tên, email và vai', async () => {
        const pm = await taoPM('pm-them')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC_TAO_DU_AN))
        const binh = await taoNguoiCoVai(pm, 'binh', 'SUPPORT', 'Bình')
        const chi = await dangKyVaDangNhap('chi', 'Chi')
        expect(giaTri(await kho.danhSachNguoiTrongDuAn(pm, duAn.id))).toEqual([])

        const kq = giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: `  ${emailMoi('binh').toUpperCase()} ` }))
        expect(kq).toEqual({ id: binh.nguoiDungId, email: emailMoi('binh'), tenHienThi: 'Bình', vai: 'SUPPORT' })
        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('chi') }))

        const danhSach = giaTri(await kho.danhSachNguoiTrongDuAn(pm, duAn.id))
        expect(danhSach).toHaveLength(2)
        expect(danhSach).toEqual(
          expect.arrayContaining([
            { id: binh.nguoiDungId, email: emailMoi('binh'), tenHienThi: 'Bình', vai: 'SUPPORT' },
            { id: chi.nguoiDungId, email: emailMoi('chi'), tenHienThi: 'Chi', vai: 'THANH_VIEN' },
          ]),
        )

        // Người được thêm thấy Dự án ở danh sách, ở "Dự án của tôi" và mở được.
        for (const phien of [binh, chi]) {
          expect(await idDuAnThay(phien)).toEqual([duAn.id])
          expect(giaTri(await kho.danhSachDuAnCuaToi(phien))).toEqual([
            { id: duAn.id, ten: 'Cửa hàng', trangThai: 'HOAT_DONG' },
          ])
          expect(giaTri(await kho.layDuAn(phien, duAn.id))).toEqual(duAn)
          expect(await idNguoiTrong(phien, duAn.id)).toEqual([binh.nguoiDungId, chi.nguoiDungId].sort())
        }
      })

      it('thêm người chưa xác nhận email cũng được: tài khoản đã đăng ký', async () => {
        const pm = await taoPM('pm-chua-xn')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC_TAO_DU_AN))
        const hoSo = giaTri(await kho.dangKy({ email: emailMoi('moi-dk'), matKhau: MAT_KHAU, tenHienThi: 'Mới' }))
        expect(giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('moi-dk') })).id).toBe(hoSo.id)
      })

      it('email chưa đăng ký trả CHUA_DANG_KY kèm thông báo "chưa đăng ký", không thêm gì và không gửi thư', async () => {
        const pm = await taoPM('pm-chua-dk')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC_TAO_DU_AN))
        const kq = await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('chua-dang-ky') })
        expect(maLoi(kq)).toBe('CHUA_DANG_KY')
        if (!kq.ok) expect(kq.loi.thongBao).toMatch(/chưa đăng ký/)
        expect(giaTri(await kho.danhSachNguoiTrongDuAn(pm, duAn.id))).toEqual([])
        // Không có thư mời: email đó vẫn chưa có tài khoản, đăng ký mới vẫn được.
        expect(await banCai.maDatLaiMoiNhat(emailMoi('chua-dang-ky'))).toBeNull()
        expect(maLoi(await kho.dangNhap({ email: emailMoi('chua-dang-ky'), matKhau: MAT_KHAU }))).toBe(
          'SAI_THONG_TIN_DANG_NHAP',
        )
      })

      it('email sai định dạng trả KHONG_HOP_LE kèm lỗi ở ô email', async () => {
        const pm = await taoPM('pm-sai-email')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC_TAO_DU_AN))
        const kq = await kho.themNguoiVaoDuAn(pm, duAn.id, { email: 'khong-phai-email' })
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.email).toBe(THONG_BAO.emailSai)
      })

      it('người đã trong Dự án trả DA_TRONG_DU_AN và danh sách không đổi', async () => {
        const pm = await taoPM('pm-trung')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC_TAO_DU_AN))
        const an = await dangKyVaDangNhap('an-trung')
        await them(pm, duAn.id, an)
        const kq = await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('an-trung').toUpperCase() })
        expect(maLoi(kq)).toBe('DA_TRONG_DU_AN')
        expect(await idNguoiTrong(pm, duAn.id)).toEqual([an.nguoiDungId])
      })

      it('Support của Dự án thêm và gỡ người, sửa, Lưu trữ và mở lại được Dự án của mình', async () => {
        const pm = await taoPM('pm-sp')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Cũ' }, LUC_TAO_DU_AN))
        const support = await taoNguoiCoVai(pm, 'support-sp', 'SUPPORT', 'Sơn Support')
        const tv = await dangKyVaDangNhap('tv-sp')
        await them(pm, duAn.id, support)

        expect(giaTri(await kho.themNguoiVaoDuAn(support, duAn.id, { email: emailMoi('tv-sp') })).id).toBe(tv.nguoiDungId)
        expect(await idNguoiTrong(pm, duAn.id)).toEqual([support.nguoiDungId, tv.nguoiDungId].sort())

        const sua = giaTri(await kho.suaDuAn(support, duAn.id, { ten: 'Mới', moTa: 'Mô tả' }, LUC_SUA))
        expect(sua.ten).toBe('Mới')
        expect(sua.dauVet.suaBoi).toEqual({ id: support.nguoiDungId, tenHienThi: 'Sơn Support' })

        expect(giaTri(await kho.goNguoiKhoiDuAn(support, duAn.id, tv.nguoiDungId))).toBeNull()
        expect(await idNguoiTrong(pm, duAn.id)).toEqual([support.nguoiDungId])

        expect(giaTri(await kho.luuTruDuAn(support, duAn.id, LUC_SUA)).trangThai).toBe('LUU_TRU')
        expect(giaTri(await kho.moLaiDuAn(support, duAn.id, LUC_SUA)).trangThai).toBe('HOAT_DONG')
      })

      it('PM gỡ người: người đó không còn thấy Dự án, nhưng tài khoản và hồ sơ giữ nguyên', async () => {
        const pm = await taoPM('pm-go')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC_TAO_DU_AN))
        const dung = await dangKyVaDangNhap('dung-go', 'Dũng')
        giaTri(await kho.suaHoSo(dung, dung.nguoiDungId, { githubUsername: 'dung-gh' }))
        await them(pm, duAn.id, dung)
        const hoSoTruoc = giaTri(await kho.layHoSoCuaToi(dung))

        expect(giaTri(await kho.goNguoiKhoiDuAn(pm, duAn.id, dung.nguoiDungId))).toBeNull()

        expect(giaTri(await kho.danhSachNguoiTrongDuAn(pm, duAn.id))).toEqual([])
        expect(await idDuAnThay(dung)).toEqual([])
        expect(giaTri(await kho.danhSachDuAnCuaToi(dung))).toEqual([])
        expect(maLoi(await kho.layDuAn(dung, duAn.id))).toBe('KHONG_TIM_THAY')
        // Tài khoản, hồ sơ và phiên đang mở không bị đụng tới.
        expect(giaTri(await kho.layHoSoCuaToi(dung))).toEqual(hoSoTruoc)
        expect(maLoi(await kho.dangNhap({ email: emailMoi('dung-go'), matKhau: MAT_KHAU }))).toBe('THANH_CONG')
        expect(giaTri(await kho.danhSachNguoiDung(pm)).find((nd) => nd.id === dung.nguoiDungId)).toEqual({
          id: dung.nguoiDungId,
          email: hoSoTruoc.email,
          tenHienThi: 'Dũng',
          vai: 'THANH_VIEN',
        })

        // Thêm lại được.
        await them(pm, duAn.id, dung)
        expect(await idDuAnThay(dung)).toEqual([duAn.id])
      })

      it('gỡ người không ở trong Dự án hoặc không tồn tại trả KHONG_TIM_THAY', async () => {
        const pm = await taoPM('pm-go-sai')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC_TAO_DU_AN))
        const ngoai = await dangKyVaDangNhap('ngoai-go')
        expect(maLoi(await kho.goNguoiKhoiDuAn(pm, duAn.id, ngoai.nguoiDungId))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.goNguoiKhoiDuAn(pm, duAn.id, 'khong-ton-tai'))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.goNguoiKhoiDuAn(pm, 'khong-ton-tai', ngoai.nguoiDungId))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.themNguoiVaoDuAn(pm, 'khong-ton-tai', { email: emailMoi('ngoai-go') }))).toBe(
          'KHONG_TIM_THAY',
        )
      })

      it.each([
        { ca: 'Support không ở trong Dự án', vai: 'SUPPORT' as const, trong: false },
        { ca: 'Thành viên ở trong Dự án', vai: 'THANH_VIEN' as const, trong: true },
        { ca: 'Thành viên không ở trong Dự án', vai: 'THANH_VIEN' as const, trong: false },
      ])('$ca: thêm, gỡ người, sửa, Lưu trữ đều trả KHONG_CO_QUYEN và không đổi gì', async ({ vai, trong }) => {
        const pm = await taoPM('pm-cam')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Giữ nguyên' }, LUC_TAO_DU_AN))
        const nguoiGoi = await taoNguoiCoVai(pm, 'nguoi-goi', vai)
        const cu = await dangKyVaDangNhap('nguoi-cu')
        await dangKyDaXacNhan('nguoi-moi')
        await them(pm, duAn.id, cu)
        if (trong) await them(pm, duAn.id, nguoiGoi)
        const nguoiTruoc = await idNguoiTrong(pm, duAn.id)

        expect(maLoi(await kho.themNguoiVaoDuAn(nguoiGoi, duAn.id, { email: emailMoi('nguoi-moi') }))).toBe(
          'KHONG_CO_QUYEN',
        )
        // Dữ liệu sai hay email chưa đăng ký cũng chỉ là không có quyền: không lộ gì thêm.
        expect(maLoi(await kho.themNguoiVaoDuAn(nguoiGoi, duAn.id, { email: emailMoi('chua-co') }))).toBe(
          'KHONG_CO_QUYEN',
        )
        expect(maLoi(await kho.goNguoiKhoiDuAn(nguoiGoi, duAn.id, cu.nguoiDungId))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.goNguoiKhoiDuAn(nguoiGoi, duAn.id, nguoiGoi.nguoiDungId))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.suaDuAn(nguoiGoi, duAn.id, { ten: 'Bị sửa' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.luuTruDuAn(nguoiGoi, duAn.id, LUC_SUA))).toBe('KHONG_CO_QUYEN')

        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
        expect(await idNguoiTrong(pm, duAn.id)).toEqual(nguoiTruoc)
      })

      it('PM làm được ở mọi Dự án, kể cả Dự án mình không ở trong và do PM khác tạo', async () => {
        const pmA = await taoPM('pm-moi-a')
        const pmB = await taoNguoiCoVai(pmA, 'pm-moi-b', 'PM')
        const duAn = giaTri(await kho.taoDuAn(pmA, { ten: 'Của A' }, LUC_TAO_DU_AN))
        const tv = await dangKyVaDangNhap('tv-moi')

        await them(pmB, duAn.id, tv)
        expect(giaTri(await kho.suaDuAn(pmB, duAn.id, { ten: 'B sửa' }, LUC_SUA)).ten).toBe('B sửa')
        expect(giaTri(await kho.goNguoiKhoiDuAn(pmB, duAn.id, tv.nguoiDungId))).toBeNull()
        expect(giaTri(await kho.luuTruDuAn(pmB, duAn.id, LUC_SUA)).trangThai).toBe('LUU_TRU')
        expect(giaTri(await kho.moLaiDuAn(pmB, duAn.id, LUC_SUA)).trangThai).toBe('HOAT_DONG')
      })

      it('Dự án đã Lưu trữ: thêm hoặc gỡ người trả DU_AN_DA_LUU_TRU, nhưng vẫn xem được danh sách', async () => {
        const pm = await taoPM('pm-lt')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC_TAO_DU_AN))
        const support = await taoNguoiCoVai(pm, 'support-lt', 'SUPPORT')
        const cu = await dangKyVaDangNhap('cu-lt')
        await dangKyDaXacNhan('moi-lt')
        await them(pm, duAn.id, support)
        await them(pm, duAn.id, cu)
        giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC_SUA))
        const truoc = await idNguoiTrong(pm, duAn.id)

        for (const phien of [pm, support]) {
          const kqThem = await kho.themNguoiVaoDuAn(phien, duAn.id, { email: emailMoi('moi-lt') })
          expect(maLoi(kqThem)).toBe('DU_AN_DA_LUU_TRU')
          if (!kqThem.ok) expect(kqThem.loi.thongBao).toBe(THONG_BAO_DU_AN.daLuuTru)
          expect(maLoi(await kho.goNguoiKhoiDuAn(phien, duAn.id, cu.nguoiDungId))).toBe('DU_AN_DA_LUU_TRU')
        }
        expect(await idNguoiTrong(pm, duAn.id)).toEqual(truoc)
        expect(await idNguoiTrong(cu, duAn.id)).toEqual(truoc)
      })

      it('quyền xem: PM thấy tất cả; Support và Thành viên chỉ thấy Dự án mình ở trong; người chưa ở đâu nhận danh sách rỗng', async () => {
        const pm = await taoPM('pm-xem')
        const mot = giaTri(await kho.taoDuAn(pm, { ten: 'Một' }, LUC_TAO_DU_AN))
        const hai = giaTri(await kho.taoDuAn(pm, { ten: 'Hai' }, LUC_TAO_DU_AN))
        const ba = giaTri(await kho.taoDuAn(pm, { ten: 'Ba' }, LUC_TAO_DU_AN))
        const support = await taoNguoiCoVai(pm, 'support-xem', 'SUPPORT')
        const tv = await dangKyVaDangNhap('tv-xem')
        const nguoiLa = await dangKyVaDangNhap('nguoi-la')
        const supportLa = await taoNguoiCoVai(pm, 'support-la', 'SUPPORT')
        await them(pm, mot.id, support)
        await them(pm, hai.id, support)
        await them(pm, hai.id, tv)
        giaTri(await kho.luuTruDuAn(pm, hai.id, LUC_SUA))

        expect(await idDuAnThay(pm)).toEqual(expect.arrayContaining([mot.id, hai.id, ba.id]))
        expect((await idDuAnThay(support)).sort()).toEqual([mot.id, hai.id].sort())
        expect(await idDuAnThay(tv)).toEqual([hai.id])
        // Bộ lọc trạng thái vẫn áp trên những Dự án được thấy.
        expect(giaTri(await kho.danhSachDuAn(support, { trangThai: 'LUU_TRU' })).map((d) => d.id)).toEqual([hai.id])
        expect(giaTri(await kho.danhSachDuAn(tv, { trangThai: 'HOAT_DONG' }))).toEqual([])

        for (const phien of [nguoiLa, supportLa]) {
          expect(giaTri(await kho.danhSachDuAn(phien))).toEqual([])
          expect(giaTri(await kho.danhSachDuAnCuaToi(phien))).toEqual([])
        }

        // "Dự án của tôi": chỉ Dự án mình ở trong, kể cả đã Lưu trữ; PM không ở đâu thì rỗng.
        expect(giaTri(await kho.danhSachDuAnCuaToi(pm))).toEqual([])
        expect(
          giaTri(await kho.danhSachDuAnCuaToi(support)).sort((a, b) => a.ten.localeCompare(b.ten, 'vi')),
        ).toEqual([
          { id: hai.id, ten: 'Hai', trangThai: 'LUU_TRU' },
          { id: mot.id, ten: 'Một', trangThai: 'HOAT_DONG' },
        ])

        // Chi tiết: mở thẳng Dự án không thuộc về mình trả không tìm thấy, giống Dự án không tồn tại.
        expect(maLoi(await kho.layDuAn(pm, ba.id))).toBe('THANH_CONG')
        expect(maLoi(await kho.layDuAn(support, hai.id))).toBe('THANH_CONG')
        expect(maLoi(await kho.layDuAn(tv, hai.id))).toBe('THANH_CONG')
        const khongTonTai = await kho.layDuAn(tv, 'khong-ton-tai')
        for (const [phien, duAnId] of [
          [support, ba.id],
          [tv, mot.id],
          [tv, ba.id],
          [nguoiLa, mot.id],
          [supportLa, hai.id],
        ] as const) {
          expect(await kho.layDuAn(phien, duAnId)).toEqual(khongTonTai)
          expect(await kho.danhSachNguoiTrongDuAn(phien, duAnId)).toEqual(khongTonTai)
        }
        expect(maLoi(khongTonTai)).toBe('KHONG_TIM_THAY')
      })

      it('quyền theo vai và danh sách có hiệu lực ngay: đổi vai hay gỡ người thì lần gọi sau thấy khác', async () => {
        const pm = await taoPM('pm-hieu-luc')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC_TAO_DU_AN))
        const nguoi = await dangKyVaDangNhap('nguoi-hl', 'Hà')
        await them(pm, duAn.id, nguoi)

        // Thành viên trong Dự án: thấy nhưng không sửa được.
        expect(maLoi(await kho.suaDuAn(nguoi, duAn.id, { ten: 'X' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
        // Được nâng lên Support: sửa được ngay, danh sách người hiện vai mới.
        giaTri(await kho.doiVai(pm, nguoi.nguoiDungId, { vai: 'SUPPORT' }))
        expect(maLoi(await kho.suaDuAn(nguoi, duAn.id, { ten: 'X' }, LUC_SUA))).toBe('THANH_CONG')
        expect(giaTri(await kho.danhSachNguoiTrongDuAn(pm, duAn.id))).toEqual([
          { id: nguoi.nguoiDungId, email: emailMoi('nguoi-hl'), tenHienThi: 'Hà', vai: 'SUPPORT' },
        ])
        // Support tự gỡ mình: từ đó không còn thấy, không còn quản lý được.
        giaTri(await kho.goNguoiKhoiDuAn(nguoi, duAn.id, nguoi.nguoiDungId))
        expect(maLoi(await kho.layDuAn(nguoi, duAn.id))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.suaDuAn(nguoi, duAn.id, { ten: 'Y' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
      })
    })

    describe.skipIf(!coTask)('Task: tạo, giao việc, xem và dấu vết', () => {
      const LUC_TAO_TASK = sau(LUC_TAO_DU_AN, 3 * 60 * 60 * 1000)

      interface BoiCanh {
        pm: Phien
        duAnId: string
        /** Thành viên trong Dự án, dùng làm Người thực hiện. */
        an: Phien
        /** Thành viên trong Dự án, dùng làm Người kiểm tra. */
        binh: Phien
      }

      async function emailCua(phien: Phien): Promise<string> {
        return giaTri(await kho.layHoSoCuaToi(phien)).email
      }

      async function them(pm: Phien, duAnId: string, phien: Phien): Promise<void> {
        giaTri(await kho.themNguoiVaoDuAn(pm, duAnId, { email: await emailCua(phien) }))
      }

      /** Một PM, một Dự án đang hoạt động và hai Thành viên trong Dự án. */
      async function dungBoiCanh(ten = 'tk', tenDuAn = 'Cửa hàng'): Promise<BoiCanh> {
        const pm = await taoPM(`pm-${ten}`, 'An PM')
        const duAn = giaTri(await kho.taoDuAn(pm, { ten: tenDuAn }, LUC_TAO_DU_AN))
        const an = await dangKyVaDangNhap(`an-${ten}`, 'An')
        const binh = await dangKyVaDangNhap(`binh-${ten}`, 'Bình')
        await them(pm, duAn.id, an)
        await them(pm, duAn.id, binh)
        return { pm, duAnId: duAn.id, an, binh }
      }

      /** Dữ liệu tạo Task hợp lệ (An làm, Bình duyệt), đè bằng `sua`. */
      function giao(bc: BoiCanh, sua: Partial<TaoTaskDauVao> = {}): TaoTaskDauVao {
        return {
          tieuDe: 'Làm trang chủ',
          nguoiThucHienId: bc.an.nguoiDungId,
          nguoiKiemTraId: bc.binh.nguoiDungId,
          ...sua,
        }
      }

      async function idCacTask(phien: Phien, duAnId: string): Promise<string[]> {
        return giaTri(await kho.danhSachTask(phien, duAnId))
          .map((task) => task.id)
          .sort()
      }

      it('PM tạo Task: tiêu đề bỏ khoảng trắng, trạng thái Mới, 0 lần Trả lại, hai người kèm tên, dấu vết theo người gọi và đồng hồ truyền vào', async () => {
        const bc = await dungBoiCanh()
        const task = giaTri(
          await kho.taoTask(
            bc.pm,
            bc.duAnId,
            {
              tieuDe: '  Làm trang chủ  ',
              moTa: '  Theo bản thiết kế mới  ',
              han: '2026-12-31',
              nguoiThucHienId: bc.an.nguoiDungId,
              nguoiKiemTraId: bc.binh.nguoiDungId,
            },
            LUC_TAO_TASK,
          ),
        )
        expect(task).toEqual({
          id: expect.any(String),
          duAnId: bc.duAnId,
          tieuDe: 'Làm trang chủ',
          moTa: 'Theo bản thiết kế mới',
          han: '2026-12-31',
          nguoiThucHien: { id: bc.an.nguoiDungId, tenHienThi: 'An' },
          nguoiKiemTra: { id: bc.binh.nguoiDungId, tenHienThi: 'Bình' },
          trangThai: 'MOI',
          soLanTraLai: 0,
          dauVet: {
            taoBoi: { id: bc.pm.nguoiDungId, tenHienThi: 'An PM' },
            taoLuc: luc(LUC_TAO_TASK),
            suaBoi: null,
            suaLuc: null,
          },
        })
        // Đọc lại (chi tiết và danh sách) thấy đúng như vậy.
        expect(giaTri(await kho.layTask(bc.pm, task.id))).toEqual(task)
        expect(giaTri(await kho.danhSachTask(bc.pm, bc.duAnId))).toEqual([task])
      })

      it('mô tả và hạn tuỳ chọn: thiếu hay để trống thì mô tả rỗng và không có hạn', async () => {
        const bc = await dungBoiCanh()
        const khongCo = giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc), LUC_TAO_TASK))
        expect(khongCo.moTa).toBe('')
        expect(khongCo.han).toBeNull()
        const deTrong = giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { moTa: '   ', han: '  ' }), LUC_TAO_TASK))
        expect(deTrong.moTa).toBe('')
        expect(deTrong.han).toBeNull()
        const hanNull = giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { han: null }), LUC_TAO_TASK))
        expect(hanNull.han).toBeNull()
        expect(new Set([khongCo.id, deTrong.id, hanNull.id]).size).toBe(3)
      })

      it('hạn đã qua vẫn tạo được, kể cả ngày 29/02 của năm nhuận', async () => {
        const bc = await dungBoiCanh()
        expect(giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { han: '2020-01-15' }), LUC_TAO_TASK)).han).toBe(
          '2020-01-15',
        )
        expect(giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { han: '2024-02-29' }), LUC_TAO_TASK)).han).toBe(
          '2024-02-29',
        )
      })

      it('tiêu đề đúng 200 ký tự được nhận', async () => {
        const bc = await dungBoiCanh()
        const tieuDe = 'a'.repeat(DO_DAI_TIEU_DE_TASK_TOI_DA)
        expect(giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { tieuDe }), LUC_TAO_TASK)).tieuDe).toBe(tieuDe)
      })

      it.each([
        { ca: 'tiêu đề rỗng', sua: { tieuDe: '' }, o: 'tieuDe', thongBao: THONG_BAO_TASK.tieuDeTrong },
        { ca: 'tiêu đề chỉ khoảng trắng', sua: { tieuDe: ' \t  ' }, o: 'tieuDe', thongBao: THONG_BAO_TASK.tieuDeTrong },
        {
          ca: 'tiêu đề quá 200 ký tự',
          sua: { tieuDe: 'a'.repeat(DO_DAI_TIEU_DE_TASK_TOI_DA + 1) },
          o: 'tieuDe',
          thongBao: THONG_BAO_TASK.tieuDeQuaDai,
        },
        { ca: 'hạn 30/02', sua: { han: '2026-02-30' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn 29/02 năm không nhuận', sua: { han: '2026-02-29' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn tháng 13', sua: { han: '2026-13-01' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn dạng ngày/tháng/năm', sua: { han: '31/12/2026' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn kèm giờ', sua: { han: '2026-12-31T10:00' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn là chữ', sua: { han: 'mai' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
      ])('$ca bị từ chối với KHONG_HOP_LE kèm thông báo tiếng Việt và không tạo gì', async ({ sua, o, thongBao }) => {
        const bc = await dungBoiCanh()
        const kq = await kho.taoTask(bc.pm, bc.duAnId, giao(bc, sua) as never, LUC_TAO_TASK)
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.[o]).toBe(thongBao)
        expect(await idCacTask(bc.pm, bc.duAnId)).toEqual([])
      })

      it('thiếu Người thực hiện hoặc Người kiểm tra (không gửi, null hay chuỗi rỗng) trả THIEU_NGUOI và không tạo gì', async () => {
        const bc = await dungBoiCanh()
        const an = bc.an.nguoiDungId
        const binh = bc.binh.nguoiDungId
        const cacCa: { dauVao: Record<string, unknown>; o: string[] }[] = [
          { dauVao: { tieuDe: 'X', nguoiKiemTraId: binh }, o: ['nguoiThucHienId'] },
          { dauVao: { tieuDe: 'X', nguoiThucHienId: an }, o: ['nguoiKiemTraId'] },
          { dauVao: { tieuDe: 'X' }, o: ['nguoiThucHienId', 'nguoiKiemTraId'] },
          { dauVao: { tieuDe: 'X', nguoiThucHienId: null, nguoiKiemTraId: binh }, o: ['nguoiThucHienId'] },
          { dauVao: { tieuDe: 'X', nguoiThucHienId: an, nguoiKiemTraId: '  ' }, o: ['nguoiKiemTraId'] },
        ]
        for (const { dauVao, o } of cacCa) {
          const kq = await kho.taoTask(bc.pm, bc.duAnId, dauVao as never, LUC_TAO_TASK)
          expect(maLoi(kq)).toBe('THIEU_NGUOI')
          if (!kq.ok) expect(Object.keys(kq.loi.loiTheoO ?? {}).sort()).toEqual([...o].sort())
        }
        expect(await idCacTask(bc.pm, bc.duAnId)).toEqual([])
      })

      it('người được chọn không ở trong Dự án (đã đăng ký, đã bị gỡ hay không tồn tại) trả NGUOI_NGOAI_DU_AN và không tạo gì', async () => {
        const bc = await dungBoiCanh()
        const ngoai = await dangKyVaDangNhap('ngoai-tk', 'Người ngoài')
        const daGo = await dangKyVaDangNhap('da-go-tk', 'Đã gỡ')
        await them(bc.pm, bc.duAnId, daGo)
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, daGo.nguoiDungId))
        // PM chưa được thêm vào Dự án cũng là người ngoài Dự án đó.
        for (const idNgoai of [ngoai.nguoiDungId, daGo.nguoiDungId, bc.pm.nguoiDungId, 'khong-ton-tai']) {
          const lamThucHien = await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { nguoiThucHienId: idNgoai }), LUC_TAO_TASK)
          expect(maLoi(lamThucHien)).toBe('NGUOI_NGOAI_DU_AN')
          if (!lamThucHien.ok) expect(lamThucHien.loi.loiTheoO?.nguoiThucHienId).toBe(THONG_BAO_TASK.nguoiNgoaiDuAn)
          const lamKiemTra = await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { nguoiKiemTraId: idNgoai }), LUC_TAO_TASK)
          expect(maLoi(lamKiemTra)).toBe('NGUOI_NGOAI_DU_AN')
          if (!lamKiemTra.ok) expect(lamKiemTra.loi.loiTheoO?.nguoiKiemTraId).toBe(THONG_BAO_TASK.nguoiNgoaiDuAn)
        }
        expect(await idCacTask(bc.pm, bc.duAnId)).toEqual([])
      })

      it('cùng một người ở cả hai vai trả TRUNG_NGUOI và không tạo gì', async () => {
        const bc = await dungBoiCanh()
        const kq = await kho.taoTask(
          bc.pm,
          bc.duAnId,
          giao(bc, { nguoiThucHienId: bc.an.nguoiDungId, nguoiKiemTraId: ` ${bc.an.nguoiDungId} ` }),
          LUC_TAO_TASK,
        )
        expect(maLoi(kq)).toBe('TRUNG_NGUOI')
        if (!kq.ok) expect(kq.loi.loiTheoO?.nguoiKiemTraId).toBe(THONG_BAO_TASK.trungNguoi)
        expect(await idCacTask(bc.pm, bc.duAnId)).toEqual([])
      })

      it('Support của Dự án tạo được Task; PM và Support ở trong Dự án cũng nhận được việc', async () => {
        const bc = await dungBoiCanh()
        const support = await taoNguoiCoVai(bc.pm, 'support-tk', 'SUPPORT', 'Sơn Support')
        await them(bc.pm, bc.duAnId, support)
        await them(bc.pm, bc.duAnId, bc.pm)
        const task = giaTri(
          await kho.taoTask(
            support,
            bc.duAnId,
            giao(bc, { nguoiThucHienId: support.nguoiDungId, nguoiKiemTraId: bc.pm.nguoiDungId }),
            LUC_TAO_TASK,
          ),
        )
        expect(task.nguoiThucHien).toEqual({ id: support.nguoiDungId, tenHienThi: 'Sơn Support' })
        expect(task.nguoiKiemTra).toEqual({ id: bc.pm.nguoiDungId, tenHienThi: 'An PM' })
        expect(task.dauVet.taoBoi).toEqual({ id: support.nguoiDungId, tenHienThi: 'Sơn Support' })
        expect(task.trangThai).toBe('MOI')
        expect(task.soLanTraLai).toBe(0)
      })

      it('PM tạo được Task ở Dự án mình không ở trong và do PM khác tạo', async () => {
        const bc = await dungBoiCanh()
        const pmKhac = await taoNguoiCoVai(bc.pm, 'pm-khac-tk', 'PM')
        expect(maLoi(await kho.taoTask(pmKhac, bc.duAnId, giao(bc), LUC_TAO_TASK))).toBe('THANH_CONG')
      })

      it.each([
        { ca: 'Thành viên ở trong Dự án, kể cả khi sẽ là Người thực hiện', vai: 'THANH_VIEN' as const, trong: true },
        { ca: 'Thành viên không ở trong Dự án', vai: 'THANH_VIEN' as const, trong: false },
        { ca: 'Support không ở trong Dự án', vai: 'SUPPORT' as const, trong: false },
      ])('$ca: tạo Task trả KHONG_CO_QUYEN và không tạo gì', async ({ vai, trong }) => {
        const bc = await dungBoiCanh()
        const nguoiGoi = await taoNguoiCoVai(bc.pm, 'nguoi-goi-tk', vai)
        if (trong) await them(bc.pm, bc.duAnId, nguoiGoi)
        const cacDauVao = [
          giao(bc, { nguoiThucHienId: trong ? nguoiGoi.nguoiDungId : bc.an.nguoiDungId }),
          giao(bc),
          // Dữ liệu sai cũng chỉ là không có quyền: không lộ gì thêm.
          { tieuDe: '' },
          giao(bc, { nguoiKiemTraId: bc.an.nguoiDungId }),
        ]
        for (const dauVao of cacDauVao) {
          expect(maLoi(await kho.taoTask(nguoiGoi, bc.duAnId, dauVao as never, LUC_TAO_TASK))).toBe('KHONG_CO_QUYEN')
        }
        // Dự án không tồn tại cũng vậy.
        expect(maLoi(await kho.taoTask(nguoiGoi, 'khong-ton-tai', giao(bc), LUC_TAO_TASK))).toBe('KHONG_CO_QUYEN')
        expect(await idCacTask(bc.pm, bc.duAnId)).toEqual([])
      })

      it('PM tạo Task ở Dự án không tồn tại trả KHONG_TIM_THAY', async () => {
        const bc = await dungBoiCanh()
        expect(maLoi(await kho.taoTask(bc.pm, 'khong-ton-tai', giao(bc), LUC_TAO_TASK))).toBe('KHONG_TIM_THAY')
      })

      it('Dự án đã Lưu trữ: tạo Task trả DU_AN_DA_LUU_TRU (kể cả dữ liệu sai) và không tạo gì, Task cũ vẫn xem được', async () => {
        const bc = await dungBoiCanh()
        const support = await taoNguoiCoVai(bc.pm, 'support-lt-tk', 'SUPPORT')
        await them(bc.pm, bc.duAnId, support)
        const cu = giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc), LUC_TAO_TASK))
        giaTri(await kho.luuTruDuAn(bc.pm, bc.duAnId, LUC_TAO_TASK))

        for (const phien of [bc.pm, support]) {
          const kq = await kho.taoTask(phien, bc.duAnId, giao(bc, { tieuDe: 'Mới' }), LUC_TAO_TASK)
          expect(maLoi(kq)).toBe('DU_AN_DA_LUU_TRU')
          if (!kq.ok) expect(kq.loi.thongBao).toBe(THONG_BAO_DU_AN.daLuuTru)
          expect(maLoi(await kho.taoTask(phien, bc.duAnId, { tieuDe: '' }, LUC_TAO_TASK))).toBe('DU_AN_DA_LUU_TRU')
        }
        expect(await idCacTask(bc.pm, bc.duAnId)).toEqual([cu.id])
        expect(giaTri(await kho.layTask(bc.an, cu.id))).toEqual(cu)
      })

      it('mọi người trong dự án xem được danh sách và chi tiết Task kèm dấu vết, kể cả Task không giao cho mình', async () => {
        const bc = await dungBoiCanh()
        const chi = await dangKyVaDangNhap('chi-tk', 'Chi')
        const support = await taoNguoiCoVai(bc.pm, 'support-xem-tk', 'SUPPORT')
        await them(bc.pm, bc.duAnId, chi)
        await them(bc.pm, bc.duAnId, support)
        const mot = giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { tieuDe: 'Một' }), LUC_TAO_TASK))
        const hai = giaTri(
          await kho.taoTask(support, bc.duAnId, giao(bc, { tieuDe: 'Hai', han: '2026-06-01' }), sau(LUC_TAO_TASK, 1000)),
        )

        for (const phien of [bc.pm, bc.an, bc.binh, chi, support]) {
          const danhSach = giaTri(await kho.danhSachTask(phien, bc.duAnId))
          expect(danhSach).toHaveLength(2)
          expect(danhSach).toEqual(expect.arrayContaining([mot, hai]))
          expect(giaTri(await kho.layTask(phien, mot.id))).toEqual(mot)
          expect(giaTri(await kho.layTask(phien, hai.id)).dauVet).toEqual({
            taoBoi: { id: support.nguoiDungId, tenHienThi: 'support-xem-tk' },
            taoLuc: luc(sau(LUC_TAO_TASK, 1000)),
            suaBoi: null,
            suaLuc: null,
          })
        }
      })

      it('Dự án chưa có Task nào thì danh sách rỗng', async () => {
        const bc = await dungBoiCanh()
        expect(giaTri(await kho.danhSachTask(bc.an, bc.duAnId))).toEqual([])
      })

      it('người ngoài Dự án nhận không tìm thấy, giống hệt Task hay Dự án không tồn tại', async () => {
        const bc = await dungBoiCanh()
        const task = giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc), LUC_TAO_TASK))
        const tvNgoai = await dangKyVaDangNhap('tv-ngoai-tk')
        const supportNgoai = await taoNguoiCoVai(bc.pm, 'support-ngoai-tk', 'SUPPORT')

        const khongCoTask = await kho.layTask(tvNgoai, 'khong-ton-tai')
        const khongCoDuAn = await kho.danhSachTask(tvNgoai, 'khong-ton-tai')
        expect(maLoi(khongCoTask)).toBe('KHONG_TIM_THAY')
        expect(maLoi(khongCoDuAn)).toBe('KHONG_TIM_THAY')
        for (const phien of [tvNgoai, supportNgoai]) {
          expect(await kho.layTask(phien, task.id)).toEqual(khongCoTask)
          expect(await kho.danhSachTask(phien, bc.duAnId)).toEqual(khongCoDuAn)
        }
        // Người trong dự án mở Task không tồn tại cũng nhận không tìm thấy.
        expect(maLoi(await kho.layTask(bc.an, 'khong-ton-tai'))).toBe('KHONG_TIM_THAY')
      })

      it('người bị gỡ khỏi Dự án không còn thấy Task của Dự án đó', async () => {
        const bc = await dungBoiCanh()
        const chi = await dangKyVaDangNhap('chi-go-tk')
        await them(bc.pm, bc.duAnId, chi)
        const task = giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc), LUC_TAO_TASK))
        expect(maLoi(await kho.layTask(chi, task.id))).toBe('THANH_CONG')
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, chi.nguoiDungId))
        expect(maLoi(await kho.layTask(chi, task.id))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.danhSachTask(chi, bc.duAnId))).toBe('KHONG_TIM_THAY')
      })

      it('Task của Dự án này không xuất hiện trong Dự án khác', async () => {
        const bc = await dungBoiCanh()
        const duAnKhac = giaTri(await kho.taoDuAn(bc.pm, { ten: 'Dự án khác' }, LUC_TAO_DU_AN))
        await them(bc.pm, duAnKhac.id, bc.an)
        await them(bc.pm, duAnKhac.id, bc.binh)
        const oDay = giaTri(await kho.taoTask(bc.pm, bc.duAnId, giao(bc, { tieuDe: 'Ở đây' }), LUC_TAO_TASK))
        const oKia = giaTri(await kho.taoTask(bc.pm, duAnKhac.id, giao(bc, { tieuDe: 'Ở kia' }), LUC_TAO_TASK))
        expect(oKia.duAnId).toBe(duAnKhac.id)

        expect(await idCacTask(bc.pm, bc.duAnId)).toEqual([oDay.id])
        expect(await idCacTask(bc.pm, duAnKhac.id)).toEqual([oKia.id])
        expect(await idCacTask(bc.an, duAnKhac.id)).toEqual([oKia.id])

        // Người chỉ ở Dự án khác không thấy Task ở đây.
        const chiOKia = await dangKyVaDangNhap('chi-o-kia-tk')
        await them(bc.pm, duAnKhac.id, chiOKia)
        expect(maLoi(await kho.layTask(chiOKia, oDay.id))).toBe('KHONG_TIM_THAY')
        expect(await idCacTask(chiOKia, duAnKhac.id)).toEqual([oKia.id])
      })
    })

    describe.skipIf(coTask)('Task — bản cài này', () => {
      it.skip('CHƯA KIỂM: bản cài chưa có các lệnh Task (coTask: false)', () => {})
    })
  })
}

/**
 * Chạy bảng ca dùng chung cho quyền (`BANG_CA_QUYEN`) trên một bản cài Kho dữ liệu. Mỗi dòng là
 * một ca độc lập trên một kho mới; ca bị từ chối còn phải không đổi gì.
 */
export function chayBangCaQuyen(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const coTask = tuyChon.coTask ?? true
  const LUC = new Date('2026-05-01T09:00:00+07:00')
  const cacCa = BANG_CA_QUYEN.filter((ca) => coTask || !laHanhDongTask(ca.hanhDong))

  describe(`Bảng ca dùng chung cho quyền — ${tenBanCai}`, () => {
    if (!coTask) {
      it.skip('CHƯA KIỂM: các dòng Task của bảng ca, vì bản cài chưa có các lệnh Task (coTask: false)', () => {})
    }

    it.each([...cacCa])(
      '$vai, trong Dự án: $trongDuAn, Dự án $trangThaiDuAn, $hanhDong → $ketQua',
      async (ca: CaQuyen) => {
        const banCai = await taoBanCai()
        const kho = banCai.kho

        async function dangKyDaXacNhan(ten: string): Promise<string> {
          const email = emailMoi(ten)
          giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
          giaTri(await banCai.xacNhanEmail(email))
          return email
        }

        async function dangNhap(email: string): Promise<Phien> {
          return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
        }

        // Dựng tình huống của dòng, toàn bằng PM chủ.
        const emailPM = await dangKyDaXacNhan('pm-chu')
        await banCai.datVaiPM(emailPM)
        const pmChu = await dangNhap(emailPM)
        const duAn = giaTri(await kho.taoDuAn(pmChu, { ten: 'Dự án của bảng ca', moTa: 'Mô tả' }, LUC))

        const emailNguoiGoi = await dangKyDaXacNhan('nguoi-goi')
        const nguoiGoi = await dangNhap(emailNguoiGoi)
        if (ca.vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pmChu, nguoiGoi.nguoiDungId, { vai: ca.vai }))
        if (ca.trongDuAn) giaTri(await kho.themNguoiVaoDuAn(pmChu, duAn.id, { email: emailNguoiGoi }))

        const emailCu = await dangKyDaXacNhan('nguoi-cu')
        const nguoiCu = await dangNhap(emailCu)
        giaTri(await kho.themNguoiVaoDuAn(pmChu, duAn.id, { email: emailCu }))

        const emailMoiDangKy = await dangKyDaXacNhan('nguoi-moi')
        const nguoiMoi = await dangNhap(emailMoiDangKy)

        // Hành động về Task: thêm người kiểm và tạo sẵn một Task, trước khi Lưu trữ.
        const coTaskSan = laHanhDongTask(ca.hanhDong)
        let taskSanId = ''
        let nguoiKiemId = ''
        if (coTaskSan) {
          const emailKiem = await dangKyDaXacNhan('nguoi-kiem')
          nguoiKiemId = (await dangNhap(emailKiem)).nguoiDungId
          giaTri(await kho.themNguoiVaoDuAn(pmChu, duAn.id, { email: emailKiem }))
          const taskSan = giaTri(
            await kho.taoTask(
              pmChu,
              duAn.id,
              { tieuDe: 'Task có sẵn', nguoiThucHienId: nguoiCu.nguoiDungId, nguoiKiemTraId: nguoiKiemId },
              LUC,
            ),
          )
          taskSanId = taskSan.id
        }

        if (ca.trangThaiDuAn === 'LUU_TRU') giaTri(await kho.luuTruDuAn(pmChu, duAn.id, LUC))

        async function anhChup() {
          return {
            task: coTaskSan
              ? giaTri(await kho.danhSachTask(pmChu, duAn.id))
                  .map((task) => task.id)
                  .sort()
              : [],
            duAn: giaTri(await kho.layDuAn(pmChu, duAn.id)),
            nguoi: giaTri(await kho.danhSachNguoiTrongDuAn(pmChu, duAn.id))
              .map((nguoi) => nguoi.id)
              .sort(),
            nguoiDung: giaTri(await kho.danhSachNguoiDung(pmChu))
              .map(({ id, vai }) => `${id}:${vai}`)
              .sort(),
            soDuAn: giaTri(await kho.danhSachDuAn(pmChu)).length,
          }
        }
        const truoc = await anhChup()

        const coTrong = (danhSach: KetQua<{ id: string }[]>): KetQuaMongDoi => {
          if (!danhSach.ok) return danhSach.loi.ma
          return danhSach.giaTri.some((d) => d.id === duAn.id) ? 'THAY' : 'KHONG_THAY'
        }
        const ketQuaLenh = (kq: KetQua<unknown>): KetQuaMongDoi => (kq.ok ? 'DUOC' : kq.loi.ma)

        let thucTe: KetQuaMongDoi
        switch (ca.hanhDong) {
          case 'XEM_NGUOI_DUNG':
            thucTe = ketQuaLenh(await kho.danhSachNguoiDung(nguoiGoi))
            break
          case 'DOI_VAI':
            thucTe = ketQuaLenh(await kho.doiVai(nguoiGoi, nguoiMoi.nguoiDungId, { vai: 'SUPPORT' }))
            break
          case 'TAO_DU_AN':
            thucTe = ketQuaLenh(await kho.taoDuAn(nguoiGoi, { ten: 'Dự án khác' }, LUC))
            break
          case 'DANH_SACH_DU_AN':
            thucTe = coTrong(await kho.danhSachDuAn(nguoiGoi))
            break
          case 'DU_AN_CUA_TOI':
            thucTe = coTrong(await kho.danhSachDuAnCuaToi(nguoiGoi))
            break
          case 'XEM_DU_AN':
            thucTe = ketQuaLenh(await kho.layDuAn(nguoiGoi, duAn.id))
            break
          case 'XEM_DU_AN_KHONG_TON_TAI':
            thucTe = ketQuaLenh(await kho.layDuAn(nguoiGoi, `${duAn.id}-khong-ton-tai`))
            break
          case 'XEM_NGUOI_TRONG_DU_AN':
            thucTe = ketQuaLenh(await kho.danhSachNguoiTrongDuAn(nguoiGoi, duAn.id))
            break
          case 'SUA_DU_AN':
            thucTe = ketQuaLenh(await kho.suaDuAn(nguoiGoi, duAn.id, { ten: 'Tên mới' }, LUC))
            break
          case 'LUU_TRU_DU_AN':
            thucTe = ketQuaLenh(await kho.luuTruDuAn(nguoiGoi, duAn.id, LUC))
            break
          case 'MO_LAI_DU_AN':
            thucTe = ketQuaLenh(await kho.moLaiDuAn(nguoiGoi, duAn.id, LUC))
            break
          case 'THEM_NGUOI':
            thucTe = ketQuaLenh(await kho.themNguoiVaoDuAn(nguoiGoi, duAn.id, { email: emailMoiDangKy }))
            break
          case 'GO_NGUOI':
            thucTe = ketQuaLenh(await kho.goNguoiKhoiDuAn(nguoiGoi, duAn.id, nguoiCu.nguoiDungId))
            break
          case 'TAO_TASK':
            thucTe = ketQuaLenh(
              await kho.taoTask(
                nguoiGoi,
                duAn.id,
                { tieuDe: 'Task mới', nguoiThucHienId: nguoiCu.nguoiDungId, nguoiKiemTraId: nguoiKiemId },
                LUC,
              ),
            )
            break
          case 'DANH_SACH_TASK': {
            const danhSach = await kho.danhSachTask(nguoiGoi, duAn.id)
            thucTe = !danhSach.ok
              ? danhSach.loi.ma
              : danhSach.giaTri.some((task) => task.id === taskSanId)
                ? 'THAY'
                : 'KHONG_THAY'
            break
          }
          case 'XEM_TASK':
            thucTe = ketQuaLenh(await kho.layTask(nguoiGoi, taskSanId))
            break
          case 'SUA_TASK':
            thucTe = ketQuaLenh(await kho.suaTask(nguoiGoi, taskSanId, { tieuDe: 'Tiêu đề mới' }, LUC))
            break
          case 'DOI_NGUOI_TASK':
            // Đổi chỗ hai người: cả hai đều ở trong Dự án.
            thucTe = ketQuaLenh(
              await kho.doiNguoiTask(
                nguoiGoi,
                taskSanId,
                { nguoiThucHienId: nguoiKiemId, nguoiKiemTraId: nguoiCu.nguoiDungId },
                LUC,
              ),
            )
            break
          case 'XEM_TASK_NGUOI_DANG_GIU':
            thucTe = ketQuaLenh(await kho.danhSachTaskNguoiDangGiu(nguoiGoi, duAn.id, nguoiCu.nguoiDungId))
            break
          default:
            throw new Error(`Hành động chưa có cách chạy: ${String(ca.hanhDong)}`)
        }
        expect(thucTe).toBe(ca.ketQua)

        // Lệnh bị từ chối không đổi gì; lệnh chỉ đọc (xem, danh sách) cũng vậy.
        if (ca.ketQua !== 'DUOC' || ca.hanhDong.startsWith('XEM_')) {
          expect(await anhChup()).toEqual(truoc)
        }
      },
    )
  })
}
