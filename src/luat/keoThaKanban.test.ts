import { describe, expect, it } from 'vitest'
import { MA_TRAN_CHUYEN_TRANG_THAI, kiemChuyenTrangThai, type TinhHuongChuyen } from './chuyenTrangThai'
import { cacCotThaDuoc, danhGiaTha, moTaDangKeo, theKeoDuoc } from './keoThaKanban'
import { CAC_TRANG_THAI_TASK, type TrangThaiTask } from './task'

function tinhHuong(rieng: Partial<TinhHuongChuyen> = {}): TinhHuongChuyen {
  return {
    vaiNguoiGoi: 'THANH_VIEN',
    laNguoiTrongDuAn: true,
    nguoiGoiId: 'an',
    nguoiThucHienId: 'an',
    nguoiKiemTraId: 'binh',
    trangThaiDuAn: 'HOAT_DONG',
    trangThaiTask: 'MOI',
    ...rieng,
  }
}

const BINH = { nguoiGoiId: 'binh' }
const SUPPORT = { vaiNguoiGoi: 'SUPPORT', nguoiGoiId: 'chi' } as const
const PM = { vaiNguoiGoi: 'PM', nguoiGoiId: 'pm', laNguoiTrongDuAn: false } as const
const EM = { nguoiGoiId: 'em' }

describe('thẻ kéo được', () => {
  it('mọi trạng thái kéo được trừ Hoàn thành và Huỷ', () => {
    const keoDuoc = CAC_TRANG_THAI_TASK.filter(theKeoDuoc)
    expect(keoDuoc).toEqual(['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI'])
  })
})

describe('danhGiaTha', () => {
  it('thả lại đúng cột cũ thì giữ nguyên, không làm gì và không báo lỗi', () => {
    for (const trangThai of CAC_TRANG_THAI_TASK) {
      expect(danhGiaTha(tinhHuong({ trangThaiTask: trangThai, ...PM }), trangThai)).toEqual({ loai: 'GIU_NGUYEN' })
    }
  })

  it('bước làm được không cần lý do thì làm ngay; bước cần lý do thì mở hộp nhập lý do', () => {
    const batDau = danhGiaTha(tinhHuong(), 'DANG_LAM')
    expect(batDau).toMatchObject({ loai: 'LAM_NGAY', buoc: { tu: 'MOI', sang: 'DANG_LAM', canLyDo: false } })
    const traLai = danhGiaTha(tinhHuong({ trangThaiTask: 'CHO_DUYET', ...BINH }), 'TRA_LAI')
    expect(traLai).toMatchObject({ loai: 'CAN_LY_DO', buoc: { tu: 'CHO_DUYET', sang: 'TRA_LAI', canLyDo: true } })
    const huy = danhGiaTha(tinhHuong({ trangThaiTask: 'DANG_LAM', ...SUPPORT }), 'HUY')
    expect(huy).toMatchObject({ loai: 'CAN_LY_DO', buoc: { sang: 'HUY' } })
  })

  it('bước không có trong ma trận bị từ chối với đúng thông báo của luật chuyển trạng thái', () => {
    const kq = danhGiaTha(tinhHuong({ ...PM }), 'HOAN_THANH')
    expect(kq).toEqual({ loai: 'TU_CHOI', thongBao: 'Không có bước chuyển từ Mới sang Hoàn thành.' })
  })

  it('người không có quyền bị từ chối kèm lý do: sai vai, không giữ vai nào, Dự án Lưu trữ, Task đã chốt', () => {
    expect(danhGiaTha(tinhHuong({ trangThaiTask: 'CHO_DUYET' }), 'HOAN_THANH')).toEqual({
      loai: 'TU_CHOI',
      thongBao: 'Bước Chờ duyệt sang Hoàn thành chỉ Người kiểm tra, Support của Dự án hoặc PM làm được.',
    })
    expect(danhGiaTha(tinhHuong({ ...EM }), 'DANG_LAM')).toMatchObject({ loai: 'TU_CHOI', thongBao: expect.stringContaining('Chỉ Người thực hiện') })
    expect(danhGiaTha(tinhHuong({ trangThaiDuAn: 'LUU_TRU' }), 'DANG_LAM')).toMatchObject({
      loai: 'TU_CHOI',
      thongBao: expect.stringContaining('Lưu trữ'),
    })
    expect(danhGiaTha(tinhHuong({ trangThaiTask: 'HOAN_THANH', ...PM }), 'DANG_LAM')).toMatchObject({
      loai: 'TU_CHOI',
      thongBao: expect.stringContaining('đã chốt'),
    })
  })

  it('kết luận khớp luật chuyển trạng thái với mọi người gọi, mọi trạng thái Task và mọi cột đích', () => {
    const nguoi = [{}, BINH, SUPPORT, PM, EM]
    for (const trangThaiDuAn of ['HOAT_DONG', 'LUU_TRU'] as const) {
      for (const rieng of nguoi) {
        for (const tu of CAC_TRANG_THAI_TASK) {
          for (const sang of CAC_TRANG_THAI_TASK) {
            const th = tinhHuong({ ...rieng, trangThaiDuAn, trangThaiTask: tu })
            const kq = danhGiaTha(th, sang)
            if (sang === tu) {
              expect(kq.loai).toBe('GIU_NGUYEN')
              continue
            }
            const goc = kiemChuyenTrangThai(th, { sang, lyDo: 'Có lý do' })
            if (goc.ok) {
              expect(kq).toEqual({ loai: goc.buoc.canLyDo ? 'CAN_LY_DO' : 'LAM_NGAY', buoc: goc.buoc })
            } else {
              expect(kq).toEqual({ loai: 'TU_CHOI', thongBao: goc.thongBao })
            }
          }
        }
      }
    }
  })
})

describe('cột thả được', () => {
  it('đúng các bước người gọi làm được từ trạng thái hiện tại', () => {
    const cot = (th: TinhHuongChuyen): TrangThaiTask[] => cacCotThaDuoc(th)
    expect(cot(tinhHuong())).toEqual(['DANG_LAM'])
    expect(cot(tinhHuong({ trangThaiTask: 'CHO_DUYET', ...BINH }))).toEqual(['HOAN_THANH', 'TRA_LAI', 'BI_LOI'])
    expect(cot(tinhHuong({ trangThaiTask: 'CHO_DUYET', ...PM }))).toEqual(['HOAN_THANH', 'TRA_LAI', 'BI_LOI', 'HUY'])
    expect(cot(tinhHuong({ ...EM }))).toEqual([])
    expect(cot(tinhHuong({ trangThaiTask: 'HOAN_THANH', ...PM }))).toEqual([])
    expect(cot(tinhHuong({ trangThaiDuAn: 'LUU_TRU', ...PM }))).toEqual([])
  })

  it('mỗi cột thả được trùng với một bước của ma trận', () => {
    for (const buoc of MA_TRAN_CHUYEN_TRANG_THAI) {
      const th = tinhHuong({ trangThaiTask: buoc.tu, ...PM })
      expect(cacCotThaDuoc(th)).toContain(buoc.sang)
    }
  })

  it('câu mô tả khi đang kéo nêu thẻ và các cột thả được, hoặc nói chưa có cột nào', () => {
    expect(moTaDangKeo('Làm trang chủ', ['DANG_LAM', 'HUY'])).toBe('Đang kéo "Làm trang chủ". Có thể thả vào: Đang làm, Huỷ.')
    expect(moTaDangKeo('Làm trang chủ', [])).toBe('Đang kéo "Làm trang chủ". Bạn chưa có cột nào để thả.')
  })
})
