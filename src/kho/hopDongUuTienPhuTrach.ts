// Bộ test hợp đồng cho Mức ưu tiên của Dự án và Người phụ trách (ticket truong-moi 03): mức mặc định,
// mức sai, đặt và bỏ Người phụ trách (chỉ Người trong dự án), gỡ người làm Người phụ trách về trống,
// quyền, Lưu trữ, Dấu vết, và Người phụ trách không có thêm quyền nào. Tách khỏi `hopDong.ts` cho gọn;
// mọi bản cài gọi `chayHopDongUuTienPhuTrach` trong file `*.test.ts` của mình, với cùng `BanCaiHopDong`.
// Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`. Mã dùng trong các ca đều sinh từ `maDuAnMoi`.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import type { DuAn, KhoDuLieu, Phien } from './khoDuLieu'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import { THONG_BAO_MUC_UU_TIEN, type MucUuTien } from '../luat/mucUuTien'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
/** Đồng hồ truyền vào, không đọc giờ thật. */
const LUC_TAO = new Date('2026-04-10T09:30:00+07:00')
const LUC_SUA = new Date('2026-04-11T14:15:00+07:00')
const LUC_LUU_TRU = new Date('2026-04-12T08:00:00+07:00')
/** Id dạng uuid không thuộc tài khoản nào (bản cài dùng DB thật đòi id đúng dạng). */
const ID_KHONG_TON_TAI = '00000000-0000-4000-8000-000000000000'

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

export function chayHopDongUuTienPhuTrach(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn('UT')
  const dongHoCuaKho = tuyChon.dongHoCuaKho ?? false
  const coTask = tuyChon.coTask ?? true
  /** Ngày mong đợi trong dấu vết: đúng giờ truyền vào, hoặc chỉ là một ngày nếu kho tự lấy giờ. */
  const luc = (moc: Date): Date => (dongHoCuaKho ? expect.any(Date) : moc)

  describe(`Mức ưu tiên của Dự án và Người phụ trách (hợp đồng) — ${tenBanCai}`, () => {
    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    async function khoiTao() {
      banCai = await taoBanCai()
      kho = banCai.kho
    }

    async function dangKyVaDangNhap(ten: string, tenHienThi = ten): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
      giaTri(await banCai.xacNhanEmail(email))
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    async function taoPM(ten: string, tenHienThi = ten): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
      giaTri(await banCai.xacNhanEmail(email))
      await banCai.datVaiPM(email)
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    /** Người có vai `vai`, được `pm` thêm vào Dự án `duAn` nếu có. */
    async function taoNguoi(pm: Phien, ten: string, vai: VaiHeThong, duAn: DuAn | null, tenHienThi = ten): Promise<Phien> {
      const phien = await dangKyVaDangNhap(ten, tenHienThi)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai }))
      if (duAn) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi(ten) }))
      return phien
    }

    async function idCacDuAn(pm: Phien): Promise<string[]> {
      return giaTri(await kho.danhSachDuAn(pm))
        .map((d) => d.id)
        .sort()
    }

    describe('Mức ưu tiên', () => {
      it('tạo không chọn Mức ưu tiên thì là Trung bình; chọn Cao hay Thấp thì lưu đúng; đọc lại và danh sách thấy đúng', async () => {
        await khoiTao()
        const pm = await taoPM('pm-uu-tien-tao')
        const macDinh = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        expect(macDinh.mucUuTien).toBe('TRUNG_BINH')
        expect(giaTri(await kho.layDuAn(pm, macDinh.id))).toEqual(macDinh)

        for (const muc of ['CAO', 'THAP'] as const) {
          const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: `Mức ${muc}`, mucUuTien: muc }, LUC_TAO))
          expect(duAn.mucUuTien).toBe(muc)
          expect(giaTri(await kho.danhSachDuAn(pm)).find((d) => d.id === duAn.id)).toEqual(duAn)
        }
      })

      it('Mức ưu tiên ngoài ba giá trị: KHONG_HOP_LE kèm lỗi tiếng Việt ở ô Mức ưu tiên; tạo không tạo gì, sửa không đổi gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-uu-tien-sai')
        const truoc = await idCacDuAn(pm)
        for (const sai of ['KHAN_CAP', 'cao', '', null]) {
          const kq = await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Sai', mucUuTien: sai as unknown as MucUuTien }, LUC_TAO)
          expect(maLoi(kq), String(sai)).toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.loiTheoO?.mucUuTien).toBe(THONG_BAO_MUC_UU_TIEN.sai)
        }
        expect(await idCacDuAn(pm)).toEqual(truoc)

        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng', mucUuTien: 'CAO' }, LUC_TAO))
        const sua = await kho.suaDuAn(pm, duAn.id, { mucUuTien: 'GAP' as unknown as MucUuTien, ten: 'Không lưu' }, LUC_SUA)
        expect(maLoi(sua)).toBe('KHONG_HOP_LE')
        if (!sua.ok) expect(sua.loi.loiTheoO?.mucUuTien).toBe(THONG_BAO_MUC_UU_TIEN.sai)
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
      })

      it.each<{ vai: VaiHeThong; ten: string }>([
        { vai: 'PM', ten: 'PM' },
        { vai: 'SUPPORT', ten: 'Support của Dự án' },
      ])('$ten đổi Mức ưu tiên: lưu được; Dấu vết ghi người sửa và thời điểm, giữ người và ngày tạo', async ({ vai }) => {
        await khoiTao()
        const pm = await taoPM('pm-doi-uu-tien', 'An PM')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const nguoiSua =
          vai === 'PM'
            ? await taoNguoi(pm, 'pm-doi-uu-tien-khac', 'PM', null, 'Bình')
            : await taoNguoi(pm, 'support-doi-uu-tien', 'SUPPORT', duAn, 'Bình')
        const sua = giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { mucUuTien: 'CAO' }, LUC_SUA))
        expect(sua).toEqual({
          ...duAn,
          mucUuTien: 'CAO',
          dauVet: {
            taoBoi: duAn.dauVet.taoBoi,
            taoLuc: luc(LUC_TAO),
            suaBoi: { id: nguoiSua.nguoiDungId, tenHienThi: 'Bình' },
            suaLuc: luc(LUC_SUA),
          },
        })
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(sua)
        // Không gửi Mức ưu tiên thì giữ nguyên.
        expect(giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { ten: 'Cửa hàng mới' }, LUC_SUA)).mucUuTien).toBe('CAO')
      })

      it('Thành viên (kể cả trong Dự án) và Support ngoài Dự án: KHONG_CO_QUYEN; Dự án đã Lưu trữ: DU_AN_DA_LUU_TRU; không đổi gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-quyen-uu-tien')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const thanhVien = await taoNguoi(pm, 'tv-uu-tien', 'THANH_VIEN', duAn)
        const supportNgoai = await taoNguoi(pm, 'support-ngoai-uu-tien', 'SUPPORT', null)
        const support = await taoNguoi(pm, 'support-trong-uu-tien', 'SUPPORT', duAn)
        for (const phien of [thanhVien, supportNgoai]) {
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { mucUuTien: 'CAO' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)

        const daLuu = giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC_LUU_TRU))
        for (const phien of [pm, support]) {
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { mucUuTien: 'THAP' }, LUC_SUA))).toBe('DU_AN_DA_LUU_TRU')
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(daLuu)
      })
    })

    describe('Người phụ trách', () => {
      it('Dự án mới chưa có Người phụ trách', async () => {
        await khoiTao()
        const pm = await taoPM('pm-phu-trach-moi')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        expect(duAn.nguoiPhuTrach).toBeNull()
        expect(giaTri(await kho.layDuAn(pm, duAn.id)).nguoiPhuTrach).toBeNull()
      })

      it.each<{ vai: VaiHeThong; ten: string }>([
        { vai: 'PM', ten: 'PM' },
        { vai: 'SUPPORT', ten: 'Support của Dự án' },
      ])(
        '$ten đặt một Người trong dự án làm Người phụ trách: thành công, kèm tên hiển thị; Dấu vết cập nhật; bỏ (trống hay null) thì về trống',
        async ({ vai }) => {
          await khoiTao()
          const pm = await taoPM('pm-dat-phu-trach', 'An PM')
          const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
          const nguoiSua =
            vai === 'PM'
              ? await taoNguoi(pm, 'pm-dat-phu-trach-khac', 'PM', null, 'Bình')
              : await taoNguoi(pm, 'support-dat-phu-trach', 'SUPPORT', duAn, 'Bình')
          const chi = await taoNguoi(pm, 'chi-phu-trach', 'THANH_VIEN', duAn, 'Chi')

          const sua = giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { nguoiPhuTrachId: chi.nguoiDungId }, LUC_SUA))
          expect(sua).toEqual({
            ...duAn,
            nguoiPhuTrach: { id: chi.nguoiDungId, tenHienThi: 'Chi' },
            dauVet: {
              taoBoi: duAn.dauVet.taoBoi,
              taoLuc: luc(LUC_TAO),
              suaBoi: { id: nguoiSua.nguoiDungId, tenHienThi: 'Bình' },
              suaLuc: luc(LUC_SUA),
            },
          })
          expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(sua)
          expect(giaTri(await kho.danhSachDuAn(pm)).find((d) => d.id === duAn.id)).toEqual(sua)
          // Người phụ trách cũng thấy chính mình được ghi.
          expect(giaTri(await kho.layDuAn(chi, duAn.id)).nguoiPhuTrach).toEqual({ id: chi.nguoiDungId, tenHienThi: 'Chi' })

          // Không gửi ô Người phụ trách thì giữ nguyên.
          expect(giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { mucUuTien: 'CAO' }, LUC_SUA)).nguoiPhuTrach?.id).toBe(
            chi.nguoiDungId,
          )
          expect(giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { nguoiPhuTrachId: null }, LUC_SUA)).nguoiPhuTrach).toBeNull()
          giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { nguoiPhuTrachId: chi.nguoiDungId }, LUC_SUA))
          expect(giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { nguoiPhuTrachId: '' }, LUC_SUA)).nguoiPhuTrach).toBeNull()
          expect(giaTri(await kho.layDuAn(pm, duAn.id)).nguoiPhuTrach).toBeNull()
        },
      )

      it('đặt người ngoài Dự án (đã đăng ký nhưng chưa thêm, PM không ở trong Dự án, id không tồn tại): NGUOI_NGOAI_DU_AN kèm lỗi ở ô Người phụ trách, không đổi gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-phu-trach-ngoai')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const ngoai = await dangKyVaDangNhap('nguoi-ngoai-phu-trach')
        for (const id of [ngoai.nguoiDungId, pm.nguoiDungId, ID_KHONG_TON_TAI]) {
          const kq = await kho.suaDuAn(pm, duAn.id, { nguoiPhuTrachId: id, ten: 'Không được lưu', mucUuTien: 'CAO' }, LUC_SUA)
          expect(maLoi(kq), id).toBe('NGUOI_NGOAI_DU_AN')
          if (!kq.ok) {
            expect(kq.loi.thongBao).toBe(THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn)
            expect(kq.loi.loiTheoO?.nguoiPhuTrachId).toBe(THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn)
          }
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)

        // Người đã bị gỡ khỏi Dự án cũng là người ngoài.
        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('nguoi-ngoai-phu-trach') }))
        giaTri(await kho.goNguoiKhoiDuAn(pm, duAn.id, ngoai.nguoiDungId))
        expect(maLoi(await kho.suaDuAn(pm, duAn.id, { nguoiPhuTrachId: ngoai.nguoiDungId }, LUC_SUA))).toBe(
          'NGUOI_NGOAI_DU_AN',
        )
      })

      it('gỡ Người phụ trách khỏi Dự án: Người phụ trách về trống ngay; gỡ người khác thì giữ nguyên; thêm lại người đó vẫn trống', async () => {
        await khoiTao()
        const pm = await taoPM('pm-go-phu-trach')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const chi = await taoNguoi(pm, 'chi-go-phu-trach', 'THANH_VIEN', duAn, 'Chi')
        const dung = await taoNguoi(pm, 'dung-go-phu-trach', 'THANH_VIEN', duAn, 'Dũng')
        giaTri(await kho.suaDuAn(pm, duAn.id, { nguoiPhuTrachId: chi.nguoiDungId }, LUC_SUA))

        giaTri(await kho.goNguoiKhoiDuAn(pm, duAn.id, dung.nguoiDungId))
        expect(giaTri(await kho.layDuAn(pm, duAn.id)).nguoiPhuTrach?.id).toBe(chi.nguoiDungId)

        giaTri(await kho.goNguoiKhoiDuAn(pm, duAn.id, chi.nguoiDungId))
        expect(giaTri(await kho.layDuAn(pm, duAn.id)).nguoiPhuTrach).toBeNull()
        expect(giaTri(await kho.danhSachDuAn(pm)).find((d) => d.id === duAn.id)?.nguoiPhuTrach).toBeNull()

        giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi('chi-go-phu-trach') }))
        expect(giaTri(await kho.layDuAn(pm, duAn.id)).nguoiPhuTrach).toBeNull()
      })

      it('Thành viên (kể cả trong Dự án) và Support ngoài Dự án: KHONG_CO_QUYEN; Dự án đã Lưu trữ: DU_AN_DA_LUU_TRU; không đổi gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-quyen-phu-trach')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const thanhVien = await taoNguoi(pm, 'tv-quyen-phu-trach', 'THANH_VIEN', duAn)
        const supportNgoai = await taoNguoi(pm, 'support-ngoai-phu-trach', 'SUPPORT', null)
        const support = await taoNguoi(pm, 'support-trong-phu-trach', 'SUPPORT', duAn)
        for (const phien of [thanhVien, supportNgoai]) {
          const kq = await kho.suaDuAn(phien, duAn.id, { nguoiPhuTrachId: thanhVien.nguoiDungId }, LUC_SUA)
          expect(maLoi(kq)).toBe('KHONG_CO_QUYEN')
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)

        const daLuu = giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC_LUU_TRU))
        for (const phien of [pm, support]) {
          const kq = await kho.suaDuAn(phien, duAn.id, { nguoiPhuTrachId: thanhVien.nguoiDungId }, LUC_SUA)
          expect(maLoi(kq)).toBe('DU_AN_DA_LUU_TRU')
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(daLuu)
      })

      it('Thành viên là Người phụ trách không làm thêm được việc gì trước đó bị từ chối (sửa Dự án, Lưu trữ, thêm và gỡ người, gắn repo, tạo và sửa Task)', async () => {
        await khoiTao()
        const pm = await taoPM('pm-khong-them-quyen')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const tv = await taoNguoi(pm, 'tv-phu-trach', 'THANH_VIEN', duAn, 'Chi')
        const khac = await taoNguoi(pm, 'nguoi-khac-phu-trach', 'THANH_VIEN', duAn, 'Dũng')
        const moi = await dangKyVaDangNhap('nguoi-moi-phu-trach')
        const taskId = coTask
          ? giaTri(
              await kho.taoTask(
                pm,
                duAn.id,
                { tieuDe: 'Task có sẵn', nguoiThucHienId: khac.nguoiDungId, nguoiKiemTraId: tv.nguoiDungId },
                LUC_TAO,
              ),
            ).id
          : null

        /** Mọi việc ghi mà Thành viên không được làm, chạy bằng phiên của `tv`; trả mã từng việc. */
        async function thuCacViec(): Promise<Record<string, MaLoi | 'THANH_CONG'>> {
          const ketQua: Record<string, MaLoi | 'THANH_CONG'> = {
            suaDuAn: maLoi(await kho.suaDuAn(tv, duAn.id, { ten: 'Tên mới' }, LUC_SUA)),
            datLaiNguoiPhuTrach: maLoi(await kho.suaDuAn(tv, duAn.id, { nguoiPhuTrachId: khac.nguoiDungId }, LUC_SUA)),
            luuTru: maLoi(await kho.luuTruDuAn(tv, duAn.id, LUC_SUA)),
            themNguoi: maLoi(await kho.themNguoiVaoDuAn(tv, duAn.id, { email: emailMoi('nguoi-moi-phu-trach') })),
            goNguoi: maLoi(await kho.goNguoiKhoiDuAn(tv, duAn.id, khac.nguoiDungId)),
            ganRepo: maLoi(await kho.ganRepoVaoDuAn(tv, duAn.id, { repo: 'chu-so-huu/ten-repo' })),
          }
          if (taskId !== null) {
            ketQua.taoTask = maLoi(
              await kho.taoTask(
                tv,
                duAn.id,
                { tieuDe: 'Task mới', nguoiThucHienId: khac.nguoiDungId, nguoiKiemTraId: tv.nguoiDungId },
                LUC_SUA,
              ),
            )
            ketQua.suaTask = maLoi(await kho.suaTask(tv, taskId, { tieuDe: 'Tiêu đề mới' }, LUC_SUA))
            ketQua.doiNguoiTask = maLoi(
              await kho.doiNguoiTask(tv, taskId, { nguoiThucHienId: tv.nguoiDungId, nguoiKiemTraId: khac.nguoiDungId }, LUC_SUA),
            )
            ketQua.xemTaskNguoiDangGiu = maLoi(await kho.danhSachTaskNguoiDangGiu(tv, duAn.id, khac.nguoiDungId))
          }
          return ketQua
        }

        const truoc = await thuCacViec()
        for (const [viec, ma] of Object.entries(truoc)) expect(ma, viec).toBe('KHONG_CO_QUYEN')

        const coPhuTrach = giaTri(await kho.suaDuAn(pm, duAn.id, { nguoiPhuTrachId: tv.nguoiDungId }, LUC_SUA))
        expect(coPhuTrach.nguoiPhuTrach?.id).toBe(tv.nguoiDungId)
        expect(await thuCacViec()).toEqual(truoc)
        // Không việc nào lọt qua: Dự án, người trong dự án và Task như cũ; người mới vẫn ở ngoài.
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(coPhuTrach)
        expect(
          giaTri(await kho.danhSachNguoiTrongDuAn(pm, duAn.id))
            .map((n) => n.id)
            .includes(moi.nguoiDungId),
        ).toBe(false)
        if (coTask) expect(giaTri(await kho.danhSachTask(pm, duAn.id))).toHaveLength(1)
      })
    })
  })
}
