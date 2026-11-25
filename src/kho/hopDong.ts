// Bộ test hợp đồng của Kho dữ liệu. Mọi bản cài (bộ nhớ, Supabase, ...) gọi
// `chayBoTestHopDong` trong một file `*.test.ts` của mình để chạy lại cùng bộ.
// Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`, không kiểm cách cài bên trong.
// Thư (xác nhận email, mã đặt lại) đi ra ngoài Kho, nên mỗi bản cài đưa kèm cách đọc hộp thư
// và cách thay cho việc bấm đường dẫn xác nhận (`BanCaiHopDong`).
import { beforeEach, describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import type { KhoDuLieu, Phien, ThongBaoChung } from './khoDuLieu'
import { THONG_BAO } from '../luat/taiKhoan'

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
}

export interface TuyChonHopDong {
  /** Sinh email chưa dùng cho mỗi ca (bản cài dùng DB thật cần email khác nhau mỗi lần chạy). */
  emailMoi?: (ten: string) => string
}

const MAT_KHAU = 'matkhau-dung-1'
const MAT_KHAU_MOI = 'matkhau-moi-2'
/** Đồng hồ của các ca đặt lại mật khẩu: truyền vào, không đọc giờ thật. */
const LUC_YEU_CAU = new Date('2026-03-01T08:00:00+07:00')

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

    describe('Dự án của tôi', () => {
      it('người mới đăng ký chưa ở Dự án nào', async () => {
        const phien = await dangKyVaDangNhap('son')
        expect(giaTri(await kho.danhSachDuAnCuaToi(phien))).toEqual([])
      })
    })
  })
}
