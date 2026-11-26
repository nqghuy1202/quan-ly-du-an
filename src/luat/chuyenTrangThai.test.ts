import { describe, expect, it } from 'vitest'
import {
  DO_DAI_LY_DO_TOI_DA,
  MA_TRAN_CHUYEN_TRANG_THAI,
  THONG_BAO_CHUYEN_TRANG_THAI,
  cacBuocLamDuoc,
  cacVaiTrenTask,
  dongLichSuMoi,
  kiemChuyenTrangThai,
  lyDoKhongCoBuoc,
  soLanTraLaiSau,
  timBuoc,
  xepLichSuTask,
  type TinhHuongChuyen,
} from './chuyenTrangThai'
import { CAC_TRANG_THAI_TASK, type TrangThaiTask } from './task'

const AN = 'an'
const BINH = 'binh'

function tinhHuong(rieng: Partial<TinhHuongChuyen> = {}): TinhHuongChuyen {
  return {
    vaiNguoiGoi: 'THANH_VIEN',
    laNguoiTrongDuAn: true,
    nguoiGoiId: AN,
    nguoiThucHienId: AN,
    nguoiKiemTraId: BINH,
    trangThaiDuAn: 'HOAT_DONG',
    trangThaiTask: 'MOI',
    ...rieng,
  }
}

const NGUOI_KIEM_TRA = { nguoiGoiId: BINH }
const SUPPORT = { vaiNguoiGoi: 'SUPPORT', nguoiGoiId: 'chi' } as const
const PM = { vaiNguoiGoi: 'PM', nguoiGoiId: 'pm', laNguoiTrongDuAn: false } as const

describe('ma trận chuyển trạng thái', () => {
  it('có đúng 12 bước: 7 bước chính và Huỷ từ năm trạng thái chưa cuối; không bước nào đi ra từ Hoàn thành hay Huỷ', () => {
    expect(MA_TRAN_CHUYEN_TRANG_THAI).toHaveLength(12)
    expect(MA_TRAN_CHUYEN_TRANG_THAI.filter((b) => b.tu === 'HOAN_THANH' || b.tu === 'HUY')).toEqual([])
    expect(MA_TRAN_CHUYEN_TRANG_THAI.filter((b) => b.sang === 'HUY').map((b) => b.tu)).toEqual([
      'MOI',
      'DANG_LAM',
      'CHO_DUYET',
      'TRA_LAI',
      'BI_LOI',
    ])
  })

  it('chỉ Trả lại, Bị lỗi và Huỷ bắt buộc có lý do', () => {
    const canLyDo = MA_TRAN_CHUYEN_TRANG_THAI.filter((b) => b.canLyDo).map((b) => b.sang)
    expect(new Set(canLyDo)).toEqual(new Set(['TRA_LAI', 'BI_LOI', 'HUY']))
    expect(MA_TRAN_CHUYEN_TRANG_THAI.filter((b) => !b.canLyDo).every((b) => !['TRA_LAI', 'BI_LOI', 'HUY'].includes(b.sang))).toBe(true)
  })

  it('timBuoc tìm đúng bước hoặc không có', () => {
    expect(timBuoc('MOI', 'DANG_LAM')?.nguoiLam).toEqual(['NGUOI_THUC_HIEN', 'SUPPORT', 'PM'])
    expect(timBuoc('MOI', 'HOAN_THANH')).toBeUndefined()
    expect(timBuoc('HOAN_THANH', 'DANG_LAM')).toBeUndefined()
  })
})

describe('vai của người gọi trên Task', () => {
  it('Người thực hiện, Người kiểm tra, Support của Dự án, PM; ngoài Dự án thì không có vai (trừ PM)', () => {
    expect(cacVaiTrenTask(tinhHuong())).toEqual(['NGUOI_THUC_HIEN'])
    expect(cacVaiTrenTask(tinhHuong(NGUOI_KIEM_TRA))).toEqual(['NGUOI_KIEM_TRA'])
    expect(cacVaiTrenTask(tinhHuong(SUPPORT))).toEqual(['SUPPORT'])
    expect(cacVaiTrenTask(tinhHuong(PM))).toEqual(['PM'])
    expect(cacVaiTrenTask(tinhHuong({ vaiNguoiGoi: 'SUPPORT', nguoiGoiId: 'dung', laNguoiTrongDuAn: false }))).toEqual([])
    expect(cacVaiTrenTask(tinhHuong({ nguoiGoiId: 'em' }))).toEqual([])
    // Người đã rời Dự án mà vẫn ghi trên Task thì không còn vai.
    expect(cacVaiTrenTask(tinhHuong({ laNguoiTrongDuAn: false }))).toEqual([])
  })

  it('một Support cũng là Người thực hiện giữ cả hai vai', () => {
    expect(cacVaiTrenTask(tinhHuong({ vaiNguoiGoi: 'SUPPORT' }))).toEqual(['NGUOI_THUC_HIEN', 'SUPPORT'])
  })
})

describe('kiểm chuyển trạng thái', () => {
  it('Người thực hiện bắt đầu làm và báo chờ duyệt; không có lý do thì lý do là null', () => {
    const kq = kiemChuyenTrangThai(tinhHuong(), { sang: 'DANG_LAM' })
    expect(kq).toMatchObject({ ok: true, lyDo: null, tangTraLai: false })
    expect(kq.ok && kq.buoc).toMatchObject({ tu: 'MOI', sang: 'DANG_LAM' })
    expect(kiemChuyenTrangThai(tinhHuong({ trangThaiTask: 'DANG_LAM' }), { sang: 'CHO_DUYET' }).ok).toBe(true)
  })

  it('Người thực hiện tự duyệt hay Người kiểm tra bắt đầu việc: KHONG_CO_QUYEN, thông báo nêu ai làm được', () => {
    const tuDuyet = kiemChuyenTrangThai(tinhHuong({ trangThaiTask: 'CHO_DUYET' }), { sang: 'HOAN_THANH' })
    expect(tuDuyet).toMatchObject({ ok: false, ma: 'KHONG_CO_QUYEN' })
    expect(!tuDuyet.ok && tuDuyet.thongBao).toBe(
      'Bước Chờ duyệt sang Hoàn thành chỉ Người kiểm tra, Support của Dự án hoặc PM làm được.',
    )
    expect(kiemChuyenTrangThai(tinhHuong(NGUOI_KIEM_TRA), { sang: 'DANG_LAM' })).toMatchObject({
      ok: false,
      ma: 'KHONG_CO_QUYEN',
    })
  })

  it('không có vai nào trên Task: KHONG_CO_QUYEN, kể cả với bước không có trong ma trận (không lộ gì thêm)', () => {
    const la = tinhHuong({ nguoiGoiId: 'em' })
    expect(kiemChuyenTrangThai(la, { sang: 'DANG_LAM' })).toMatchObject({ ok: false, ma: 'KHONG_CO_QUYEN' })
    expect(kiemChuyenTrangThai(la, { sang: 'HOAN_THANH' })).toMatchObject({ ok: false, ma: 'KHONG_CO_QUYEN' })
  })

  it('bước không có trong ma trận: BUOC_KHONG_HOP_LE, kể cả sang chính trạng thái hiện tại', () => {
    expect(kiemChuyenTrangThai(tinhHuong(), { sang: 'HOAN_THANH' })).toMatchObject({ ok: false, ma: 'BUOC_KHONG_HOP_LE' })
    expect(kiemChuyenTrangThai(tinhHuong(PM), { sang: 'MOI' })).toMatchObject({ ok: false, ma: 'BUOC_KHONG_HOP_LE' })
  })

  it('Hoàn thành và Huỷ: mọi bước là TASK_DA_CHOT, kể cả với PM; kiểm trước cả bước không hợp lệ', () => {
    for (const trangThaiTask of ['HOAN_THANH', 'HUY'] as const) {
      for (const sang of CAC_TRANG_THAI_TASK) {
        expect(kiemChuyenTrangThai(tinhHuong({ ...PM, trangThaiTask }), { sang })).toMatchObject({
          ok: false,
          ma: 'TASK_DA_CHOT',
        })
      }
    }
  })

  it('Dự án Lưu trữ: DU_AN_DA_LUU_TRU cho người có vai, KHONG_CO_QUYEN cho người không có vai', () => {
    expect(kiemChuyenTrangThai(tinhHuong({ trangThaiDuAn: 'LUU_TRU' }), { sang: 'DANG_LAM' })).toMatchObject({
      ok: false,
      ma: 'DU_AN_DA_LUU_TRU',
    })
    expect(kiemChuyenTrangThai(tinhHuong({ trangThaiDuAn: 'LUU_TRU', nguoiGoiId: 'em' }), { sang: 'DANG_LAM' })).toMatchObject({
      ok: false,
      ma: 'KHONG_CO_QUYEN',
    })
  })

  it('Bị lỗi: chỉ Support của Dự án và PM đưa về Đang làm hoặc Huỷ', () => {
    const biLoi = { trangThaiTask: 'BI_LOI' } as const
    for (const sang of ['DANG_LAM', 'HUY'] as const) {
      const lyDo = { sang, lyDo: 'Giao lại' }
      expect(kiemChuyenTrangThai(tinhHuong(biLoi), lyDo)).toMatchObject({ ok: false, ma: 'KHONG_CO_QUYEN' })
      expect(kiemChuyenTrangThai(tinhHuong({ ...biLoi, ...NGUOI_KIEM_TRA }), lyDo)).toMatchObject({ ok: false, ma: 'KHONG_CO_QUYEN' })
      expect(kiemChuyenTrangThai(tinhHuong({ ...biLoi, ...SUPPORT }), lyDo).ok).toBe(true)
      expect(kiemChuyenTrangThai(tinhHuong({ ...biLoi, ...PM }), lyDo).ok).toBe(true)
    }
  })

  it.each([undefined, null, '', '   ', '\n\t '])('Trả lại, Bị lỗi, Huỷ với lý do %j: LY_DO_BAT_BUOC, báo ở ô lyDo', (lyDo) => {
    const cases: [TrangThaiTask, TrangThaiTask][] = [
      ['CHO_DUYET', 'TRA_LAI'],
      ['CHO_DUYET', 'BI_LOI'],
      ['DANG_LAM', 'HUY'],
    ]
    for (const [tu, sang] of cases) {
      const kq = kiemChuyenTrangThai(tinhHuong({ ...PM, trangThaiTask: tu }), { sang, lyDo })
      expect(kq).toMatchObject({ ok: false, ma: 'LY_DO_BAT_BUOC' })
      expect(!kq.ok && kq.loiTheoO).toEqual({ lyDo: THONG_BAO_CHUYEN_TRANG_THAI.lyDoTrong })
    }
  })

  it('có lý do thì lưu bản đã cắt khoảng trắng; Trả lại đánh dấu tăng bộ đếm, bước khác thì không', () => {
    const traLai = kiemChuyenTrangThai(tinhHuong({ ...NGUOI_KIEM_TRA, trangThaiTask: 'CHO_DUYET' }), {
      sang: 'TRA_LAI',
      lyDo: '  Thiếu ảnh  ',
    })
    expect(traLai).toMatchObject({ ok: true, lyDo: 'Thiếu ảnh', tangTraLai: true })
    const biLoi = kiemChuyenTrangThai(tinhHuong({ ...NGUOI_KIEM_TRA, trangThaiTask: 'CHO_DUYET' }), {
      sang: 'BI_LOI',
      lyDo: 'Hỏng',
    })
    expect(biLoi).toMatchObject({ ok: true, tangTraLai: false })
  })

  it('bước không cần lý do vẫn nhận lý do nếu người đổi nhập', () => {
    expect(kiemChuyenTrangThai(tinhHuong(), { sang: 'DANG_LAM', lyDo: ' Bắt đầu ' })).toMatchObject({
      ok: true,
      lyDo: 'Bắt đầu',
    })
  })

  it('dữ liệu sai: trạng thái đích không có thật, lý do không phải văn bản hay quá dài là KHONG_HOP_LE', () => {
    expect(kiemChuyenTrangThai(tinhHuong(), { sang: 'KHONG_CO' })).toMatchObject({ ok: false, ma: 'KHONG_HOP_LE' })
    expect(kiemChuyenTrangThai(tinhHuong(), {})).toMatchObject({ ok: false, ma: 'KHONG_HOP_LE' })
    expect(kiemChuyenTrangThai(tinhHuong(), null)).toMatchObject({ ok: false, ma: 'KHONG_HOP_LE' })
    const sai = kiemChuyenTrangThai(tinhHuong(), { sang: 'DANG_LAM', lyDo: 5 })
    expect(!sai.ok && sai.loiTheoO).toEqual({ lyDo: THONG_BAO_CHUYEN_TRANG_THAI.lyDoSai })
    const dai = kiemChuyenTrangThai(tinhHuong(PM), { sang: 'HUY', lyDo: 'a'.repeat(DO_DAI_LY_DO_TOI_DA + 1) })
    expect(!dai.ok && dai.loiTheoO).toEqual({ lyDo: THONG_BAO_CHUYEN_TRANG_THAI.lyDoQuaDai })
    expect(kiemChuyenTrangThai(tinhHuong(PM), { sang: 'HUY', lyDo: 'a'.repeat(DO_DAI_LY_DO_TOI_DA) }).ok).toBe(true)
  })

  it('PM làm được mọi bước của ma trận ở Dự án mình không ở trong', () => {
    for (const buoc of MA_TRAN_CHUYEN_TRANG_THAI) {
      const kq = kiemChuyenTrangThai(tinhHuong({ ...PM, trangThaiTask: buoc.tu }), { sang: buoc.sang, lyDo: 'Lý do' })
      expect(kq.ok, `${buoc.tu} → ${buoc.sang}`).toBe(true)
    }
  })
})

describe('các bước hiện thành nút và lý do khi không có nút', () => {
  const nhan = (th: TinhHuongChuyen) => cacBuocLamDuoc(th).map((b) => b.nhan)

  it('mỗi vai chỉ thấy đúng các bước mình làm được ở trạng thái hiện tại', () => {
    expect(nhan(tinhHuong())).toEqual(['Bắt đầu làm'])
    expect(nhan(tinhHuong({ trangThaiTask: 'CHO_DUYET' }))).toEqual([])
    expect(nhan(tinhHuong({ ...NGUOI_KIEM_TRA, trangThaiTask: 'CHO_DUYET' }))).toEqual(['Duyệt đạt', 'Trả lại', 'Báo Bị lỗi'])
    expect(nhan(tinhHuong({ trangThaiTask: 'TRA_LAI' }))).toEqual(['Làm lại'])
    expect(nhan(tinhHuong({ trangThaiTask: 'BI_LOI' }))).toEqual([])
    expect(nhan(tinhHuong({ ...SUPPORT, trangThaiTask: 'BI_LOI' }))).toEqual(['Giao lại, làm tiếp', 'Huỷ Task'])
    expect(nhan(tinhHuong({ ...PM, trangThaiTask: 'CHO_DUYET' }))).toEqual(['Duyệt đạt', 'Trả lại', 'Báo Bị lỗi', 'Huỷ Task'])
  })

  it('không bước nào khi Dự án Lưu trữ, Task đã chốt hay người gọi không có vai', () => {
    expect(nhan(tinhHuong({ ...PM, trangThaiDuAn: 'LUU_TRU' }))).toEqual([])
    expect(nhan(tinhHuong({ ...PM, trangThaiTask: 'HOAN_THANH' }))).toEqual([])
    expect(nhan(tinhHuong({ nguoiGoiId: 'em' }))).toEqual([])
  })

  it('mọi bước hiện thành nút đều qua được luật kiểm khi có lý do', () => {
    for (const trangThaiTask of CAC_TRANG_THAI_TASK) {
      for (const rieng of [{}, NGUOI_KIEM_TRA, SUPPORT, PM]) {
        const th = tinhHuong({ ...rieng, trangThaiTask })
        for (const buoc of cacBuocLamDuoc(th)) {
          expect(kiemChuyenTrangThai(th, { sang: buoc.sang, lyDo: 'Lý do' }).ok).toBe(true)
        }
      }
    }
  })

  it('lý do thay cho nút: null khi có nút; các trường hợp còn lại nêu rõ bằng tiếng Việt', () => {
    expect(lyDoKhongCoBuoc(tinhHuong())).toBeNull()
    expect(lyDoKhongCoBuoc(tinhHuong({ nguoiGoiId: 'em' }))).toBe(THONG_BAO_CHUYEN_TRANG_THAI.khongCoVai)
    expect(lyDoKhongCoBuoc(tinhHuong({ ...PM, trangThaiDuAn: 'LUU_TRU' }))).toBe(THONG_BAO_CHUYEN_TRANG_THAI.daLuuTru)
    expect(lyDoKhongCoBuoc(tinhHuong({ ...PM, trangThaiTask: 'HUY' }))).toBe(THONG_BAO_CHUYEN_TRANG_THAI.daChot)
    expect(lyDoKhongCoBuoc(tinhHuong({ trangThaiTask: 'CHO_DUYET' }))).toBe(
      'Task đang Chờ duyệt: bước tiếp theo do Người kiểm tra, Support của Dự án hoặc PM làm. Bạn chưa có bước nào để làm.',
    )
    expect(lyDoKhongCoBuoc(tinhHuong({ trangThaiTask: 'BI_LOI' }))).toBe(
      'Task đang Bị lỗi: bước tiếp theo do Support của Dự án hoặc PM làm. Bạn chưa có bước nào để làm.',
    )
  })
})

describe('bộ đếm Trả lại và lịch sử', () => {
  it('chỉ bước sang Trả lại tăng bộ đếm đúng 1', () => {
    for (const buoc of MA_TRAN_CHUYEN_TRANG_THAI) {
      expect(soLanTraLaiSau(3, buoc)).toBe(buoc.sang === 'TRA_LAI' ? 4 : 3)
    }
  })

  it('dòng lịch sử ghi người, giờ (bản sao), từ, sang, lý do', () => {
    const gio = new Date('2026-06-02T08:30:00+07:00')
    const dong = dongLichSuMoi('an', gio, { tu: 'CHO_DUYET', sang: 'TRA_LAI' }, 'Thiếu ảnh')
    expect(dong).toEqual({ loai: 'TRANG_THAI', nguoiDoi: 'an', luc: gio, tu: 'CHO_DUYET', sang: 'TRA_LAI', lyDo: 'Thiếu ảnh' })
    expect(dong.luc).not.toBe(gio)
  })

  it('xếp theo thời gian tăng dần, cùng lúc giữ thứ tự ghi, không đổi mảng gốc', () => {
    const goc = [
      { luc: new Date('2026-06-03T00:00:00Z'), ten: 'c' },
      { luc: new Date('2026-06-01T00:00:00Z'), ten: 'a1' },
      { luc: new Date('2026-06-02T00:00:00Z'), ten: 'b' },
      { luc: new Date('2026-06-01T00:00:00Z'), ten: 'a2' },
    ]
    expect(xepLichSuTask(goc).map((d) => d.ten)).toEqual(['a1', 'a2', 'b', 'c'])
    expect(goc[0]?.ten).toBe('c')
  })
})
