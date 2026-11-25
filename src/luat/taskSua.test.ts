import { describe, expect, it } from 'vitest'
import {
  CAC_TRANG_THAI_TASK,
  THONG_BAO_SUA_TASK,
  THONG_BAO_TASK,
  kiemDoiNguoiTask,
  kiemSuaTask,
  kiemTraSuaTask,
  laTaskDaChot,
  lyDoKhongSuaTask,
  taskChuaChotNguoiDangGiu,
  vaiGiuTask,
  type TrangThaiTask,
} from './task'

describe('Task đã chốt', () => {
  it('chỉ Hoàn thành và Huỷ là trạng thái cuối', () => {
    expect(CAC_TRANG_THAI_TASK.filter(laTaskDaChot)).toEqual(['HOAN_THANH', 'HUY'])
  })
})

describe('quyền sửa Task và đổi người', () => {
  const task: TrangThaiTask = 'DANG_LAM'
  it('PM luôn được, Support chỉ khi ở trong Dự án, Thành viên không', () => {
    const hd = { trangThai: 'HOAT_DONG' as const, trangThaiTask: task }
    expect(kiemSuaTask({ ...hd, vaiNguoiGoi: 'PM', laNguoiTrongDuAn: false })).toBeNull()
    expect(kiemSuaTask({ ...hd, vaiNguoiGoi: 'SUPPORT', laNguoiTrongDuAn: true })).toBeNull()
    expect(kiemSuaTask({ ...hd, vaiNguoiGoi: 'SUPPORT', laNguoiTrongDuAn: false })).toBe('KHONG_CO_QUYEN')
    expect(kiemSuaTask({ ...hd, vaiNguoiGoi: 'THANH_VIEN', laNguoiTrongDuAn: true })).toBe('KHONG_CO_QUYEN')
  })

  it('thứ tự từ chối: quyền, rồi Dự án Lưu trữ, rồi Task đã chốt', () => {
    const pm = { vaiNguoiGoi: 'PM' as const, laNguoiTrongDuAn: true }
    expect(kiemSuaTask({ ...pm, trangThai: 'LUU_TRU', trangThaiTask: 'HOAN_THANH' })).toBe('DU_AN_DA_LUU_TRU')
    expect(kiemSuaTask({ ...pm, trangThai: 'HOAT_DONG', trangThaiTask: 'HUY' })).toBe('TASK_DA_CHOT')
    expect(
      kiemSuaTask({ vaiNguoiGoi: 'THANH_VIEN', laNguoiTrongDuAn: true, trangThai: 'LUU_TRU', trangThaiTask: 'HUY' }),
    ).toBe('KHONG_CO_QUYEN')
  })

  it('lý do tiếng Việt khớp với mã từ chối', () => {
    const pm = { vaiNguoiGoi: 'PM' as const, laNguoiTrongDuAn: true, trangThai: 'HOAT_DONG' as const }
    expect(lyDoKhongSuaTask({ ...pm, trangThaiTask: 'MOI' })).toBeNull()
    expect(lyDoKhongSuaTask({ ...pm, trangThaiTask: 'HOAN_THANH' })).toBe(THONG_BAO_SUA_TASK.daChot)
    expect(lyDoKhongSuaTask({ ...pm, trangThai: 'LUU_TRU', trangThaiTask: 'MOI' })).toBe(THONG_BAO_SUA_TASK.daLuuTru)
    expect(lyDoKhongSuaTask({ ...pm, vaiNguoiGoi: 'THANH_VIEN', trangThaiTask: 'MOI' })).toBe(
      THONG_BAO_SUA_TASK.khongQuanLy,
    )
  })
})

describe('kiểm dữ liệu sửa Task', () => {
  it('chỉ giữ ô được gửi; mô tả trống là xoá mô tả, hạn trống là xoá hạn', () => {
    expect(kiemTraSuaTask.sua({})).toEqual({ ok: true, giaTri: {} })
    expect(kiemTraSuaTask.sua({ tieuDe: '  Việc  ', moTa: ' ', han: ' ' })).toEqual({
      ok: true,
      giaTri: { tieuDe: 'Việc', moTa: '', han: null },
    })
    expect(kiemTraSuaTask.sua({ han: null })).toEqual({ ok: true, giaTri: { han: null } })
  })

  it('tiêu đề và hạn tuân luật của ticket 07', () => {
    expect(kiemTraSuaTask.sua({ tieuDe: '  ' })).toEqual({ ok: false, loiTheoO: { tieuDe: THONG_BAO_TASK.tieuDeTrong } })
    expect(kiemTraSuaTask.sua({ han: '2026-02-30' })).toEqual({ ok: false, loiTheoO: { han: THONG_BAO_TASK.hanSai } })
  })

  it('đổi người: ô trống thành null, ô không gửi thì vắng mặt', () => {
    expect(kiemTraSuaTask.doiNguoi({ nguoiThucHienId: ' a ', nguoiKiemTraId: '' })).toEqual({
      ok: true,
      giaTri: { nguoiThucHienId: 'a', nguoiKiemTraId: null },
    })
    expect(kiemTraSuaTask.doiNguoi({})).toEqual({ ok: true, giaTri: {} })
  })
})

describe('luật đổi người của Task', () => {
  const trong = new Set(['an', 'binh', 'chi'])
  const hienTai = { nguoiThucHienId: 'an', nguoiKiemTraId: 'binh' }
  const laNguoiTrongDuAn = (id: string) => trong.has(id)

  it('ghép ô được gửi với người hiện tại', () => {
    expect(kiemDoiNguoiTask({ hienTai, moi: { nguoiKiemTraId: 'chi' }, laNguoiTrongDuAn })).toEqual({
      ok: true,
      nguoiThucHienId: 'an',
      nguoiKiemTraId: 'chi',
    })
  })

  it('người được chọn phải ở trong Dự án, hai người phải khác nhau, không được bỏ trống', () => {
    const ma = (moi: Parameters<typeof kiemDoiNguoiTask>[0]['moi']) => {
      const kq = kiemDoiNguoiTask({ hienTai, moi, laNguoiTrongDuAn })
      return kq.ok ? 'OK' : kq.loi.ma
    }
    expect(ma({ nguoiThucHienId: 'ngoai' })).toBe('NGUOI_NGOAI_DU_AN')
    expect(ma({ nguoiKiemTraId: 'an' })).toBe('TRUNG_NGUOI')
    expect(ma({ nguoiThucHienId: null })).toBe('THIEU_NGUOI')
    expect(ma({ nguoiThucHienId: 'chi', nguoiKiemTraId: 'chi' })).toBe('TRUNG_NGUOI')
    expect(ma({ nguoiThucHienId: 'binh', nguoiKiemTraId: 'an' })).toBe('OK')
  })

  it('người cũ đã rời Dự án ở ô không đổi thì được giữ; chọn họ cho ô khác thì không', () => {
    const anDaRoi = (id: string) => id === 'binh' || id === 'chi'
    expect(kiemDoiNguoiTask({ hienTai, moi: { nguoiKiemTraId: 'chi' }, laNguoiTrongDuAn: anDaRoi }).ok).toBe(true)
    expect(kiemDoiNguoiTask({ hienTai, moi: { nguoiThucHienId: 'an' }, laNguoiTrongDuAn: anDaRoi }).ok).toBe(true)
    const kq = kiemDoiNguoiTask({
      hienTai: { nguoiThucHienId: 'dung', nguoiKiemTraId: 'binh' },
      moi: { nguoiThucHienId: 'chi', nguoiKiemTraId: 'an' },
      laNguoiTrongDuAn: anDaRoi,
    })
    expect(kq).toMatchObject({ ok: false, loi: { ma: 'NGUOI_NGOAI_DU_AN' } })
  })
})

describe('Task chưa chốt mà một người đang giữ', () => {
  const t = (id: string, trangThai: TrangThaiTask, th: string, kt: string) => ({
    id,
    trangThai,
    nguoiThucHien: { id: th },
    nguoiKiemTra: { id: kt },
  })
  const danhSach = [
    t('1', 'MOI', 'an', 'binh'),
    t('2', 'CHO_DUYET', 'binh', 'an'),
    t('3', 'HOAN_THANH', 'an', 'binh'),
    t('4', 'HUY', 'binh', 'an'),
    t('5', 'DANG_LAM', 'binh', 'chi'),
  ]

  it('gồm cả thực hiện lẫn kiểm tra, bỏ Hoàn thành, Huỷ và Task của người khác', () => {
    expect(taskChuaChotNguoiDangGiu(danhSach, 'an').map((x) => x.id)).toEqual(['1', '2'])
    expect(taskChuaChotNguoiDangGiu(danhSach, 'chi').map((x) => x.id)).toEqual(['5'])
    expect(taskChuaChotNguoiDangGiu(danhSach, 'ai-do')).toEqual([])
  })

  it('cho biết người đó giữ ở vai nào', () => {
    expect(vaiGiuTask(danhSach[0], 'an')).toBe('NGUOI_THUC_HIEN')
    expect(vaiGiuTask(danhSach[0], 'binh')).toBe('NGUOI_KIEM_TRA')
    expect(vaiGiuTask(danhSach[0], 'chi')).toBeNull()
  })
})
