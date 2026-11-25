// Kéo thả so với nút, qua Kho dữ liệu và bảng ca dùng chung của ticket 11 (mọi ca): với cùng người
// gọi, cùng bước và cùng lý do, đường kéo thả (luật thuần `danhGiaTha` rồi lệnh Kho mà thẻ gọi) và
// đường nút (thẳng lệnh Kho `doiTrangThaiTask`, như chi tiết Task) để lại đúng cùng một kết quả:
// cùng Task, cùng lịch sử, cùng dấu vết; bị từ chối thì cùng câu thông báo.
import { describe, expect, it } from 'vitest'
import type { KetQua } from '../kho/ketQua'
import type { Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import {
  BANG_CA_CHUYEN_TRANG_THAI,
  type CaChuyenTrangThai,
  type LoaiNguoiGoi,
} from '../kho/bangCaChuyenTrangThai'
import { timBuoc } from '../luat/chuyenTrangThai'
import { danhGiaTha } from '../luat/keoThaKanban'
import type { TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { guiDoiTrangThai, tinhHuongCua, type QuyenChuyenKanban } from './chuyenTheKanban'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-06-01T09:00:00+07:00')
const LUC_DOI = new Date('2026-06-02T08:30:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'PM chủ' }
const LY_DO = '  Chưa đạt yêu cầu  '

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

interface BoiCanh {
  kho: KhoBoNho
  pm: Phien
  duAnId: string
  taskId: string
  nguoi: Record<LoaiNguoiGoi, { phien: Phien; vai: VaiHeThong }>
}

/** Dựng đúng bối cảnh của bảng ca (xem `CAC_LOAI_NGUOI_GOI`) trên một Kho bộ nhớ mới. */
async function dungBoiCanh(tu: TrangThaiTask, luuTru: boolean): Promise<BoiCanh> {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const pm = giaTri(await kho.dangNhap({ email: PM.email, matKhau: MAT_KHAU }))
  const taoNguoi = async (ten: string, vai: VaiHeThong) => {
    const email = `${ten}@vi-du.vn`
    const hoSo = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
    await kho.moPhong.xacNhanEmail(email)
    if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, hoSo.id, { vai }))
    return { phien: giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU })), vai, email }
  }
  const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC_TAO))
  const an = await taoNguoi('an', 'THANH_VIEN')
  const binh = await taoNguoi('binh', 'THANH_VIEN')
  const chi = await taoNguoi('chi', 'SUPPORT')
  const dung = await taoNguoi('dung', 'SUPPORT')
  const em = await taoNguoi('em', 'THANH_VIEN')
  const phuong = await taoNguoi('phuong', 'THANH_VIEN')
  const pmKhac = await taoNguoi('pmkhac', 'PM')
  for (const nguoi of [an, binh, chi, em]) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: nguoi.email }))
  const task = giaTri(
    await kho.taoTask(
      pm,
      duAn.id,
      { tieuDe: 'Làm trang chủ', nguoiThucHienId: an.phien.nguoiDungId, nguoiKiemTraId: binh.phien.nguoiDungId },
      LUC_TAO,
    ),
  )
  if (tu !== 'MOI') giaTri(await kho.chuDuAn.datTrangThaiTask(task.id, tu))
  if (luuTru) giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC_TAO))
  return {
    kho,
    pm,
    duAnId: duAn.id,
    taskId: task.id,
    nguoi: {
      NGUOI_THUC_HIEN: an,
      NGUOI_KIEM_TRA: binh,
      SUPPORT_CUA_DU_AN: chi,
      SUPPORT_NGOAI_DU_AN: dung,
      PM: pmKhac,
      THANH_VIEN_KHAC: em,
      THANH_VIEN_NGOAI: phuong,
    },
  }
}

/** Những gì còn lại trong Kho sau một đường đi: Task, dấu vết và lịch sử (không gồm id, vì mỗi Kho một bộ id). */
async function chupLai(bc: BoiCanh) {
  const task = giaTri(await bc.kho.layTask(bc.pm, bc.taskId))
  const lichSu = giaTri(await bc.kho.lichSuTask(bc.pm, bc.taskId))
  return {
    trangThai: task.trangThai,
    soLanTraLai: task.soLanTraLai,
    suaBoi: task.dauVet.suaBoi?.tenHienThi ?? null,
    suaLuc: task.dauVet.suaLuc,
    lichSu: lichSu.map((d) => ({ nguoi: d.nguoiDoi.tenHienThi, luc: d.luc, tu: d.tu, sang: d.sang, lyDo: d.lyDo })),
  }
}

type KetQuaDuong = { loai: 'DA_GUI'; ok: boolean; thongBao: string | null } | { loai: 'TU_CHOI_O_THE'; thongBao: string } | { loai: 'KHONG_GUI' }

/** Đường kéo thả: luật thuần quyết định, rồi (nếu làm được) đúng lệnh Kho. Hộp lý do: có lý do thì gửi, trống thì không gửi được. */
async function duongKeoTha(bc: BoiCanh, nguoiGoi: LoaiNguoiGoi, sang: TrangThaiTask, lyDo: string | null): Promise<KetQuaDuong> {
  const { phien, vai } = bc.nguoi[nguoiGoi]
  const task = giaTri(await bc.kho.layTask(bc.pm, bc.taskId))
  const duAn = giaTri(await bc.kho.danhSachDuAnCuaToi(phien))
  const quyen: QuyenChuyenKanban = {
    phien,
    vai,
    trangThaiDuAn: giaTri(await bc.kho.layDuAn(bc.pm, bc.duAnId)).trangThai,
    laNguoiTrongDuAn: duAn.some((d) => d.id === bc.duAnId),
    dongHo: () => LUC_DOI,
  }
  const kq = danhGiaTha(tinhHuongCua(quyen, task), sang)
  switch (kq.loai) {
    case 'GIU_NGUYEN':
      return { loai: 'KHONG_GUI' }
    case 'TU_CHOI':
      return { loai: 'TU_CHOI_O_THE', thongBao: kq.thongBao }
    case 'CAN_LY_DO': {
      if (lyDo === null || lyDo.trim() === '') return { loai: 'KHONG_GUI' }
      const gui = await guiDoiTrangThai(bc.kho, quyen, task, kq.buoc, lyDo.trim())
      return { loai: 'DA_GUI', ok: gui.ok, thongBao: gui.ok ? null : gui.loi.thongBao }
    }
    case 'LAM_NGAY': {
      const gui = await guiDoiTrangThai(bc.kho, quyen, task, kq.buoc, null)
      return { loai: 'DA_GUI', ok: gui.ok, thongBao: gui.ok ? null : gui.loi.thongBao }
    }
  }
}

/** Đường nút: thẳng lệnh Kho với dữ liệu vào của người dùng, như ticket 11. */
async function duongNut(bc: BoiCanh, nguoiGoi: LoaiNguoiGoi, sang: TrangThaiTask, lyDo: string | null) {
  const { phien } = bc.nguoi[nguoiGoi]
  return bc.kho.doiTrangThaiTask(phien, bc.taskId, lyDo === null ? { sang } : { sang, lyDo }, LUC_DOI)
}

/**
 * Lý do mà người dùng thật nhập được: chỉ bước bắt buộc lý do (Trả lại, Bị lỗi, Huỷ) mới có ô nhập,
 * nên ở bước khác lý do của bảng ca không áp dụng cho nút hay kéo thả.
 */
function lyDoNguoiDungNhap(ca: CaChuyenTrangThai): string | null {
  if (ca.lyDo === 'KHONG' || !timBuoc(ca.tu, ca.sang)?.canLyDo) return null
  return ca.lyDo === 'CO' ? LY_DO : '   '
}

describe('kéo thả và nút cho cùng kết quả (bảng ca dùng chung của ticket 11)', () => {
  // Bỏ các dòng trùng sau khi gộp lý do không áp dụng (cùng người, bước, Dự án, lý do thật nhập).
  const daCo = new Set<string>()
  const cacCa = BANG_CA_CHUYEN_TRANG_THAI.filter((ca) => {
    const khoa = [ca.nguoiGoi, ca.tu, ca.sang, ca.trangThaiDuAn, lyDoNguoiDungNhap(ca)].join('|')
    if (daCo.has(khoa)) return false
    daCo.add(khoa)
    return true
  })

  it('bảng ca có đủ ca để so sánh, đủ mọi loại kết quả', () => {
    expect(cacCa.length).toBeGreaterThan(300)
    for (const ketQua of ['DUOC', 'KHONG_CO_QUYEN', 'BUOC_KHONG_HOP_LE', 'TASK_DA_CHOT', 'DU_AN_DA_LUU_TRU', 'LY_DO_BAT_BUOC']) {
      expect(cacCa.some((ca) => ca.ketQua === ketQua), ketQua).toBe(true)
    }
  })

  it.each(cacCa)(
    '$nguoiGoi: $tu → $sang, lý do $lyDo, Dự án $trangThaiDuAn → $ketQua',
    async (ca: CaChuyenTrangThai) => {
      const lyDo = lyDoNguoiDungNhap(ca)
      const keo = await dungBoiCanh(ca.tu, ca.trangThaiDuAn === 'LUU_TRU')
      const nut = await dungBoiCanh(ca.tu, ca.trangThaiDuAn === 'LUU_TRU')
      const truoc = await chupLai(keo)

      const kqKeo = await duongKeoTha(keo, ca.nguoiGoi, ca.sang, lyDo)
      const kqNut = await duongNut(nut, ca.nguoiGoi, ca.sang, lyDo)
      const sauKeo = await chupLai(keo)
      const sauNut = await chupLai(nut)

      // Cùng kết quả cuối trong Kho, cho mọi ca.
      expect(sauKeo).toEqual(sauNut)
      if (ca.tu === ca.sang) {
        // Thả lại đúng cột cũ không phải một bước: kéo thả không làm gì, không báo lỗi (nút không có
        // bước "sang chính nó" để bấm).
        expect(kqKeo).toEqual({ loai: 'KHONG_GUI' })
        expect(sauKeo).toEqual(truoc)
      } else if (ca.ketQua === 'DUOC') {
        expect(kqNut.ok).toBe(true)
        expect(kqKeo).toEqual({ loai: 'DA_GUI', ok: true, thongBao: null })
        expect(sauKeo.trangThai).toBe(ca.sang)
        expect(sauKeo.lichSu).toHaveLength(truoc.lichSu.length + 1)
      } else {
        // Không đổi gì ở cả hai đường.
        expect(sauKeo).toEqual(truoc)
        expect(kqNut.ok).toBe(false)
        if (ca.ketQua === 'LY_DO_BAT_BUOC') {
          // Nút: Kho đòi lý do. Kéo thả: hộp lý do không cho gửi lý do trống, nên không gửi lệnh nào.
          expect(kqKeo).toEqual({ loai: 'KHONG_GUI' })
        } else {
          // Thẻ từ chối ngay, bằng đúng câu mà Kho trả.
          expect(kqKeo.loai).toBe('TU_CHOI_O_THE')
          if (kqKeo.loai === 'TU_CHOI_O_THE' && !kqNut.ok) expect(kqKeo.thongBao).toBe(kqNut.loi.thongBao)
        }
      }
    },
  )
})
