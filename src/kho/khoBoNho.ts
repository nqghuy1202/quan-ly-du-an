// Bản cài bộ nhớ của Kho dữ liệu: dùng cho test và cho giao diện khi chạy thử.
// Không I/O, không đồng hồ, không số ngẫu nhiên: mã sinh theo bộ đếm, giờ do người gọi truyền vào.
// Không gửi thư thật: thư được ghi vào một hộp thư mô phỏng (`moPhong`), và việc bấm đường dẫn
// trong thư xác nhận được thay bằng `moPhong.xacNhanEmail`.
import { thanhCong, thatBai, type KetQua } from './ketQua'
import type { DuAnTomTat, HoSo, KhoDuLieu, Phien, ThongBaoChung } from './khoDuLieu'
import {
  THOI_HAN_MA_DAT_LAI_MAC_DINH_MS,
  THONG_BAO,
  VAI_MAC_DINH,
  chuanHoaEmail,
  dangKySchema,
  dangNhapSchema,
  datLaiMatKhauSchema,
  duocSuaHoSo,
  emailSchema,
  hetHanLuc,
  kiemTra,
  suaHoSoSchema,
  tinhTrangMaDatLai,
  type DangKyDauVao,
  type DangNhapDauVao,
  type DatLaiMatKhauDauVao,
  type EmailDauVao,
  type SuaHoSoDauVao,
} from '../luat/taiKhoan'

/** Một thư bản bộ nhớ "đã gửi" (thay cho thư thật). */
export type ThuMoPhong =
  | { loai: 'XAC_NHAN_EMAIL'; email: string }
  | { loai: 'DAT_LAI_MAT_KHAU'; email: string; ma: string; hetHanLuc: Date }

/** Bước mô phỏng thay cho hộp thư thật của bản cài bộ nhớ. */
export interface MoPhongThu {
  /**
   * Thay cho việc bấm đường dẫn trong thư xác nhận gửi tới `email`. Luôn trả cùng một thông báo:
   * xác nhận lần hai hay email không tồn tại không lộ gì và không đổi gì.
   */
  xacNhanEmail(email: string): Promise<KetQua<ThongBaoChung>>
  /** Các thư đã gửi tới `email`, cũ trước mới sau. */
  thuGuiToi(email: string): ThuMoPhong[]
}

export interface KhoBoNho extends KhoDuLieu {
  moPhong: MoPhongThu
}

export interface TuyChonKhoBoNho {
  /** Thời hạn của mã đặt lại mật khẩu, tính bằng mili giây. Mặc định 1 giờ. */
  thoiHanMaDatLaiMs?: number
}

interface MaDatLai {
  ma: string
  hetHanLuc: Date
  daDung: boolean
}

interface TaiKhoan {
  hoSo: HoSo
  matKhau: string
  daXacNhan: boolean
  /** Mã đặt lại mới nhất; yêu cầu mới thay mã cũ. */
  maDatLai: MaDatLai | null
}

export function taoKhoBoNho(tuyChon: TuyChonKhoBoNho = {}): KhoBoNho {
  const thoiHanMaDatLaiMs = tuyChon.thoiHanMaDatLaiMs ?? THOI_HAN_MA_DAT_LAI_MAC_DINH_MS
  const taiKhoanTheoId = new Map<string, TaiKhoan>()
  const idTheoEmail = new Map<string, string>()
  const phienDangMo = new Map<string, string>() // maPhien -> nguoiDungId
  const hopThu: ThuMoPhong[] = []
  let demNguoiDung = 0
  let demPhien = 0
  let demMa = 0

  const banSao = (hoSo: HoSo): HoSo => ({ ...hoSo })

  function timTheoEmail(email: string): TaiKhoan | undefined {
    const id = idTheoEmail.get(chuanHoaEmail(email))
    return id ? taiKhoanTheoId.get(id) : undefined
  }

  function xacThuc(phien: Phien | null): KetQua<TaiKhoan> {
    if (!phien) return thatBai('CHUA_DANG_NHAP')
    const nguoiDungId = phienDangMo.get(phien.maPhien)
    if (!nguoiDungId || nguoiDungId !== phien.nguoiDungId) return thatBai('CHUA_DANG_NHAP')
    const taiKhoan = taiKhoanTheoId.get(nguoiDungId)
    if (!taiKhoan) return thatBai('CHUA_DANG_NHAP')
    return thanhCong(taiKhoan)
  }

  const moPhong: MoPhongThu = {
    async xacNhanEmail(email: string) {
      const taiKhoan = timTheoEmail(email)
      if (taiKhoan) taiKhoan.daXacNhan = true
      return thanhCong({ thongBao: THONG_BAO.daXacNhanEmail })
    },

    thuGuiToi(email: string) {
      const chuan = chuanHoaEmail(email)
      return hopThu.filter((thu) => thu.email === chuan).map((thu) => ({ ...thu }))
    },
  }

  return {
    moPhong,

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
      taiKhoanTheoId.set(hoSo.id, { hoSo, matKhau, daXacNhan: false, maDatLai: null })
      idTheoEmail.set(email, hoSo.id)
      hopThu.push({ loai: 'XAC_NHAN_EMAIL', email })
      return thanhCong(banSao(hoSo))
    },

    async dangNhap(dauVao: DangNhapDauVao) {
      const kt = kiemTra(dangNhapSchema, dauVao)
      if (!kt.ok) return thatBai('SAI_THONG_TIN_DANG_NHAP')
      const taiKhoan = timTheoEmail(kt.giaTri.email)
      if (!taiKhoan || taiKhoan.matKhau !== kt.giaTri.matKhau) return thatBai('SAI_THONG_TIN_DANG_NHAP')
      // Chỉ báo chưa xác nhận khi đã đúng mật khẩu, nên không lộ gì với người không biết mật khẩu.
      if (!taiKhoan.daXacNhan) return thatBai('EMAIL_CHUA_XAC_NHAN')
      demPhien += 1
      const phien: Phien = { maPhien: `phien-${demPhien}`, nguoiDungId: taiKhoan.hoSo.id }
      phienDangMo.set(phien.maPhien, phien.nguoiDungId)
      return thanhCong(phien)
    },

    async guiLaiThuXacNhan(dauVao: EmailDauVao) {
      const kt = kiemTra(emailSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const taiKhoan = timTheoEmail(kt.giaTri.email)
      if (taiKhoan && !taiKhoan.daXacNhan) hopThu.push({ loai: 'XAC_NHAN_EMAIL', email: taiKhoan.hoSo.email })
      return thanhCong({ thongBao: THONG_BAO.daGuiLaiThuXacNhan })
    },

    async yeuCauDatLaiMatKhau(dauVao: EmailDauVao, bayGio: Date) {
      const kt = kiemTra(emailSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const taiKhoan = timTheoEmail(kt.giaTri.email)
      if (taiKhoan) {
        demMa += 1
        const maDatLai: MaDatLai = {
          ma: String(demMa).padStart(6, '0'),
          hetHanLuc: hetHanLuc(bayGio, thoiHanMaDatLaiMs),
          daDung: false,
        }
        taiKhoan.maDatLai = maDatLai
        hopThu.push({
          loai: 'DAT_LAI_MAT_KHAU',
          email: taiKhoan.hoSo.email,
          ma: maDatLai.ma,
          hetHanLuc: new Date(maDatLai.hetHanLuc.getTime()),
        })
      }
      return thanhCong({ thongBao: THONG_BAO.daGuiMaDatLai })
    },

    async datLaiMatKhau(dauVao: DatLaiMatKhauDauVao, bayGio: Date) {
      const kt = kiemTra(datLaiMatKhauSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const taiKhoan = timTheoEmail(kt.giaTri.email)
      const maDatLai = taiKhoan?.maDatLai
      if (!taiKhoan || !maDatLai || maDatLai.ma !== kt.giaTri.ma) return thatBai('MA_KHONG_HOP_LE')
      const tinhTrang = tinhTrangMaDatLai(maDatLai, bayGio)
      if (tinhTrang === 'DA_DUNG') return thatBai('MA_DA_DUNG')
      if (tinhTrang === 'HET_HAN') return thatBai('MA_HET_HAN')
      maDatLai.daDung = true
      taiKhoan.matKhau = kt.giaTri.matKhauMoi
      taiKhoan.daXacNhan = true
      return thanhCong({ thongBao: THONG_BAO.daDatLaiMatKhau })
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
