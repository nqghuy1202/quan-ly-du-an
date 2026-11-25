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
}

export interface TuyChonHopDong {
  /** Sinh email chưa dùng cho mỗi ca (bản cài dùng DB thật cần email khác nhau mỗi lần chạy). */
  emailMoi?: (ten: string) => string
  /**
   * Mỗi ca bắt đầu với kho chưa có PM nào (mặc định đúng). Kho thật đã có PM của chủ dự án thì
   * đặt `false`: các ca "PM cuối cùng" bị bỏ qua vì không dựng được tình huống đó.
   */
  khoChuaCoPM?: boolean
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
        expect(maLoi(lanHai)).toBe('MA_DA_DUNG')
        expect(maLoi(await kho.dangNhap({ email, matKhau: MAT_KHAU_MOI }))).toBe('THANH_CONG')
        expect(maLoi(await kho.dangNhap({ email, matKhau: 'mat-khau-thu-ba' }))).toBe('SAI_THONG_TIN_DANG_NHAP')
      })

      it('mã hết hạn theo thời hạn cấu hình tính bằng đồng hồ truyền vào: trả MA_HET_HAN', async () => {
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
            taoLuc: LUC_TAO_DU_AN,
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
        '%s chưa thấy và chưa sửa được Dự án nào (quyền theo người trong dự án ở ticket 05)',
        async (vai) => {
          const pm = await taoPM('pm-an-giau')
          const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Bí mật' }, LUC_TAO_DU_AN))
          const nguoiGoi = await taoNguoiCoVai(pm, 'nguoi-ngoai', vai)

          expect(maLoi(await kho.danhSachDuAn(nguoiGoi))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.layDuAn(nguoiGoi, duAn.id))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.suaDuAn(nguoiGoi, duAn.id, { ten: 'Bị sửa' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.luuTruDuAn(nguoiGoi, duAn.id, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.moLaiDuAn(nguoiGoi, duAn.id, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          // Không lộ Dự án có tồn tại hay không.
          expect(maLoi(await kho.layDuAn(nguoiGoi, 'khong-ton-tai'))).toBe('KHONG_CO_QUYEN')

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
            taoLuc: LUC_TAO_DU_AN,
            suaBoi: { id: pmSua.nguoiDungId, tenHienThi: 'Bình PM' },
            suaLuc: LUC_SUA,
          },
        })
        expect(giaTri(await kho.layDuAn(pmTao, duAn.id))).toEqual(suaTen)

        const sauNua = sau(LUC_SUA, 60_000)
        const suaMoTa = giaTri(await kho.suaDuAn(pmTao, duAn.id, { moTa: 'Mô tả mới' }, sauNua))
        expect(suaMoTa.ten).toBe('Tên mới')
        expect(suaMoTa.moTa).toBe('Mô tả mới')
        expect(suaMoTa.dauVet).toEqual({
          taoBoi: { id: pmTao.nguoiDungId, tenHienThi: 'An PM' },
          taoLuc: LUC_TAO_DU_AN,
          suaBoi: { id: pmTao.nguoiDungId, tenHienThi: 'An PM' },
          suaLuc: sauNua,
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
          dauVet: { ...duAn.dauVet, suaBoi: { id: pmKhac.nguoiDungId, tenHienThi: 'Bình PM' }, suaLuc: LUC_LUU_TRU },
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
          suaLuc: LUC_MO_LAI,
        })
        const sauMoLai = sau(LUC_MO_LAI, 60_000)
        const sua = giaTri(await kho.suaDuAn(pmKhac, duAn.id, { ten: 'Làm tiếp' }, sauMoLai))
        expect(sua.ten).toBe('Làm tiếp')
        expect(sua.dauVet.suaLuc).toEqual(sauMoLai)
        expect(sua.dauVet.taoLuc).toEqual(LUC_TAO_DU_AN)
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
  })
}
