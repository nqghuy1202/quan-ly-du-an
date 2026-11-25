// Bộ test hợp đồng của link issue hoặc PR trên Task (ticket 16): thêm, gỡ, xem link và dấu vết chỉnh
// sửa. Tách khỏi `hopDong.ts` cho gọn; mọi bản cài gọi `chayHopDongLienKet` trong file `*.test.ts`
// của mình, với cùng `BanCaiHopDong`. Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import type { BanCaiHopDong, TuyChonHopDong } from './hopDong'
import type { DuAn, KhoDuLieu, Phien, Task } from './khoDuLieu'
import { THONG_BAO_LIEN_KET } from '../luat/github'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import { CAC_VAI, type VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
const LUC_TAO = new Date('2026-04-10T09:30:00+07:00')
const LUC_THEM = new Date('2026-04-11T14:00:00+07:00')
const LUC_GO = new Date('2026-04-12T16:45:00+07:00')

const ISSUE_12 = 'https://github.com/acme/web/issues/12'
const PR_34 = 'https://github.com/acme/web/pull/34'

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

export function chayHopDongLienKet(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)

  describe(`Link issue hoặc PR trên Task (hợp đồng) — ${tenBanCai}`, () => {
    if (tuyChon.coTask === false) {
      it.skip('CHƯA KIỂM: bản cài chưa có Task và link GitHub (ticket 17 cài và chạy chayHopDongLienKet)', () => {})
      return
    }

    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    async function khoiTao() {
      banCai = await taoBanCai()
      kho = banCai.kho
    }

    async function dangKyVaDangNhap(ten: string): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
      giaTri(await banCai.xacNhanEmail(email))
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    async function taoPM(ten: string): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
      giaTri(await banCai.xacNhanEmail(email))
      await banCai.datVaiPM(email)
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    /** Người có vai `vai`, được `pm` thêm vào Dự án nếu `trongDuAn`. */
    async function taoNguoi(pm: Phien, duAn: DuAn, ten: string, vai: VaiHeThong, trongDuAn: boolean): Promise<Phien> {
      const phien = await dangKyVaDangNhap(ten)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai }))
      if (trongDuAn) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi(ten) }))
      return phien
    }

    interface BoiCanh {
      pm: Phien
      duAn: DuAn
      task: Task
      /** Thành viên trong Dự án (người thực hiện của Task). */
      tv: Phien
      /** Thành viên trong Dự án (người kiểm tra của Task). */
      kiem: Phien
    }

    /** Dự án có gắn repo `acme/web`, một Task (thành viên `tv` làm, `kiem` duyệt) và PM `pm`. */
    async function dungBoiCanh(hau: string, cacRepo: string[] = ['acme/web']): Promise<BoiCanh> {
      const pm = await taoPM(`pm-${hau}`)
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC_TAO))
      for (const repo of cacRepo) giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo }))
      const tv = await taoNguoi(pm, duAn, `tv-${hau}`, 'THANH_VIEN', true)
      const kiem = await taoNguoi(pm, duAn, `kiem-${hau}`, 'THANH_VIEN', true)
      const task = giaTri(
        await kho.taoTask(
          pm,
          duAn.id,
          { tieuDe: 'Làm trang chủ', nguoiThucHienId: tv.nguoiDungId, nguoiKiemTraId: kiem.nguoiDungId },
          LUC_TAO,
        ),
      )
      return { pm, duAn, task, tv, kiem }
    }

    /** Các link của Task dưới dạng chuỗi `loai#so@repo`, đã xếp, cho dễ so sánh. */
    async function cacLienKet(phien: Phien, taskId: string): Promise<string[]> {
      return giaTri(await kho.danhSachLienKetCuaTask(phien, taskId)).map((l) => `${l.loai}#${l.so}@${l.repo}`)
    }

    it('dán link hợp lệ thuộc repo đã gắn thì link được lưu vào Task, kèm đường dẫn chuẩn', async () => {
      await khoiTao()
      const { pm, task } = await dungBoiCanh('luu')
      expect(await cacLienKet(pm, task.id)).toEqual([])

      expect(giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan: ISSUE_12 }, LUC_THEM))).toEqual({
        repo: 'acme/web',
        loai: 'ISSUE',
        so: 12,
        duongDan: ISSUE_12,
      })
      // Bỏ khoảng trắng, dấu / cuối, phần ?... và #...; tên repo không phân biệt hoa thường khi so với repo đã gắn.
      expect(giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan: `  https://github.com/Acme/Web/pull/34/?tab=files#diff  ` }, LUC_THEM))).toEqual({
        repo: 'Acme/Web',
        loai: 'PR',
        so: 34,
        duongDan: 'https://github.com/Acme/Web/pull/34',
      })
      expect(await cacLienKet(pm, task.id)).toEqual(['ISSUE#12@acme/web', 'PR#34@Acme/Web'])
    })

    it('link không hợp lệ trả LINK_KHONG_HOP_LE kèm lỗi ở ô duongDan, không lưu gì', async () => {
      await khoiTao()
      const { pm, task } = await dungBoiCanh('sai')
      const sai = [
        '',
        '   ',
        'khong-phai-link',
        'acme/web#12',
        'https://example.com/acme/web/issues/12',
        'https://github.com/acme/web',
        'https://github.com/acme/web/issues',
        'https://github.com/acme/web/issues/abc',
        'https://github.com/acme/web/issues/0',
        'https://github.com/acme/web/issues/-3',
        'https://github.com/acme/web/pulls/34',
        'https://github.com/acme/web/commit/abc123',
        'https://github.com/acme/web/issues/12/comments',
        'ftp://github.com/acme/web/issues/12',
        'https://github.com.evil.vn/acme/web/issues/12',
        'https://nguoi:matkhau@github.com/acme/web/issues/12',
      ]
      for (const duongDan of sai) {
        const kq = await kho.themLienKetVaoTask(pm, task.id, { duongDan }, LUC_THEM)
        expect(maLoi(kq), `"${duongDan}"`).toBe('LINK_KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.duongDan).toBe(THONG_BAO_LIEN_KET.sai)
      }
      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, {} as { duongDan: string }, LUC_THEM))).toBe('LINK_KHONG_HOP_LE')
      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, { duongDan: 12 } as unknown as { duongDan: string }, LUC_THEM))).toBe('LINK_KHONG_HOP_LE')
      expect(await cacLienKet(pm, task.id)).toEqual([])
    })

    it('link thuộc repo chưa gắn vào Dự án trả LINK_REPO_CHUA_GAN, kể cả repo chỉ gắn ở Dự án khác; gắn xong thì dán được', async () => {
      await khoiTao()
      const { pm, task } = await dungBoiCanh('chua-gan')
      const khac = giaTri(await kho.taoDuAn(pm, { ten: 'Dự án khác' }, LUC_TAO))
      giaTri(await kho.ganRepoVaoDuAn(pm, khac.id, { repo: 'acme/api' }))

      for (const duongDan of ['https://github.com/acme/api/issues/1', 'https://github.com/nguoi-la/repo/pull/2']) {
        const kq = await kho.themLienKetVaoTask(pm, task.id, { duongDan }, LUC_THEM)
        expect(maLoi(kq), duongDan).toBe('LINK_REPO_CHUA_GAN')
        if (!kq.ok) expect(kq.loi.loiTheoO?.duongDan).toBe(THONG_BAO_LIEN_KET.chuaGan)
      }
      expect(await cacLienKet(pm, task.id)).toEqual([])

      giaTri(await kho.ganRepoVaoDuAn(pm, task.duAnId, { repo: 'acme/api' }))
      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, { duongDan: 'https://github.com/acme/api/issues/1' }, LUC_THEM))).toBe('THANH_CONG')
    })

    it('link sai định dạng được báo trước link repo chưa gắn', async () => {
      await khoiTao()
      const { pm, task } = await dungBoiCanh('thu-tu')
      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, { duongDan: 'https://github.com/chua/gan' }, LUC_THEM))).toBe('LINK_KHONG_HOP_LE')
    })

    it('link đã có trên Task trả LINK_TRUNG (repo không phân biệt hoa thường, bỏ phần ? và #); khác loại hay khác số, hay ở Task khác thì thêm được', async () => {
      await khoiTao()
      const { pm, duAn, task, tv, kiem } = await dungBoiCanh('trung')
      giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan: ISSUE_12 }, LUC_THEM))
      for (const duongDan of [ISSUE_12, `${ISSUE_12}/`, `${ISSUE_12}#issuecomment-1`, 'https://github.com/ACME/WEB/issues/12', ` ${ISSUE_12}?x=1 `]) {
        const kq = await kho.themLienKetVaoTask(pm, task.id, { duongDan }, LUC_THEM)
        expect(maLoi(kq), duongDan).toBe('LINK_TRUNG')
        if (!kq.ok) expect(kq.loi.loiTheoO?.duongDan).toBe(THONG_BAO_LIEN_KET.trung)
      }
      expect(await cacLienKet(pm, task.id)).toEqual(['ISSUE#12@acme/web'])

      // PR số 12 khác issue số 12; issue số 13 khác số 12.
      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, { duongDan: 'https://github.com/acme/web/pull/12' }, LUC_THEM))).toBe('THANH_CONG')
      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, { duongDan: 'https://github.com/acme/web/issues/13' }, LUC_THEM))).toBe('THANH_CONG')
      // Task khác trong cùng Dự án có danh sách riêng.
      const task2 = giaTri(
        await kho.taoTask(
          pm,
          duAn.id,
          { tieuDe: 'Việc thứ hai', nguoiThucHienId: tv.nguoiDungId, nguoiKiemTraId: kiem.nguoiDungId },
          LUC_TAO,
        ),
      )
      expect(await cacLienKet(pm, task2.id)).toEqual([])
      expect(maLoi(await kho.themLienKetVaoTask(pm, task2.id, { duongDan: ISSUE_12 }, LUC_THEM))).toBe('THANH_CONG')
    })

    it('một Task giữ được nhiều link; gỡ một link không ảnh hưởng link khác; gỡ rồi dán lại được', async () => {
      await khoiTao()
      const { pm, task } = await dungBoiCanh('nhieu')
      giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan: ISSUE_12 }, LUC_THEM))
      giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan: PR_34 }, LUC_THEM))
      giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan: 'https://github.com/acme/web/issues/56' }, LUC_THEM))
      expect(await cacLienKet(pm, task.id)).toEqual(['ISSUE#12@acme/web', 'PR#34@acme/web', 'ISSUE#56@acme/web'])

      expect(giaTri(await kho.goLienKetKhoiTask(pm, task.id, { repo: 'ACME/web', loai: 'PR', so: 34 }, LUC_GO))).toBeNull()
      expect(await cacLienKet(pm, task.id)).toEqual(['ISSUE#12@acme/web', 'ISSUE#56@acme/web'])

      // Link không có trên Task (đã gỡ, khác loại, khác số, sai kiểu): KHONG_TIM_THAY, danh sách không đổi.
      expect(maLoi(await kho.goLienKetKhoiTask(pm, task.id, { repo: 'acme/web', loai: 'PR', so: 34 }, LUC_GO))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.goLienKetKhoiTask(pm, task.id, { repo: 'acme/web', loai: 'PR', so: 12 }, LUC_GO))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.goLienKetKhoiTask(pm, task.id, { repo: 'acme/web', loai: 'ISSUE', so: 99 }, LUC_GO))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.goLienKetKhoiTask(pm, task.id, null as unknown as { repo: string; loai: 'PR'; so: number }, LUC_GO))).toBe('KHONG_TIM_THAY')
      expect(await cacLienKet(pm, task.id)).toEqual(['ISSUE#12@acme/web', 'ISSUE#56@acme/web'])

      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, { duongDan: PR_34 }, LUC_THEM))).toBe('THANH_CONG')
      expect(await cacLienKet(pm, task.id)).toEqual(['ISSUE#12@acme/web', 'ISSUE#56@acme/web', 'PR#34@acme/web'])
    })

    it('mọi người trong dự án (Thành viên, Support, PM) thêm và gỡ được link; mọi người trong dự án đều thấy danh sách', async () => {
      await khoiTao()
      const { pm, duAn, task } = await dungBoiCanh('moi-vai')
      const nguoi: Phien[] = []
      for (const vai of CAC_VAI) {
        if (vai === 'PM') continue
        nguoi.push(await taoNguoi(pm, duAn, `trong-${vai}`.toLowerCase().replace('_', '-'), vai, true))
      }
      let so = 100
      for (const phien of [pm, ...nguoi]) {
        so += 1
        const duongDan = `https://github.com/acme/web/issues/${so}`
        expect(maLoi(await kho.themLienKetVaoTask(phien, task.id, { duongDan }, LUC_THEM)), duongDan).toBe('THANH_CONG')
      }
      expect(await cacLienKet(pm, task.id)).toHaveLength(3)
      for (const phien of [pm, ...nguoi]) expect(await cacLienKet(phien, task.id)).toHaveLength(3)
      // Người này gỡ link do người kia dán.
      expect(maLoi(await kho.goLienKetKhoiTask(nguoi[0], task.id, { repo: 'acme/web', loai: 'ISSUE', so: 101 }, LUC_GO))).toBe('THANH_CONG')
      expect(await cacLienKet(pm, task.id)).toHaveLength(2)
    })

    it('Task ở trạng thái cuối vẫn thêm được link: Task mới tạo (Mới) thêm được; Task không tồn tại thì PM nhận KHONG_TIM_THAY', async () => {
      await khoiTao()
      const { pm, task } = await dungBoiCanh('cuoi')
      expect(task.trangThai).toBe('MOI')
      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, { duongDan: ISSUE_12 }, LUC_THEM))).toBe('THANH_CONG')
      expect(maLoi(await kho.themLienKetVaoTask(pm, 'khong-ton-tai', { duongDan: ISSUE_12 }, LUC_THEM))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.goLienKetKhoiTask(pm, 'khong-ton-tai', { repo: 'acme/web', loai: 'ISSUE', so: 12 }, LUC_GO))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.danhSachLienKetCuaTask(pm, 'khong-ton-tai'))).toBe('KHONG_TIM_THAY')
    })

    it('người ngoài Dự án thêm, gỡ hay xem link nhận KHONG_TIM_THAY giống hệt Task không tồn tại, và không đổi gì', async () => {
      await khoiTao()
      const { pm, duAn, task } = await dungBoiCanh('ngoai')
      giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan: ISSUE_12 }, LUC_THEM))
      const tvNgoai = await taoNguoi(pm, duAn, 'ngoai-tv', 'THANH_VIEN', false)
      const spNgoai = await taoNguoi(pm, duAn, 'ngoai-sp', 'SUPPORT', false)
      const lien = { repo: 'acme/web', loai: 'ISSUE', so: 12 } as const

      for (const phien of [tvNgoai, spNgoai]) {
        const them = await kho.themLienKetVaoTask(phien, task.id, { duongDan: PR_34 }, LUC_GO)
        expect(maLoi(them)).toBe('KHONG_TIM_THAY')
        expect(them).toEqual(await kho.themLienKetVaoTask(phien, 'khong-ton-tai', { duongDan: PR_34 }, LUC_GO))
        // Quyền được kiểm trước dữ liệu: link sai hay trùng không lộ gì.
        expect(maLoi(await kho.themLienKetVaoTask(phien, task.id, { duongDan: 'sai' }, LUC_GO))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.themLienKetVaoTask(phien, task.id, { duongDan: ISSUE_12 }, LUC_GO))).toBe('KHONG_TIM_THAY')
        const go = await kho.goLienKetKhoiTask(phien, task.id, lien, LUC_GO)
        expect(maLoi(go)).toBe('KHONG_TIM_THAY')
        expect(go).toEqual(await kho.goLienKetKhoiTask(phien, 'khong-ton-tai', lien, LUC_GO))
        const xem = await kho.danhSachLienKetCuaTask(phien, task.id)
        expect(maLoi(xem)).toBe('KHONG_TIM_THAY')
        expect(xem).toEqual(await kho.danhSachLienKetCuaTask(phien, 'khong-ton-tai'))
      }
      expect(await cacLienKet(pm, task.id)).toEqual(['ISSUE#12@acme/web'])
    })

    it('người bị gỡ khỏi Dự án không còn thêm, gỡ hay xem được link', async () => {
      await khoiTao()
      const { pm, duAn, task, tv } = await dungBoiCanh('roi')
      giaTri(await kho.themLienKetVaoTask(tv, task.id, { duongDan: ISSUE_12 }, LUC_THEM))
      giaTri(await kho.goNguoiKhoiDuAn(pm, duAn.id, tv.nguoiDungId))
      expect(maLoi(await kho.themLienKetVaoTask(tv, task.id, { duongDan: PR_34 }, LUC_THEM))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.goLienKetKhoiTask(tv, task.id, { repo: 'acme/web', loai: 'ISSUE', so: 12 }, LUC_GO))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.danhSachLienKetCuaTask(tv, task.id))).toBe('KHONG_TIM_THAY')
      expect(await cacLienKet(pm, task.id)).toEqual(['ISSUE#12@acme/web'])
    })

    it('Dự án đã Lưu trữ: thêm và gỡ trả DU_AN_DA_LUU_TRU cho mọi người trong dự án, danh sách vẫn xem được; mở lại thì dùng được', async () => {
      await khoiTao()
      const { pm, duAn, task, tv } = await dungBoiCanh('luu-tru')
      const support = await taoNguoi(pm, duAn, 'support-lt', 'SUPPORT', true)
      giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan: ISSUE_12 }, LUC_THEM))
      giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC_THEM))

      for (const phien of [pm, support, tv]) {
        const kq = await kho.themLienKetVaoTask(phien, task.id, { duongDan: PR_34 }, LUC_GO)
        expect(maLoi(kq)).toBe('DU_AN_DA_LUU_TRU')
        if (!kq.ok) expect(kq.loi.thongBao).toBe(THONG_BAO_DU_AN.daLuuTru)
        // Trạng thái được kiểm trước dữ liệu của link.
        expect(maLoi(await kho.themLienKetVaoTask(phien, task.id, { duongDan: 'sai' }, LUC_GO))).toBe('DU_AN_DA_LUU_TRU')
        expect(maLoi(await kho.goLienKetKhoiTask(phien, task.id, { repo: 'acme/web', loai: 'ISSUE', so: 12 }, LUC_GO))).toBe('DU_AN_DA_LUU_TRU')
        expect(await cacLienKet(phien, task.id)).toEqual(['ISSUE#12@acme/web'])
      }

      giaTri(await kho.moLaiDuAn(pm, duAn.id, LUC_GO))
      expect(maLoi(await kho.themLienKetVaoTask(tv, task.id, { duongDan: PR_34 }, LUC_GO))).toBe('THANH_CONG')
    })

    it('thêm hoặc gỡ link cập nhật người và ngày chỉnh sửa gần nhất của Task; lệnh bị từ chối thì không đổi', async () => {
      await khoiTao()
      const { pm, task, tv } = await dungBoiCanh('dau-vet')
      expect(giaTri(await kho.layTask(pm, task.id)).dauVet.suaBoi).toBeNull()
      const taoBoi = giaTri(await kho.layTask(pm, task.id)).dauVet.taoBoi

      // Lệnh thất bại không chạm dấu vết.
      expect(maLoi(await kho.themLienKetVaoTask(pm, task.id, { duongDan: 'sai' }, LUC_THEM))).toBe('LINK_KHONG_HOP_LE')
      expect(maLoi(await kho.goLienKetKhoiTask(pm, task.id, { repo: 'acme/web', loai: 'ISSUE', so: 1 }, LUC_THEM))).toBe('KHONG_TIM_THAY')
      expect(giaTri(await kho.layTask(pm, task.id)).dauVet.suaBoi).toBeNull()

      giaTri(await kho.themLienKetVaoTask(tv, task.id, { duongDan: ISSUE_12 }, LUC_THEM))
      const sauThem = giaTri(await kho.layTask(pm, task.id)).dauVet
      expect(sauThem.suaBoi?.id).toBe(tv.nguoiDungId)
      expect(sauThem.suaLuc).toBeInstanceOf(Date)
      if (tuyChon.dongHoCuaKho) expect(Number.isNaN((sauThem.suaLuc as Date).getTime())).toBe(false)
      else expect(sauThem.suaLuc).toEqual(LUC_THEM)
      // Người và ngày tạo không đổi.
      expect(sauThem.taoBoi).toEqual(taoBoi)

      giaTri(await kho.goLienKetKhoiTask(pm, task.id, { repo: 'acme/web', loai: 'ISSUE', so: 12 }, LUC_GO))
      const sauGo = giaTri(await kho.layTask(tv, task.id)).dauVet
      expect(sauGo.suaBoi?.id).toBe(pm.nguoiDungId)
      if (!tuyChon.dongHoCuaKho) expect(sauGo.suaLuc).toEqual(LUC_GO)
      expect(sauGo.taoBoi).toEqual(taoBoi)
    })

    it('chưa đăng nhập: cả ba lệnh trả CHUA_DANG_NHAP', async () => {
      await khoiTao()
      expect(maLoi(await kho.themLienKetVaoTask(null, 'task', { duongDan: ISSUE_12 }, LUC_THEM))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.goLienKetKhoiTask(null, 'task', { repo: 'a/b', loai: 'ISSUE', so: 1 }, LUC_GO))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.danhSachLienKetCuaTask(null, 'task'))).toBe('CHUA_DANG_NHAP')
    })
  })
}
