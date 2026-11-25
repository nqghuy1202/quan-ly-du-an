// Bản cài bộ nhớ của Kho dữ liệu: dùng cho test và cho giao diện khi chạy thử.
// Không I/O, không đồng hồ, không số ngẫu nhiên: mã sinh theo bộ đếm.
import { thanhCong, thatBai, type KetQua } from './ketQua'
import type { DuAnTomTat, HoSo, KhoDuLieu, Phien } from './khoDuLieu'
import {
  VAI_MAC_DINH,
  chuanHoaEmail,
  dangKySchema,
  dangNhapSchema,
  duocSuaHoSo,
  kiemTra,
  suaHoSoSchema,
  type DangKyDauVao,
  type DangNhapDauVao,
  type SuaHoSoDauVao,
} from '../luat/taiKhoan'

interface TaiKhoan {
  hoSo: HoSo
  matKhau: string
}

export function taoKhoBoNho(): KhoDuLieu {
  const taiKhoanTheoId = new Map<string, TaiKhoan>()
  const idTheoEmail = new Map<string, string>()
  const phienDangMo = new Map<string, string>() // maPhien -> nguoiDungId
  let demNguoiDung = 0
  let demPhien = 0

  const banSao = (hoSo: HoSo): HoSo => ({ ...hoSo })

  function xacThuc(phien: Phien | null): KetQua<TaiKhoan> {
    if (!phien) return thatBai('CHUA_DANG_NHAP')
    const nguoiDungId = phienDangMo.get(phien.maPhien)
    if (!nguoiDungId || nguoiDungId !== phien.nguoiDungId) return thatBai('CHUA_DANG_NHAP')
    const taiKhoan = taiKhoanTheoId.get(nguoiDungId)
    if (!taiKhoan) return thatBai('CHUA_DANG_NHAP')
    return thanhCong(taiKhoan)
  }

  return {
    async dangKy(dauVao: DangKyDauVao) {
      const kt = kiemTra(dangKySchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const { email, matKhau, tenHienThi } = kt.giaTri
      if (idTheoEmail.has(email)) {
        return thatBai('EMAIL_DA_DUNG', undefined, { email: 'Email này đã được dùng để đăng ký.' })
      }
      demNguoiDung += 1
      const hoSo: HoSo = {
        id: `nguoi-dung-${demNguoiDung}`,
        email,
        tenHienThi,
        githubUsername: null,
        vai: VAI_MAC_DINH,
      }
      taiKhoanTheoId.set(hoSo.id, { hoSo, matKhau })
      idTheoEmail.set(email, hoSo.id)
      return thanhCong(banSao(hoSo))
    },

    async dangNhap(dauVao: DangNhapDauVao) {
      const kt = kiemTra(dangNhapSchema, dauVao)
      if (!kt.ok) return thatBai('SAI_THONG_TIN_DANG_NHAP')
      const id = idTheoEmail.get(chuanHoaEmail(kt.giaTri.email))
      const taiKhoan = id ? taiKhoanTheoId.get(id) : undefined
      if (!taiKhoan || taiKhoan.matKhau !== kt.giaTri.matKhau) return thatBai('SAI_THONG_TIN_DANG_NHAP')
      demPhien += 1
      const phien: Phien = { maPhien: `phien-${demPhien}`, nguoiDungId: taiKhoan.hoSo.id }
      phienDangMo.set(phien.maPhien, phien.nguoiDungId)
      return thanhCong(phien)
    },

    async dangXuat(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      phienDangMo.delete((phien as Phien).maPhien)
      return thanhCong(null)
    },

    async layHoSoCuaToi(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      return thanhCong(banSao(xt.giaTri.hoSo))
    },

    async suaHoSo(phien: Phien | null, nguoiDungId: string, dauVao: SuaHoSoDauVao) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocSuaHoSo(xt.giaTri.hoSo.id, nguoiDungId)) return thatBai('KHONG_CO_QUYEN')
      const kt = kiemTra(suaHoSoSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const hoSo = xt.giaTri.hoSo
      if (kt.giaTri.tenHienThi !== undefined) hoSo.tenHienThi = kt.giaTri.tenHienThi
      if (kt.giaTri.githubUsername !== undefined) hoSo.githubUsername = kt.giaTri.githubUsername
      return thanhCong(banSao(hoSo))
    },

    async danhSachDuAnCuaToi(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      // Dự án có từ ticket 04; tới lúc đó chưa ai ở Dự án nào.
      const duAn: DuAnTomTat[] = []
      return thanhCong(duAn)
    },
  }
}
