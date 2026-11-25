import { chayBoTestHopDong } from './hopDong'
import { taoKhoBoNho, type ThuMoPhong } from './khoBoNho'

const MUOI_LAM_PHUT = 15 * 60 * 1000

function maDatLaiMoiNhat(thu: ThuMoPhong[]): string | null {
  const datLai = thu.filter((t) => t.loai === 'DAT_LAI_MAT_KHAU')
  const moiNhat = datLai[datLai.length - 1]
  return moiNhat && moiNhat.loai === 'DAT_LAI_MAT_KHAU' ? moiNhat.ma : null
}

chayBoTestHopDong('bản bộ nhớ', () => {
  const kho = taoKhoBoNho({ thoiHanMaDatLaiMs: MUOI_LAM_PHUT })
  return {
    kho,
    xacNhanEmail: (email: string) => kho.moPhong.xacNhanEmail(email),
    maDatLaiMoiNhat: async (email: string) => maDatLaiMoiNhat(kho.moPhong.thuGuiToi(email)),
    thoiHanMaDatLaiMs: MUOI_LAM_PHUT,
  }
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
