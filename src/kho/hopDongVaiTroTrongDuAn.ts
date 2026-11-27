// Bộ test hợp đồng cho Vai trò trong Dự án và bảng Người trong dự án (ticket truong-moi 06): thêm người kèm
// (hay không kèm) vai trò, sửa vai trò (PM, Support của Dự án), từ chối (Thành viên, Support ngoài Dự án, Dự án
// đã Lưu trữ, quá 60 ký tự, người ngoài Dự án), vai trò không đổi quyền, và số Task đang giữ trong danh sách
// Người trong dự án. Ma trận quyền sửa theo vai: bảng ca quyền (`SUA_VAI_TRO_TRONG_DU_AN`). Tách khỏi
// `hopDong.ts` cho gọn; mọi bản cài gọi `chayHopDongVaiTroTrongDuAn` trong file `*.test.ts` của mình, với cùng
// `BanCaiHopDong`. Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`. Task đi tới trạng thái cuối bằng đúng
// các bước của vòng duyệt (PM làm), không cần `datTrangThaiTask`.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import type { DuAn, KhoDuLieu, NguoiTrongDuAn, Phien } from './khoDuLieu'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
/** Đồng hồ truyền vào, không đọc giờ thật. */
const LUC_TAO = new Date('2026-04-10T09:30:00+07:00')
const LUC_SUA = new Date('2026-04-11T14:15:00+07:00')
/** Id dạng uuid không thuộc tài khoản nào (bản cài dùng DB thật đòi id đúng dạng). */
const ID_KHONG_TON_TAI = '00000000-0000-4000-8000-000000000000'

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

export function chayHopDongVaiTroTrongDuAn(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn('VT')
  const coTask = tuyChon.coTask ?? true

  describe(`Vai trò trong Dự án và bảng Người trong dự án (hợp đồng) — ${tenBanCai}`, () => {
    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    async function khoiTao() {
      banCai = await taoBanCai()
      kho = banCai.kho
    }

    async function dangKyVaDangNhap(ten: string, vai: VaiHeThong = 'THANH_VIEN', pm?: Phien): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
      giaTri(await banCai.xacNhanEmail(email))
      if (vai === 'PM') await banCai.datVaiPM(email)
      const phien = giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
      if (vai === 'SUPPORT') {
        if (!pm) throw new Error('Cần PM để đặt vai Support')
        giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai: 'SUPPORT' }))
      }
      return phien
    }

    /** Dựng: một PM, một Dự án đang hoạt động, một Thành viên "Bình" đã ở trong Dự án. */
    async function dungBoiCanh() {
      await khoiTao()
      const pm = await dangKyVaDangNhap('vt-pm', 'PM')
      const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Dự án vai trò' }, LUC_TAO))
      const binh = await dangKyVaDangNhap('vt-binh')
      giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('vt-binh') }))
      return { pm, duAn, binh }
    }

    async function nguoiTrongDuAn(phien: Phien, duAn: DuAn, nguoiDungId: string): Promise<NguoiTrongDuAn | undefined> {
      return giaTri(await kho.danhSachNguoiTrongDuAn(phien, duAn.id)).find((nguoi) => nguoi.id === nguoiDungId)
    }

    async function vaiTroCua(duAn: DuAn, pm: Phien, nguoiDungId: string): Promise<string | null | undefined> {
      return (await nguoiTrongDuAn(pm, duAn, nguoiDungId))?.vaiTroTrongDuAn
    }

    describe('thêm người kèm Vai trò trong Dự án', () => {
      it('thêm kèm vai trò: kết quả và danh sách Người trong dự án có đúng vai trò (cắt khoảng trắng hai đầu)', async () => {
        const { pm, duAn } = await dungBoiCanh()
        const chi = await dangKyVaDangNhap('vt-chi')
        const them = giaTri(
          await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('vt-chi'), vaiTroTrongDuAn: '  Trưởng nhóm  ' }),
        )
        expect(them).toMatchObject({ id: chi.nguoiDungId, vaiTroTrongDuAn: 'Trưởng nhóm', soTaskDangGiu: 0 })
        expect(await vaiTroCua(duAn, pm, chi.nguoiDungId)).toBe('Trưởng nhóm')
        // Người cùng Dự án (Thành viên) cũng thấy vai trò đó.
        const binhThay = await nguoiTrongDuAn(
          giaTri(await kho.dangNhap({ email: emailMoi('vt-binh'), matKhau: MAT_KHAU })),
          duAn,
          chi.nguoiDungId,
        )
        expect(binhThay?.vaiTroTrongDuAn).toBe('Trưởng nhóm')
      })

      it('thêm không kèm vai trò (hay gửi trống) vẫn được; vai trò là trống', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBeNull()
        const chi = await dangKyVaDangNhap('vt-chi-trong')
        const them = giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('vt-chi-trong'), vaiTroTrongDuAn: '   ' }))
        expect(them.vaiTroTrongDuAn).toBeNull()
        expect(await vaiTroCua(duAn, pm, chi.nguoiDungId)).toBeNull()
      })

      it('thêm kèm vai trò dài hơn 60 ký tự: KHONG_HOP_LE kèm lỗi ở ô vai trò; không thêm ai', async () => {
        const { pm, duAn } = await dungBoiCanh()
        const chi = await dangKyVaDangNhap('vt-chi-dai')
        const kq = await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('vt-chi-dai'), vaiTroTrongDuAn: 'V'.repeat(61) })
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO).toEqual({ vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai })
        expect(await nguoiTrongDuAn(pm, duAn, chi.nguoiDungId)).toBeUndefined()
      })
    })

    describe('sửa Vai trò trong Dự án', () => {
      it('PM sửa được: kết quả đúng, đọc lại thấy; đúng 60 ký tự được; gửi trống là xoá; Dấu vết Dự án không đổi', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        const truocDuAn = giaTri(await kho.layDuAn(pm, duAn.id))

        const sua = giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: ' Kiểm thử ' }))
        expect(sua).toEqual(await nguoiTrongDuAn(pm, duAn, binh.nguoiDungId))
        expect(sua).toMatchObject({ id: binh.nguoiDungId, tenHienThi: 'vt-binh', vaiTroTrongDuAn: 'Kiểm thử' })

        const vuaDu = 'V'.repeat(60)
        giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: vuaDu }))
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBe(vuaDu)

        const xoa = giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: '' }))
        expect(xoa.vaiTroTrongDuAn).toBeNull()
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBeNull()

        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(truocDuAn)
      })

      it('Support của Dự án sửa được vai trò của người khác và của chính mình', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        const son = await dangKyVaDangNhap('vt-son', 'SUPPORT', pm)
        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('vt-son') }))

        giaTri(await kho.suaVaiTroTrongDuAn(son, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Lập trình' }))
        giaTri(await kho.suaVaiTroTrongDuAn(son, duAn.id, son.nguoiDungId, { vaiTroTrongDuAn: 'Điều phối' }))
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBe('Lập trình')
        expect(await vaiTroCua(duAn, pm, son.nguoiDungId)).toBe('Điều phối')
      })

      it('Thành viên của Dự án (kể cả sửa của chính mình) và Support ngoài Dự án: KHONG_CO_QUYEN; không đổi gì', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Cũ' }))
        const ngoai = await dangKyVaDangNhap('vt-support-ngoai', 'SUPPORT', pm)

        for (const [nguoiGoi, dich] of [
          [binh, binh.nguoiDungId],
          [ngoai, binh.nguoiDungId],
        ] as const) {
          const kq = await kho.suaVaiTroTrongDuAn(nguoiGoi, duAn.id, dich, { vaiTroTrongDuAn: 'Mới' })
          expect(maLoi(kq)).toBe('KHONG_CO_QUYEN')
        }
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBe('Cũ')
      })

      it('Dự án đã Lưu trữ: DU_AN_DA_LUU_TRU cho cả PM; vai trò giữ nguyên và vẫn đọc được', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Cũ' }))
        giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC_SUA))
        const kq = await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Mới' })
        expect(maLoi(kq)).toBe('DU_AN_DA_LUU_TRU')
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBe('Cũ')
        expect(await vaiTroCua(duAn, binh, binh.nguoiDungId)).toBe('Cũ')
      })

      it('vai trò dài hơn 60 ký tự: KHONG_HOP_LE kèm lỗi ở ô vai trò; không đổi gì', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Cũ' }))
        const kq = await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'V'.repeat(61) })
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO).toEqual({ vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai })
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBe('Cũ')
      })

      it('người không ở trong Dự án (đã đăng ký, hay id không tồn tại): KHONG_TIM_THAY', async () => {
        const { pm, duAn } = await dungBoiCanh()
        const ngoai = await dangKyVaDangNhap('vt-ngoai')
        for (const id of [ngoai.nguoiDungId, ID_KHONG_TON_TAI]) {
          expect(maLoi(await kho.suaVaiTroTrongDuAn(pm, duAn.id, id, { vaiTroTrongDuAn: 'Gì đó' }))).toBe('KHONG_TIM_THAY')
        }
        expect(await nguoiTrongDuAn(pm, duAn, ngoai.nguoiDungId)).toBeUndefined()
      })

      it('vai trò thuộc từng Dự án: cùng một người có vai trò khác nhau ở hai Dự án; gỡ rồi thêm lại thì vai trò trống', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        const duAnKhac = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Dự án khác' }, LUC_TAO))
        giaTri(await kho.themNguoiVaoDuAn(pm, duAnKhac.id, { email: emailMoi('vt-binh'), vaiTroTrongDuAn: 'Tư vấn' }))
        giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Trưởng nhóm' }))
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBe('Trưởng nhóm')
        expect(await vaiTroCua(duAnKhac, pm, binh.nguoiDungId)).toBe('Tư vấn')

        giaTri(await kho.goNguoiKhoiDuAn(pm, duAn.id, binh.nguoiDungId))
        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('vt-binh') }))
        expect(await vaiTroCua(duAn, pm, binh.nguoiDungId)).toBeNull()
        expect(await vaiTroCua(duAnKhac, pm, binh.nguoiDungId)).toBe('Tư vấn')
      })

      it('vai trò không đổi quyền: Thành viên có vai trò "Trưởng nhóm" vẫn không sửa được Dự án, không thêm người, không sửa vai trò', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Trưởng nhóm' }))
        await dangKyVaDangNhap('vt-moi')
        expect(maLoi(await kho.suaDuAn(binh, duAn.id, { ten: 'Đổi tên' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.themNguoiVaoDuAn(binh, duAn.id, { email: emailMoi('vt-moi') }))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.suaVaiTroTrongDuAn(binh, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'PM' }))).toBe(
          'KHONG_CO_QUYEN',
        )
        expect(giaTri(await kho.layHoSoCuaToi(binh)).vai).toBe('THANH_VIEN')
      })
    })

    describe('danh sách Người trong dự án', () => {
      if (!coTask) {
        it.skip('CHƯA KIỂM: số Task đang giữ, vì bản cài chưa có các lệnh Task (coTask: false)', () => {})
        return
      }

      it('số Task đang giữ: chỉ Task chưa Hoàn thành, chưa Huỷ mà người đó là Người thực hiện; không tính vai Người kiểm tra', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        const chi = await dangKyVaDangNhap('vt-chi-task')
        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('vt-chi-task') }))
        const giao = { nguoiThucHienId: binh.nguoiDungId, nguoiKiemTraId: chi.nguoiDungId }

        async function taoTask(tieuDe: string, nguoi = giao) {
          return giaTri(await kho.taoTask(pm, duAn.id, { tieuDe, ...nguoi }, LUC_TAO)).id
        }
        async function doi(taskId: string, sang: string, lyDo?: string) {
          giaTri(await kho.doiTrangThaiTask(pm, taskId, { sang, lyDo }, LUC_SUA))
        }

        // Bình là Người thực hiện của: Mới, Đang làm, Chờ duyệt (đếm), Hoàn thành, Huỷ (không đếm).
        await taoTask('Mới')
        const dangLam = await taoTask('Đang làm')
        await doi(dangLam, 'DANG_LAM')
        const choDuyet = await taoTask('Chờ duyệt')
        await doi(choDuyet, 'DANG_LAM')
        await doi(choDuyet, 'CHO_DUYET')
        const xong = await taoTask('Hoàn thành')
        await doi(xong, 'DANG_LAM')
        await doi(xong, 'CHO_DUYET')
        await doi(xong, 'HOAN_THANH')
        const huy = await taoTask('Huỷ')
        await doi(huy, 'HUY', 'Không làm nữa')
        // Bình chỉ là Người kiểm tra: không đếm cho Bình, đếm cho Chi.
        await taoTask('Bình kiểm tra', { nguoiThucHienId: chi.nguoiDungId, nguoiKiemTraId: binh.nguoiDungId })

        const danhSach = giaTri(await kho.danhSachNguoiTrongDuAn(pm, duAn.id))
        const so = (id: string) => danhSach.find((nguoi) => nguoi.id === id)?.soTaskDangGiu
        expect(so(binh.nguoiDungId)).toBe(3)
        expect(so(chi.nguoiDungId)).toBe(1)

        // Ai thấy Dự án cũng thấy cùng số đó; sửa vai trò trả kèm số Task đang giữ.
        const binhThay = giaTri(await kho.danhSachNguoiTrongDuAn(chi, duAn.id))
        expect(binhThay.find((nguoi) => nguoi.id === binh.nguoiDungId)?.soTaskDangGiu).toBe(3)
        const sua = giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Lập trình' }))
        expect(sua.soTaskDangGiu).toBe(3)
      })

      it('số Task đang giữ chỉ tính Task của chính Dự án đó; người chưa giữ Task nào là 0', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        const chi = await dangKyVaDangNhap('vt-chi-khac')
        const duAnKhac = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Dự án khác' }, LUC_TAO))
        for (const d of [duAn, duAnKhac]) {
          if (d.id !== duAn.id) giaTri(await kho.themNguoiVaoDuAn(pm, d.id, { email: emailMoi('vt-binh') }))
          giaTri(await kho.themNguoiVaoDuAn(pm, d.id, { email: emailMoi('vt-chi-khac') }))
        }
        giaTri(
          await kho.taoTask(
            pm,
            duAnKhac.id,
            { tieuDe: 'Ở Dự án khác', nguoiThucHienId: binh.nguoiDungId, nguoiKiemTraId: chi.nguoiDungId },
            LUC_TAO,
          ),
        )
        expect((await nguoiTrongDuAn(pm, duAn, binh.nguoiDungId))?.soTaskDangGiu).toBe(0)
        expect((await nguoiTrongDuAn(pm, duAnKhac, binh.nguoiDungId))?.soTaskDangGiu).toBe(1)
        expect((await nguoiTrongDuAn(pm, duAnKhac, chi.nguoiDungId))?.soTaskDangGiu).toBe(0)
      })

      it('trả đủ: tên, email, vai hệ thống, Thông tin nhân sự đã áp quyền xem, Vai trò trong Dự án, số Task đang giữ', async () => {
        const { pm, duAn, binh } = await dungBoiCanh()
        const nhanSu = { soDienThoai: '0901234567', chucDanh: 'Kỹ sư', phongBan: 'Phòng Kỹ thuật' }
        giaTri(await kho.suaHoSo(binh, binh.nguoiDungId, nhanSu))
        giaTri(await kho.suaVaiTroTrongDuAn(pm, duAn.id, binh.nguoiDungId, { vaiTroTrongDuAn: 'Trưởng nhóm' }))
        const mongDoi: NguoiTrongDuAn = {
          id: binh.nguoiDungId,
          email: emailMoi('vt-binh'),
          tenHienThi: 'vt-binh',
          vai: 'THANH_VIEN',
          ...nhanSu,
          vaiTroTrongDuAn: 'Trưởng nhóm',
          soTaskDangGiu: 0,
        }
        // PM thấy đủ; người cùng Dự án (Thành viên) cũng thấy đủ (quyền xem Thông tin nhân sự).
        const chi = await dangKyVaDangNhap('vt-chi-xem')
        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('vt-chi-xem') }))
        expect(await nguoiTrongDuAn(pm, duAn, binh.nguoiDungId)).toEqual(mongDoi)
        expect(await nguoiTrongDuAn(chi, duAn, binh.nguoiDungId)).toEqual(mongDoi)
      })
    })
  })
}
