// Bộ test hợp đồng cho Thông tin nhân sự trong hồ sơ (ticket truong-moi 05): Số điện thoại, Chức danh, Phòng ban;
// tự sửa của mình (chuẩn hoá, xoá, giữ nguyên ô không gửi), dữ liệu sai bị từ chối, không ai sửa hộ (kể cả PM),
// và quyền xem qua các lệnh đọc đưa người khác ra. Ma trận quyền xem theo vai: bảng ca quyền
// (`XEM_THONG_TIN_NHAN_SU`). Tách khỏi `hopDong.ts` cho gọn; mọi bản cài gọi `chayHopDongThongTinNhanSu` trong file
// `*.test.ts` của mình, với cùng `BanCaiHopDong`. Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import type { KhoDuLieu, NguoiDungTomTat, Phien } from './khoDuLieu'
import { THONG_BAO } from '../luat/taiKhoan'
import { THONG_BAO_NHAN_SU, THONG_TIN_NHAN_SU_TRONG, type ThongTinNhanSu } from '../luat/thongTinNhanSu'

const MAT_KHAU = 'matkhau-dung-1'
/** Đồng hồ truyền vào, không đọc giờ thật. */
const LUC = new Date('2026-04-10T09:30:00+07:00')

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

function nhanSu({ soDienThoai, chucDanh, phongBan }: ThongTinNhanSu): ThongTinNhanSu {
  return { soDienThoai, chucDanh, phongBan }
}

export function chayHopDongThongTinNhanSu(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn('NS')

  describe(`Thông tin nhân sự trong hồ sơ (hợp đồng) — ${tenBanCai}`, () => {
    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    async function khoiTao() {
      banCai = await taoBanCai()
      kho = banCai.kho
    }

    async function dangKyVaDangNhap(ten: string, tenHienThi = ten): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
      giaTri(await banCai.xacNhanEmail(email))
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    async function taoPM(ten: string): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
      giaTri(await banCai.xacNhanEmail(email))
      await banCai.datVaiPM(email)
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    function tim(danhSach: NguoiDungTomTat[], phien: Phien): NguoiDungTomTat | undefined {
      return danhSach.find((nguoi) => nguoi.id === phien.nguoiDungId)
    }

    describe('tự sửa của mình', () => {
      it('tài khoản mới chưa có Thông tin nhân sự: ba trường trống', async () => {
        await khoiTao()
        const an = await dangKyVaDangNhap('ns-moi')
        expect(nhanSu(giaTri(await kho.layHoSoCuaToi(an)))).toEqual(THONG_TIN_NHAN_SU_TRONG)
      })

      it.each([
        ['0901 234 567', '0901234567'],
        ['0901.234.567', '0901234567'],
        ['0901-234-567', '0901234567'],
        ['+84901234567', '+84901234567'],
        ['+84 901 234 567', '+84901234567'],
      ])('nhập Số điện thoại "%s" thì lưu dạng chuẩn hoá "%s"; đọc lại thấy đúng', async (nhap, luu) => {
        await khoiTao()
        const an = await dangKyVaDangNhap('ns-sdt')
        const sua = giaTri(await kho.suaHoSo(an, an.nguoiDungId, { soDienThoai: nhap }))
        expect(sua.soDienThoai).toBe(luu)
        expect(giaTri(await kho.layHoSoCuaToi(an))).toEqual(sua)
      })

      it('sửa cả ba trường (cắt khoảng trắng hai đầu); tên, GitHub username, email, vai giữ nguyên', async () => {
        await khoiTao()
        const an = await dangKyVaDangNhap('ns-ba-truong', 'An')
        giaTri(await kho.suaHoSo(an, an.nguoiDungId, { githubUsername: 'an-gh' }))
        const truoc = giaTri(await kho.layHoSoCuaToi(an))
        const sua = giaTri(
          await kho.suaHoSo(an, an.nguoiDungId, {
            soDienThoai: '0912 345 678',
            chucDanh: '  Trưởng nhóm  ',
            phongBan: ' Phòng Kỹ thuật ',
          }),
        )
        expect(sua).toEqual({ ...truoc, soDienThoai: '0912345678', chucDanh: 'Trưởng nhóm', phongBan: 'Phòng Kỹ thuật' })
        expect(giaTri(await kho.layHoSoCuaToi(an))).toEqual(sua)
      })

      it('ô không gửi thì giữ nguyên; gửi trống (hay chỉ khoảng trắng) thì xoá', async () => {
        await khoiTao()
        const an = await dangKyVaDangNhap('ns-xoa')
        const day = { soDienThoai: '0901234567', chucDanh: 'Kế toán', phongBan: 'Phòng Tài chính' }
        giaTri(await kho.suaHoSo(an, an.nguoiDungId, day))
        // Sửa tên không đụng Thông tin nhân sự.
        expect(nhanSu(giaTri(await kho.suaHoSo(an, an.nguoiDungId, { tenHienThi: 'An mới' })))).toEqual(day)
        // Sửa một ô, hai ô kia giữ nguyên.
        expect(nhanSu(giaTri(await kho.suaHoSo(an, an.nguoiDungId, { chucDanh: 'Kế toán trưởng' })))).toEqual({
          ...day,
          chucDanh: 'Kế toán trưởng',
        })
        const xoa = giaTri(await kho.suaHoSo(an, an.nguoiDungId, { soDienThoai: ' ', chucDanh: '', phongBan: '   ' }))
        expect(nhanSu(xoa)).toEqual(THONG_TIN_NHAN_SU_TRONG)
        expect(nhanSu(giaTri(await kho.layHoSoCuaToi(an)))).toEqual(THONG_TIN_NHAN_SU_TRONG)
      })

      it.each(['090123456', '09012345678', '0901 234 56a', 'abcdefghij', '+8490123456', '+849012345678', '84901234567', '1901234567'])(
        'Số điện thoại sai dạng "%s": KHONG_HOP_LE kèm lỗi tiếng Việt ở ô Số điện thoại; không đổi gì',
        async (sai) => {
          await khoiTao()
          const an = await dangKyVaDangNhap('ns-sdt-sai')
          giaTri(await kho.suaHoSo(an, an.nguoiDungId, { soDienThoai: '0901234567' }))
          const truoc = giaTri(await kho.layHoSoCuaToi(an))
          const kq = await kho.suaHoSo(an, an.nguoiDungId, { soDienThoai: sai, chucDanh: 'Không lưu', tenHienThi: 'Không lưu' })
          expect(maLoi(kq)).toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.loiTheoO?.soDienThoai).toBe(THONG_BAO_NHAN_SU.soDienThoaiSai)
          expect(giaTri(await kho.layHoSoCuaToi(an))).toEqual(truoc)
        },
      )

      it('Chức danh hoặc Phòng ban dài hơn 60 ký tự: KHONG_HOP_LE kèm lỗi ở đúng ô; đúng 60 ký tự thì lưu được', async () => {
        await khoiTao()
        const an = await dangKyVaDangNhap('ns-dai')
        const truoc = giaTri(await kho.layHoSoCuaToi(an))

        const chucDanhDai = await kho.suaHoSo(an, an.nguoiDungId, { chucDanh: 'C'.repeat(61), soDienThoai: '0901234567' })
        expect(maLoi(chucDanhDai)).toBe('KHONG_HOP_LE')
        if (!chucDanhDai.ok) expect(chucDanhDai.loi.loiTheoO).toEqual({ chucDanh: THONG_BAO_NHAN_SU.chucDanhQuaDai })

        const phongBanDai = await kho.suaHoSo(an, an.nguoiDungId, { phongBan: 'P'.repeat(61) })
        expect(maLoi(phongBanDai)).toBe('KHONG_HOP_LE')
        if (!phongBanDai.ok) expect(phongBanDai.loi.loiTheoO).toEqual({ phongBan: THONG_BAO_NHAN_SU.phongBanQuaDai })
        expect(giaTri(await kho.layHoSoCuaToi(an))).toEqual(truoc)

        const vuaDu = giaTri(await kho.suaHoSo(an, an.nguoiDungId, { chucDanh: 'C'.repeat(60), phongBan: 'P'.repeat(60) }))
        expect(vuaDu.chucDanh).toBe('C'.repeat(60))
        expect(vuaDu.phongBan).toBe('P'.repeat(60))
      })

      it('nhiều ô sai cùng lúc: lỗi ở từng ô, cùng với lỗi các ô cũ', async () => {
        await khoiTao()
        const an = await dangKyVaDangNhap('ns-nhieu-loi')
        const kq = await kho.suaHoSo(an, an.nguoiDungId, {
          tenHienThi: ' ',
          soDienThoai: '123',
          chucDanh: 'C'.repeat(61),
          phongBan: 'P'.repeat(61),
        })
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) {
          expect(kq.loi.loiTheoO).toEqual({
            tenHienThi: THONG_BAO.tenTrong,
            soDienThoai: THONG_BAO_NHAN_SU.soDienThoaiSai,
            chucDanh: THONG_BAO_NHAN_SU.chucDanhQuaDai,
            phongBan: THONG_BAO_NHAN_SU.phongBanQuaDai,
          })
        }
      })
    })

    describe('không ai sửa hộ', () => {
      it.each(['PM', 'SUPPORT', 'THANH_VIEN'] as const)(
        '%s sửa Thông tin nhân sự của người khác (cùng Dự án): KHONG_CO_QUYEN; không đổi gì',
        async (vai) => {
          await khoiTao()
          const pm = await taoPM('ns-pm-chu')
          const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Dự án chung' }, LUC))
          const chu = await dangKyVaDangNhap('ns-chu')
          giaTri(await kho.suaHoSo(chu, chu.nguoiDungId, { soDienThoai: '0901234567', chucDanh: 'Kỹ sư', phongBan: 'Kỹ thuật' }))
          giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('ns-chu') }))

          let nguoiSua = pm
          if (vai !== 'PM') {
            nguoiSua = await dangKyVaDangNhap('ns-nguoi-sua')
            if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, nguoiSua.nguoiDungId, { vai }))
            giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('ns-nguoi-sua') }))
          }
          const truoc = giaTri(await kho.layHoSoCuaToi(chu))

          const kq = await kho.suaHoSo(nguoiSua, chu.nguoiDungId, { soDienThoai: '0999999999', chucDanh: 'Bị sửa', phongBan: '' })
          expect(maLoi(kq)).toBe('KHONG_CO_QUYEN')
          expect(giaTri(await kho.layHoSoCuaToi(chu))).toEqual(truoc)
        },
      )
    })

    describe('quyền xem', () => {
      const CUA_BINH = { soDienThoai: '+84912345678', chucDanh: 'Lập trình viên', phongBan: 'Phòng Phần mềm' }

      async function dungBoiCanh() {
        await khoiTao()
        const pm = await taoPM('ns-pm-xem')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Dự án xem' }, LUC))
        const binh = await dangKyVaDangNhap('ns-binh', 'Bình')
        giaTri(await kho.suaHoSo(binh, binh.nguoiDungId, CUA_BINH))
        return { pm, duAn, binh }
      }

      it('chính chủ thấy ba trường của mình ở hồ sơ và trong danh sách Người trong dự án', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('ns-binh') }))
        expect(nhanSu(giaTri(await kho.layHoSoCuaToi(binh)))).toEqual(CUA_BINH)
        expect(nhanSu(tim(giaTri(await kho.danhSachNguoiTrongDuAn(binh, duAn.id)), binh)!)).toEqual(CUA_BINH)
      })

      it('PM thấy ba trường của mọi tài khoản ở danh sách Người dùng (kể cả người chưa ở Dự án nào) và ở kết quả đổi vai', async () => {
        const { pm, binh } = await dungBoiCanh()
        expect(tim(giaTri(await kho.danhSachNguoiDung(pm)), binh)).toEqual({
          id: binh.nguoiDungId,
          email: emailMoi('ns-binh'),
          tenHienThi: 'Bình',
          vai: 'THANH_VIEN',
          ...CUA_BINH,
        })
        expect(nhanSu(giaTri(await kho.doiVai(pm, binh.nguoiDungId, { vai: 'SUPPORT' })))).toEqual(CUA_BINH)
      })

      it('thêm người vào Dự án: kết quả và danh sách Người trong dự án có ba trường của người đó', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        const them = giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('ns-binh') }))
        expect(nhanSu(them)).toEqual(CUA_BINH)
        expect(nhanSu(tim(giaTri(await kho.danhSachNguoiTrongDuAn(pm, duAn.id)), binh)!)).toEqual(CUA_BINH)
      })

      it('Thành viên cùng Dự án thấy ba trường của nhau, kể cả khi Dự án đã Lưu trữ; sửa xong thì lần đọc sau thấy giá trị mới', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        const chi = await dangKyVaDangNhap('ns-chi', 'Chi')
        for (const ten of ['ns-binh', 'ns-chi']) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi(ten) }))

        expect(tim(giaTri(await kho.danhSachNguoiTrongDuAn(chi, duAn.id)), binh)).toEqual({
          id: binh.nguoiDungId,
          email: emailMoi('ns-binh'),
          tenHienThi: 'Bình',
          vai: 'THANH_VIEN',
          ...CUA_BINH,
          vaiTroTrongDuAn: null,
          soTaskDangGiu: 0,
        })
        giaTri(await kho.suaHoSo(binh, binh.nguoiDungId, { chucDanh: 'Trưởng nhóm' }))
        giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC))
        expect(nhanSu(tim(giaTri(await kho.danhSachNguoiTrongDuAn(chi, duAn.id)), binh)!)).toEqual({
          ...CUA_BINH,
          chucDanh: 'Trưởng nhóm',
        })
      })

      it('Thành viên không cùng Dự án nào với người kia: không lệnh đọc nào đưa ra ba trường của người đó', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('ns-binh') }))
        // Dung ở một Dự án khác, không cùng Dự án nào với Bình.
        const dung = await dangKyVaDangNhap('ns-dung', 'Dũng')
        const duAnKhac = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Dự án khác' }, LUC))
        giaTri(await kho.themNguoiVaoDuAn(pm, duAnKhac.id, { email: emailMoi('ns-dung') }))

        expect(maLoi(await kho.danhSachNguoiDung(dung))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.danhSachNguoiTrongDuAn(dung, duAn.id))).toBe('KHONG_TIM_THAY')
        const thay = giaTri(await kho.danhSachNguoiTrongDuAn(dung, duAnKhac.id))
        expect(tim(thay, binh)).toBeUndefined()
        expect(thay.some((nguoi) => nguoi.soDienThoai === CUA_BINH.soDienThoai)).toBe(false)
      })
    })
  })
}
