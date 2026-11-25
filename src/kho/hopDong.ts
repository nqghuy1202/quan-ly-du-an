// Bộ test hợp đồng của Kho dữ liệu. Mọi bản cài (bộ nhớ, Supabase, ...) gọi
// `chayBoTestHopDong` trong một file `*.test.ts` của mình để chạy lại cùng bộ.
// Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`, không kiểm cách cài bên trong.
import { beforeEach, describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import type { KhoDuLieu, Phien } from './khoDuLieu'
import { THONG_BAO } from '../luat/taiKhoan'

export interface TuyChonHopDong {
  /** Sinh email chưa dùng cho mỗi ca (bản cài dùng DB thật cần email khác nhau mỗi lần chạy). */
  emailMoi?: (ten: string) => string
}

const MAT_KHAU = 'matkhau-dung-1'

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

export function chayBoTestHopDong(
  tenBanCai: string,
  taoKho: () => KhoDuLieu | Promise<KhoDuLieu>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)

  describe(`Kho dữ liệu (hợp đồng) — ${tenBanCai}`, () => {
    let kho: KhoDuLieu

    beforeEach(async () => {
      kho = await taoKho()
    })

    async function dangKyVaDangNhap(ten: string, tenHienThi = ten): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    describe('đăng ký', () => {
      it('email hợp lệ, mật khẩu đủ 8 ký tự và tên không rỗng thì tạo hồ sơ vai Thành viên', async () => {
        const email = emailMoi('an')
        const hoSo = giaTri(await kho.dangKy({ email, matKhau: '12345678', tenHienThi: '  An Nguyễn  ' }))
        expect(hoSo.email).toBe(email.toLowerCase())
        expect(hoSo.tenHienThi).toBe('An Nguyễn')
        expect(hoSo.vai).toBe('THANH_VIEN')
        expect(hoSo.githubUsername).toBeNull()

        const phien = giaTri(await kho.dangNhap({ email, matKhau: '12345678' }))
        expect(giaTri(await kho.layHoSoCuaToi(phien))).toEqual(hoSo)
      })

      it('email đã dùng (không phân biệt hoa thường) trả EMAIL_DA_DUNG', async () => {
        const email = emailMoi('binh')
        giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Bình' }))
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

    describe('đăng nhập và đăng xuất', () => {
      it('đăng nhập đúng thì có phiên dùng được', async () => {
        const phien = await dangKyVaDangNhap('dung', 'Dũng')
        expect(giaTri(await kho.layHoSoCuaToi(phien)).tenHienThi).toBe('Dũng')
      })

      it('email nhập khác hoa thường vẫn đăng nhập được', async () => {
        const email = emailMoi('giang')
        giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Giang' }))
        expect(maLoi(await kho.dangNhap({ email: email.toUpperCase(), matKhau: MAT_KHAU }))).toBe('THANH_CONG')
      })

      it('sai mật khẩu và email chưa đăng ký trả cùng một lỗi chung', async () => {
        const email = emailMoi('ha')
        giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Hà' }))
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
