import { BANG_CA_QUYEN, CAC_HANH_DONG } from './bangCaQuyen'
import { chayBangCaQuyen, chayBoTestHopDong, type BanCaiHopDong } from './hopDong'
import { chayHopDongRepo } from './hopDongRepo'
import { chayHopDongSuaTask } from './hopDongSuaTask'
import { chayHopDongChuyenTrangThai } from './hopDongChuyenTrangThai'
import { taoKhoBoNho, type ThuMoPhong } from './khoBoNho'
import { CAC_VAI } from '../luat/taiKhoan'

const MUOI_LAM_PHUT = 15 * 60 * 1000

function maDatLaiMoiNhat(thu: ThuMoPhong[]): string | null {
  const datLai = thu.filter((t) => t.loai === 'DAT_LAI_MAT_KHAU')
  const moiNhat = datLai[datLai.length - 1]
  return moiNhat && moiNhat.loai === 'DAT_LAI_MAT_KHAU' ? moiNhat.ma : null
}

function taoBanCai(): BanCaiHopDong {
  const kho = taoKhoBoNho({ thoiHanMaDatLaiMs: MUOI_LAM_PHUT })
  return {
    kho,
    xacNhanEmail: (email: string) => kho.moPhong.xacNhanEmail(email),
    maDatLaiMoiNhat: async (email: string) => maDatLaiMoiNhat(kho.moPhong.thuGuiToi(email)),
    thoiHanMaDatLaiMs: MUOI_LAM_PHUT,
    datVaiPM: async (email: string) => {
      const kq = await kho.chuDuAn.datVaiPM(email)
      if (!kq.ok) throw new Error(kq.loi.thongBao)
    },
    datTrangThaiTask: async (taskId, trangThai) => {
      const kq = await kho.chuDuAn.datTrangThaiTask(taskId, trangThai)
      if (!kq.ok) throw new Error(kq.loi.thongBao)
    },
  }
}

chayBoTestHopDong('bản bộ nhớ', taoBanCai)

chayBangCaQuyen('bản bộ nhớ', taoBanCai)

chayHopDongRepo('bản bộ nhớ', taoBanCai)
chayHopDongSuaTask('bản bộ nhớ', taoBanCai)
chayHopDongChuyenTrangThai('bản bộ nhớ', taoBanCai)

describe('bảng ca dùng chung cho quyền (dữ liệu)', () => {
  it('mọi hành động có đủ dòng cho từng vai, trong và ngoài Dự án, khi Dự án đang hoạt động', () => {
    for (const hanhDong of CAC_HANH_DONG) {
      for (const vai of CAC_VAI) {
        for (const trongDuAn of [true, false]) {
          const dong = BANG_CA_QUYEN.filter(
            (ca) =>
              ca.hanhDong === hanhDong && ca.vai === vai && ca.trongDuAn === trongDuAn && ca.trangThaiDuAn === 'HOAT_DONG',
          )
          expect(dong, `${hanhDong} / ${vai} / trong Dự án: ${trongDuAn}`).toHaveLength(1)
        }
      }
    }
  })

  it('không có hai dòng cho cùng một tình huống', () => {
    const khoa = BANG_CA_QUYEN.map((ca) => `${ca.vai}|${ca.trongDuAn}|${ca.trangThaiDuAn}|${ca.hanhDong}`)
    expect(new Set(khoa).size).toBe(khoa.length)
  })
})

describe('PM ban đầu của bản bộ nhớ (chỉ cho dev và test)', () => {
  const PM = { email: 'PM@Vi-Du.vn', matKhau: 'matkhau-pm-1', tenHienThi: 'Chủ dự án' }

  it('tuỳ chọn pmBanDau tạo sẵn một PM đã xác nhận email, đăng nhập và quản lý người dùng được ngay', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const phien = await kho.dangNhap({ email: 'pm@vi-du.vn', matKhau: PM.matKhau })
    if (!phien.ok) throw new Error(phien.loi.thongBao)
    const hoSo = await kho.layHoSoCuaToi(phien.giaTri)
    expect(hoSo.ok && hoSo.giaTri).toEqual(
      expect.objectContaining({ email: 'pm@vi-du.vn', tenHienThi: 'Chủ dự án', vai: 'PM' }),
    )
    const danhSach = await kho.danhSachNguoiDung(phien.giaTri)
    expect(danhSach.ok && danhSach.giaTri).toHaveLength(1)
    // Tạo sẵn không gửi thư nào.
    expect(kho.moPhong.thuGuiToi('pm@vi-du.vn')).toEqual([])
  })

  it('không có pmBanDau thì kho bắt đầu trống, người đăng ký đầu tiên vẫn chỉ là Thành viên', async () => {
    const kho = taoKhoBoNho()
    await kho.dangKy({ email: 'dau-tien@vi-du.vn', matKhau: '12345678', tenHienThi: 'Đầu tiên' })
    await kho.moPhong.xacNhanEmail('dau-tien@vi-du.vn')
    const phien = await kho.dangNhap({ email: 'dau-tien@vi-du.vn', matKhau: '12345678' })
    if (!phien.ok) throw new Error(phien.loi.thongBao)
    const hoSo = await kho.layHoSoCuaToi(phien.giaTri)
    expect(hoSo.ok && hoSo.giaTri.vai).toBe('THANH_VIEN')
    expect((await kho.danhSachNguoiDung(phien.giaTri)).ok).toBe(false)
  })

  it('email của pmBanDau đã có thì đăng ký lại trả EMAIL_DA_DUNG', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const kq = await kho.dangKy({ email: 'pm@vi-du.vn', matKhau: '12345678', tenHienThi: 'Kẻ giả' })
    expect(kq.ok || kq.loi.ma).toBe('EMAIL_DA_DUNG')
  })

  it('pmBanDau sai dữ liệu thì báo ngay khi dựng Kho', () => {
    expect(() => taoKhoBoNho({ pmBanDau: { ...PM, matKhau: '123' } })).toThrow(/pmBanDau/)
  })

  it('chuDuAn.datVaiPM với email không có tài khoản trả KHONG_TIM_THAY', async () => {
    const kho = taoKhoBoNho()
    const kq = await kho.chuDuAn.datVaiPM('khong-co@vi-du.vn')
    expect(kq.ok || kq.loi.ma).toBe('KHONG_TIM_THAY')
  })
})

describe('hộp thư mô phỏng của bản bộ nhớ', () => {
  const LUC = new Date('2026-03-01T08:00:00+07:00')

  it('đăng ký gửi một thư xác nhận; gửi lại chỉ gửi khi tài khoản có thật và chưa xác nhận', async () => {
    const kho = taoKhoBoNho()
    await kho.dangKy({ email: 'An@Vi-Du.vn', matKhau: '12345678', tenHienThi: 'An' })
    expect(kho.moPhong.thuGuiToi('an@vi-du.vn')).toEqual([{ loai: 'XAC_NHAN_EMAIL', email: 'an@vi-du.vn' }])

    await kho.guiLaiThuXacNhan({ email: 'an@vi-du.vn' })
    expect(kho.moPhong.thuGuiToi('an@vi-du.vn')).toHaveLength(2)

    await kho.moPhong.xacNhanEmail('an@vi-du.vn')
    await kho.guiLaiThuXacNhan({ email: 'an@vi-du.vn' })
    expect(kho.moPhong.thuGuiToi('an@vi-du.vn')).toHaveLength(2)

    await kho.guiLaiThuXacNhan({ email: 'khong-co@vi-du.vn' })
    expect(kho.moPhong.thuGuiToi('khong-co@vi-du.vn')).toEqual([])
  })

  it('thư đặt lại ghi mã và hạn theo thời hạn mặc định 1 giờ tính từ đồng hồ truyền vào', async () => {
    const kho = taoKhoBoNho()
    await kho.dangKy({ email: 'binh@vi-du.vn', matKhau: '12345678', tenHienThi: 'Bình' })
    await kho.yeuCauDatLaiMatKhau({ email: 'binh@vi-du.vn' }, LUC)
    const thu = kho.moPhong.thuGuiToi('binh@vi-du.vn').find((t) => t.loai === 'DAT_LAI_MAT_KHAU')
    expect(thu).toEqual({
      loai: 'DAT_LAI_MAT_KHAU',
      email: 'binh@vi-du.vn',
      ma: expect.any(String),
      hetHanLuc: new Date(LUC.getTime() + 60 * 60 * 1000),
    })

    await kho.yeuCauDatLaiMatKhau({ email: 'khong-co@vi-du.vn' }, LUC)
    expect(kho.moPhong.thuGuiToi('khong-co@vi-du.vn')).toEqual([])
  })
})
