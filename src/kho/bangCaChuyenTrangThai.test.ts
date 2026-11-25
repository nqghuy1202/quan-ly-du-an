import { BANG_CA_CHUYEN_TRANG_THAI, CAC_LOAI_NGUOI_GOI } from './bangCaChuyenTrangThai'
import { CAC_TRANG_THAI_TASK } from '../luat/task'

describe('bảng ca dùng chung cho ma trận chuyển trạng thái (dữ liệu)', () => {
  it('Dự án đang hoạt động: mỗi bước (từ, sang) có đủ dòng cho từng loại người gọi', () => {
    for (const tu of CAC_TRANG_THAI_TASK) {
      for (const sang of CAC_TRANG_THAI_TASK) {
        for (const nguoiGoi of CAC_LOAI_NGUOI_GOI) {
          const dong = BANG_CA_CHUYEN_TRANG_THAI.filter(
            (ca) => ca.tu === tu && ca.sang === sang && ca.nguoiGoi === nguoiGoi && ca.trangThaiDuAn === 'HOAT_DONG',
          )
          expect(dong.length, `${nguoiGoi}: ${tu} → ${sang}`).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('không có hai dòng cho cùng một tình huống', () => {
    const khoa = BANG_CA_CHUYEN_TRANG_THAI.map(
      (ca) => `${ca.nguoiGoi}|${ca.tu}|${ca.sang}|${ca.trangThaiDuAn}|${ca.lyDo}`,
    )
    expect(new Set(khoa).size).toBe(khoa.length)
  })

  it('có đủ kết quả mong đợi: được, và các lỗi của ma trận', () => {
    const ketQua = new Set(BANG_CA_CHUYEN_TRANG_THAI.map((ca) => ca.ketQua))
    for (const ma of [
      'DUOC',
      'KHONG_CO_QUYEN',
      'BUOC_KHONG_HOP_LE',
      'LY_DO_BAT_BUOC',
      'TASK_DA_CHOT',
      'DU_AN_DA_LUU_TRU',
    ]) {
      expect(ketQua.has(ma as never), ma).toBe(true)
    }
  })

  it('đúng 12 bước của ma trận (7 bước chính và Huỷ từ 5 trạng thái chưa cuối) có người được làm', () => {
    const duoc = BANG_CA_CHUYEN_TRANG_THAI.filter(
      (ca) => ca.ketQua === 'DUOC' && ca.nguoiGoi === 'PM' && ca.lyDo !== 'TRONG',
    )
    const buoc = new Set(duoc.map((ca) => `${ca.tu}>${ca.sang}`))
    expect(buoc.size).toBe(12)
  })
})
