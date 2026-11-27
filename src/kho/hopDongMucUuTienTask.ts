// Bộ test hợp đồng cho Mức ưu tiên của Task (ticket truong-moi 04): mức mặc định khi tạo, mức sai, đổi mức
// theo đúng quyền sửa Task, dòng lịch sử đổi mức (cùng dòng thời gian với lịch sử trạng thái), đổi sang
// đúng mức đang có thì không ghi, và mức hiện ở mọi chỗ đọc Task. Tách khỏi `hopDong.ts` cho gọn; mọi bản
// cài gọi `chayHopDongMucUuTienTask` trong file `*.test.ts` của mình, với cùng `BanCaiHopDong`.
// Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`. Task đã chốt được dựng bằng chính vòng duyệt.
import { beforeEach, describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import type { KhoDuLieu, Phien, Task } from './khoDuLieu'
import { THONG_BAO_MUC_UU_TIEN, type MucUuTien } from '../luat/mucUuTien'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
/** Đồng hồ truyền vào, không đọc giờ thật. */
const LUC_TAO_DU_AN = new Date('2026-04-10T09:30:00+07:00')
const LUC_TAO_TASK = new Date('2026-04-10T12:30:00+07:00')
const LUC_DOI = new Date('2026-04-12T08:15:00+07:00')
const LUC_LUU_TRU = new Date('2026-04-13T08:00:00+07:00')
const gio = (phut: number) => new Date(LUC_DOI.getTime() + phut * 60_000)

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

export function chayHopDongMucUuTienTask(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn('UTT')
  const dongHoCuaKho = tuyChon.dongHoCuaKho ?? false
  const coTask = tuyChon.coTask ?? true
  /** Ngày mong đợi: đúng giờ truyền vào, hoặc chỉ là một ngày nếu kho tự lấy giờ. */
  const luc = (moc: Date): Date => (dongHoCuaKho ? expect.any(Date) : moc)

  describe.skipIf(!coTask)(`Mức ưu tiên của Task (hợp đồng) — ${tenBanCai}`, () => {
    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    beforeEach(async () => {
      banCai = await taoBanCai()
      kho = banCai.kho
    })

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

    interface BoiCanh {
      pm: Phien
      duAnId: string
      /** Người thực hiện của Task có sẵn, vai Thành viên. */
      an: Phien
      /** Người kiểm tra của Task có sẵn, vai Thành viên. */
      binh: Phien
      /** Thành viên trong Dự án, không giữ Task nào. */
      chi: Phien
      /** Support của Dự án. */
      support: Phien
      /** Support không ở trong Dự án. */
      supportNgoai: Phien
      /** Task có sẵn, tạo không chọn Mức ưu tiên: An làm, Bình duyệt. */
      task: Task
    }

    /** Thêm người có vai `vai` vào Dự án `duAnId` (nếu có). */
    async function taoNguoi(pm: Phien, ten: string, tenHienThi: string, vai: VaiHeThong, duAnId: string | null) {
      const phien = await dangKyVaDangNhap(ten, tenHienThi)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai }))
      if (duAnId) giaTri(await kho.themNguoiVaoDuAn(pm, duAnId, { email: emailMoi(ten) }))
      return phien
    }

    async function dungBoiCanh(ten = 'utt'): Promise<BoiCanh> {
      const pm = await taoPM(`pm-${ten}`, 'An PM')
      const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO_DU_AN))
      const an = await taoNguoi(pm, `an-${ten}`, 'An', 'THANH_VIEN', duAn.id)
      const binh = await taoNguoi(pm, `binh-${ten}`, 'Bình', 'THANH_VIEN', duAn.id)
      const chi = await taoNguoi(pm, `chi-${ten}`, 'Chi', 'THANH_VIEN', duAn.id)
      const support = await taoNguoi(pm, `support-${ten}`, 'Lan', 'SUPPORT', duAn.id)
      const supportNgoai = await taoNguoi(pm, `support-ngoai-${ten}`, 'Dũng', 'SUPPORT', null)
      const task = giaTri(
        await kho.taoTask(
          pm,
          duAn.id,
          { tieuDe: 'Làm trang chủ', nguoiThucHienId: an.nguoiDungId, nguoiKiemTraId: binh.nguoiDungId },
          LUC_TAO_TASK,
        ),
      )
      return { pm, duAnId: duAn.id, an, binh, chi, support, supportNgoai, task }
    }

    async function taoTaskMuc(bc: BoiCanh, tieuDe: string, mucUuTien?: MucUuTien): Promise<KetQua<Task>> {
      return kho.taoTask(
        bc.pm,
        bc.duAnId,
        {
          tieuDe,
          ...(mucUuTien !== undefined ? { mucUuTien } : {}),
          nguoiThucHienId: bc.an.nguoiDungId,
          nguoiKiemTraId: bc.binh.nguoiDungId,
        },
        LUC_TAO_TASK,
      )
    }

    async function chupLai(bc: BoiCanh) {
      return {
        task: giaTri(await kho.layTask(bc.pm, bc.task.id)),
        lichSu: giaTri(await kho.lichSuTask(bc.pm, bc.task.id)),
      }
    }

    describe('tạo Task', () => {
      it('không chọn Mức ưu tiên thì là Trung bình; tạo với Cao hay Thấp thì lưu đúng; đọc lại thấy đúng', async () => {
        const bc = await dungBoiCanh()
        expect(bc.task.mucUuTien).toBe('TRUNG_BINH')
        expect(giaTri(await kho.layTask(bc.pm, bc.task.id)).mucUuTien).toBe('TRUNG_BINH')

        for (const muc of ['CAO', 'THAP'] as const) {
          const task = giaTri(await taoTaskMuc(bc, `Mức ${muc}`, muc))
          expect(task.mucUuTien).toBe(muc)
          expect(giaTri(await kho.layTask(bc.an, task.id)).mucUuTien).toBe(muc)
          expect(giaTri(await kho.danhSachTask(bc.chi, bc.duAnId)).find((t) => t.id === task.id)?.mucUuTien).toBe(muc)
        }
        // Task mới tạo chưa có dòng lịch sử nào, kể cả khi chọn mức khác Trung bình.
        const cao = giaTri(await taoTaskMuc(bc, 'Cao nữa', 'CAO'))
        expect(giaTri(await kho.lichSuTask(bc.pm, cao.id))).toEqual([])
      })

      it('Mức ưu tiên ngoài ba giá trị: KHONG_HOP_LE kèm lỗi tiếng Việt ở ô Mức ưu tiên; không tạo gì', async () => {
        const bc = await dungBoiCanh()
        const truoc = giaTri(await kho.danhSachTask(bc.pm, bc.duAnId)).map((t) => t.id)
        for (const sai of ['KHAN_CAP', 'cao', '', null]) {
          const kq = await taoTaskMuc(bc, 'Sai', sai as unknown as MucUuTien)
          expect(maLoi(kq), String(sai)).toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.loiTheoO?.mucUuTien).toBe(THONG_BAO_MUC_UU_TIEN.sai)
        }
        expect(giaTri(await kho.danhSachTask(bc.pm, bc.duAnId)).map((t) => t.id)).toEqual(truoc)
      })

      it('Mức ưu tiên có ở "Việc của tôi" và "Chờ tôi duyệt"', async () => {
        const bc = await dungBoiCanh()
        const cao = giaTri(await taoTaskMuc(bc, 'Gấp', 'CAO'))
        giaTri(await kho.doiTrangThaiTask(bc.an, cao.id, { sang: 'DANG_LAM' }, gio(1)))
        giaTri(await kho.doiTrangThaiTask(bc.an, cao.id, { sang: 'CHO_DUYET' }, gio(2)))
        const viec = giaTri(await kho.viecCuaToi(bc.an))
        expect(viec.find((t) => t.id === cao.id)?.mucUuTien).toBe('CAO')
        expect(viec.find((t) => t.id === bc.task.id)?.mucUuTien).toBe('TRUNG_BINH')
        expect(giaTri(await kho.choToiDuyet(bc.binh)).map((t) => [t.id, t.mucUuTien])).toEqual([[cao.id, 'CAO']])
      })
    })

    describe('đổi Mức ưu tiên', () => {
      it.each<{ ten: string; ai: (bc: BoiCanh) => Phien; tenHienThi: string }>([
        { ten: 'PM', ai: (bc) => bc.pm, tenHienThi: 'An PM' },
        { ten: 'Support của Dự án', ai: (bc) => bc.support, tenHienThi: 'Lan' },
      ])(
        '$ten đổi được: mức mới đọc lại thấy; Dấu vết cập nhật; một dòng lịch sử có người đổi, thời điểm, mức cũ, mức mới',
        async ({ ai, tenHienThi }) => {
          const bc = await dungBoiCanh()
          const nguoi = ai(bc)
          const moi = giaTri(await kho.suaTask(nguoi, bc.task.id, { mucUuTien: 'CAO' }, LUC_DOI))
          expect(moi).toEqual({
            ...bc.task,
            mucUuTien: 'CAO',
            dauVet: { ...bc.task.dauVet, suaBoi: { id: nguoi.nguoiDungId, tenHienThi }, suaLuc: luc(LUC_DOI) },
          })
          expect(giaTri(await kho.layTask(bc.chi, bc.task.id))).toEqual(moi)
          // Ai thấy Dự án cũng thấy dòng lịch sử, kể cả Thành viên không giữ Task.
          expect(giaTri(await kho.lichSuTask(bc.chi, bc.task.id))).toEqual([
            {
              loai: 'MUC_UU_TIEN',
              nguoiDoi: { id: nguoi.nguoiDungId, tenHienThi },
              luc: luc(LUC_DOI),
              tu: 'TRUNG_BINH',
              sang: 'CAO',
            },
          ])
        },
      )

      it('đổi sang đúng mức đang có: thành công nhưng không ghi dòng lịch sử nào; sửa không gửi Mức ưu tiên thì mức giữ nguyên, không ghi', async () => {
        const bc = await dungBoiCanh()
        expect(giaTri(await kho.suaTask(bc.pm, bc.task.id, { mucUuTien: 'TRUNG_BINH' }, LUC_DOI)).mucUuTien).toBe('TRUNG_BINH')
        expect(giaTri(await kho.lichSuTask(bc.pm, bc.task.id))).toEqual([])

        giaTri(await kho.suaTask(bc.pm, bc.task.id, { mucUuTien: 'THAP' }, gio(1)))
        giaTri(await kho.suaTask(bc.pm, bc.task.id, { mucUuTien: 'THAP' }, gio(2)))
        const sua = giaTri(await kho.suaTask(bc.pm, bc.task.id, { tieuDe: 'Làm trang chủ mới' }, gio(3)))
        expect(sua.mucUuTien).toBe('THAP')
        const ls = giaTri(await kho.lichSuTask(bc.pm, bc.task.id))
        expect(ls).toHaveLength(1)
        expect(ls[0]).toMatchObject({ loai: 'MUC_UU_TIEN', tu: 'TRUNG_BINH', sang: 'THAP' })
      })

      it('Mức ưu tiên sai khi sửa: KHONG_HOP_LE kèm lỗi ở ô Mức ưu tiên; không đổi gì, không ghi lịch sử', async () => {
        const bc = await dungBoiCanh()
        const truoc = await chupLai(bc)
        for (const sai of ['GAP', 'Cao', '', null]) {
          const kq = await kho.suaTask(bc.pm, bc.task.id, { mucUuTien: sai as unknown as MucUuTien, tieuDe: 'Không lưu' }, LUC_DOI)
          expect(maLoi(kq), String(sai)).toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.loiTheoO?.mucUuTien).toBe(THONG_BAO_MUC_UU_TIEN.sai)
        }
        expect(await chupLai(bc)).toEqual(truoc)
      })

      it('Thành viên (Người thực hiện, Người kiểm tra, người khác trong Dự án) và Support ngoài Dự án: KHONG_CO_QUYEN; không đổi gì, không ghi lịch sử', async () => {
        const bc = await dungBoiCanh()
        const truoc = await chupLai(bc)
        for (const phien of [bc.an, bc.binh, bc.chi, bc.supportNgoai]) {
          expect(maLoi(await kho.suaTask(phien, bc.task.id, { mucUuTien: 'CAO' }, LUC_DOI))).toBe('KHONG_CO_QUYEN')
        }
        expect(await chupLai(bc)).toEqual(truoc)
      })

      it('Task đã Hoàn thành hoặc Huỷ: TASK_DA_CHOT, kể cả với PM và Support; không đổi gì, không ghi thêm lịch sử', async () => {
        const bc = await dungBoiCanh()
        // Hoàn thành bằng chính vòng duyệt.
        giaTri(await kho.doiTrangThaiTask(bc.an, bc.task.id, { sang: 'DANG_LAM' }, gio(1)))
        giaTri(await kho.doiTrangThaiTask(bc.an, bc.task.id, { sang: 'CHO_DUYET' }, gio(2)))
        giaTri(await kho.doiTrangThaiTask(bc.binh, bc.task.id, { sang: 'HOAN_THANH' }, gio(3)))
        const huy = giaTri(await taoTaskMuc(bc, 'Sẽ huỷ', 'THAP'))
        giaTri(await kho.doiTrangThaiTask(bc.pm, huy.id, { sang: 'HUY', lyDo: 'Không cần nữa' }, gio(4)))

        for (const taskId of [bc.task.id, huy.id]) {
          const truoc = {
            task: giaTri(await kho.layTask(bc.pm, taskId)),
            lichSu: giaTri(await kho.lichSuTask(bc.pm, taskId)),
          }
          for (const phien of [bc.pm, bc.support]) {
            expect(maLoi(await kho.suaTask(phien, taskId, { mucUuTien: 'CAO' }, gio(5)))).toBe('TASK_DA_CHOT')
          }
          expect({
            task: giaTri(await kho.layTask(bc.pm, taskId)),
            lichSu: giaTri(await kho.lichSuTask(bc.pm, taskId)),
          }).toEqual(truoc)
        }
      })

      it('Dự án đã Lưu trữ: PM và Support của Dự án nhận DU_AN_DA_LUU_TRU, Thành viên vẫn KHONG_CO_QUYEN; không đổi gì', async () => {
        const bc = await dungBoiCanh()
        giaTri(await kho.luuTruDuAn(bc.pm, bc.duAnId, LUC_LUU_TRU))
        const truoc = await chupLai(bc)
        for (const phien of [bc.pm, bc.support]) {
          expect(maLoi(await kho.suaTask(phien, bc.task.id, { mucUuTien: 'CAO' }, LUC_DOI))).toBe('DU_AN_DA_LUU_TRU')
        }
        expect(maLoi(await kho.suaTask(bc.an, bc.task.id, { mucUuTien: 'CAO' }, LUC_DOI))).toBe('KHONG_CO_QUYEN')
        expect(await chupLai(bc)).toEqual(truoc)
      })
    })

    describe('lịch sử chung với trạng thái', () => {
      it('dòng đổi mức và dòng đổi trạng thái nằm cùng một dòng thời gian, theo thời điểm; dòng trạng thái giữ nguyên lý do và bộ đếm Trả lại', async () => {
        const bc = await dungBoiCanh()
        giaTri(await kho.doiTrangThaiTask(bc.an, bc.task.id, { sang: 'DANG_LAM' }, gio(1)))
        giaTri(await kho.suaTask(bc.support, bc.task.id, { mucUuTien: 'CAO' }, gio(2)))
        giaTri(await kho.doiTrangThaiTask(bc.an, bc.task.id, { sang: 'CHO_DUYET' }, gio(3)))
        giaTri(await kho.doiTrangThaiTask(bc.binh, bc.task.id, { sang: 'TRA_LAI', lyDo: 'Thiếu ảnh' }, gio(4)))
        giaTri(await kho.suaTask(bc.pm, bc.task.id, { mucUuTien: 'THAP' }, gio(5)))

        const ls = giaTri(await kho.lichSuTask(bc.pm, bc.task.id))
        expect(ls).toEqual([
          { loai: 'TRANG_THAI', nguoiDoi: { id: bc.an.nguoiDungId, tenHienThi: 'An' }, luc: luc(gio(1)), tu: 'MOI', sang: 'DANG_LAM', lyDo: null },
          { loai: 'MUC_UU_TIEN', nguoiDoi: { id: bc.support.nguoiDungId, tenHienThi: 'Lan' }, luc: luc(gio(2)), tu: 'TRUNG_BINH', sang: 'CAO' },
          { loai: 'TRANG_THAI', nguoiDoi: { id: bc.an.nguoiDungId, tenHienThi: 'An' }, luc: luc(gio(3)), tu: 'DANG_LAM', sang: 'CHO_DUYET', lyDo: null },
          {
            loai: 'TRANG_THAI',
            nguoiDoi: { id: bc.binh.nguoiDungId, tenHienThi: 'Bình' },
            luc: luc(gio(4)),
            tu: 'CHO_DUYET',
            sang: 'TRA_LAI',
            lyDo: 'Thiếu ảnh',
          },
          { loai: 'MUC_UU_TIEN', nguoiDoi: { id: bc.pm.nguoiDungId, tenHienThi: 'An PM' }, luc: luc(gio(5)), tu: 'CAO', sang: 'THAP' },
        ])
        const task = giaTri(await kho.layTask(bc.pm, bc.task.id))
        expect(task.trangThai).toBe('TRA_LAI')
        expect(task.soLanTraLai).toBe(1)
        expect(task.mucUuTien).toBe('THAP')
      })

      it.skipIf(dongHoCuaKho)('dòng đổi mức xếp theo thời điểm truyền vào, không theo thứ tự gọi', async () => {
        const bc = await dungBoiCanh()
        giaTri(await kho.doiTrangThaiTask(bc.an, bc.task.id, { sang: 'DANG_LAM' }, gio(10)))
        giaTri(await kho.suaTask(bc.pm, bc.task.id, { mucUuTien: 'CAO' }, gio(5)))
        const ls = giaTri(await kho.lichSuTask(bc.pm, bc.task.id))
        expect(ls.map((d) => d.loai)).toEqual(['MUC_UU_TIEN', 'TRANG_THAI'])
      })
    })
  })
}
