// Phần cổng kiểm được của vòng duyệt trên bản Supabase (ticket 14), không cần mạng hay DB.
//
// Cổng KHÔNG chạy được SQL, nên không kiểm được hàm `doi_trang_thai_task`, phân quyền từng dòng hay
// ràng buộc thật: những thứ đó chỉ kiểm tay (supabase/README.md) bằng bộ test hợp đồng và bảng ca
// dùng chung trên Supabase thật. Ở đây chỉ có:
//   1. Hành vi của bản cài Supabase nhìn từ giao diện Kho khi máy chủ là một `fetch` giả trong bộ
//      nhớ (không có mạng): luật thuần từ chối trước khi gọi hàm cơ sở dữ liệu (không ghi gì), lý do
//      được cắt khoảng trắng, lỗi do hàm ném được đổi về đúng mã của Kho, lịch sử được đọc và xếp.
//      `fetch` giả này KHÔNG mô phỏng SQL: nó chỉ trả những gì test dặn, nên không thay cho bước 2.
//   2. Cấu trúc file migration lát 3 (đọc chữ, không chạy SQL): ma trận trong SQL giống ma trận của
//      luật thuần, mã lỗi hàm ném là mã của Kho, bảng lịch sử không ghi trực tiếp được, hàm là
//      security definer và bật cờ giao dịch SAU khi kiểm xong, bản xuống bỏ đủ đối tượng.
import { describe, expect, it } from 'vitest'
import { THONG_BAO_MAC_DINH, type KetQua, type MaLoi } from './ketQua'
import { taoKhoSupabase } from './khoSupabase'
import type { KhoDuLieu, Phien } from './khoDuLieu'
import { MA_TRAN_CHUYEN_TRANG_THAI, THONG_BAO_CHUYEN_TRANG_THAI } from '../luat/chuyenTrangThai'
import migrationLen from '../../supabase/migrations/20261125000300_lat_3_vong_duyet.sql?raw'
import migrationXuong from '../../supabase/down/20261125000300_lat_3_vong_duyet.down.sql?raw'

/** JWT giả (chữ ký không hợp lệ), như cauHinh.test.ts. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://du-an-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'du-an-gia', role: 'anon' })
const LUC = new Date('2026-06-02T08:30:00+07:00')
const MAT_KHAU = 'matkhau-dung-1'

type Dong = Record<string, unknown>

const id = (so: number) => `00000000-0000-4000-8000-${String(so).padStart(12, '0')}`
const ID = {
  pm: id(1),
  an: id(2),
  binh: id(3),
  chi: id(4),
  em: id(5),
  ngoai: id(6),
  duAn: id(10),
  duAnLuuTru: id(11),
  task: id(20),
  taskLuuTru: id(21),
  taskKhac: id(22),
}

interface LoiRpc {
  code: string
  message: string
}

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  task: Dong[]
  lichSu: Dong[]
  /** Các lần gọi hàm cơ sở dữ liệu `doi_trang_thai_task`. */
  lanDoi: Record<string, unknown>[]
  /** Lỗi mà `doi_trang_thai_task` trả về thay cho việc chạy (tình huống đua hay hàng rào của cơ sở dữ liệu). */
  loiDoi: LoiRpc | null
  /** Tổng số yêu cầu đã gửi tới "máy chủ". */
  soYeuCau: number
}

function hoSoGia(so: number, ten: string, vai: string): Dong {
  return { id: id(so), email: `${ten.toLowerCase()}@vi-du.vn`, ten_hien_thi: ten, github_username: null, vai }
}

function dungDuLieu(): DuLieuGia {
  const task = (maTask: string, duAnId: string, trangThai: string, soLanTraLai = 0): Dong => ({
    id: maTask,
    du_an_id: duAnId,
    tieu_de: 'Làm trang chủ',
    mo_ta: '',
    han: null,
    nguoi_thuc_hien_id: ID.an,
    nguoi_kiem_tra_id: ID.binh,
    trang_thai: trangThai,
    so_lan_tra_lai: soLanTraLai,
    tao_boi: ID.pm,
    tao_luc: '2026-06-01T03:00:00+00:00',
    sua_boi: null,
    sua_luc: null,
  })
  return {
    hoSo: [
      hoSoGia(1, 'Pm', 'PM'),
      hoSoGia(2, 'An', 'THANH_VIEN'),
      hoSoGia(3, 'Binh', 'THANH_VIEN'),
      hoSoGia(4, 'Chi', 'SUPPORT'),
      hoSoGia(5, 'Em', 'THANH_VIEN'),
      hoSoGia(6, 'Ngoai', 'THANH_VIEN'),
    ],
    duAn: [
      { id: ID.duAn, ten: 'Cửa hàng', mo_ta: '', trang_thai: 'HOAT_DONG', tao_boi: ID.pm, tao_luc: '2026-06-01T02:00:00+00:00', sua_boi: null, sua_luc: null },
      { id: ID.duAnLuuTru, ten: 'Cũ', mo_ta: '', trang_thai: 'LUU_TRU', tao_boi: ID.pm, tao_luc: '2026-05-01T02:00:00+00:00', sua_boi: null, sua_luc: null },
    ],
    thanhVien: [ID.an, ID.binh, ID.chi, ID.em].flatMap((nguoi) => [
      { du_an_id: ID.duAn, nguoi_dung_id: nguoi },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: nguoi },
    ]),
    task: [task(ID.task, ID.duAn, 'MOI'), task(ID.taskLuuTru, ID.duAnLuuTru, 'MOI'), task(ID.taskKhac, ID.duAn, 'MOI')],
    lichSu: [],
    lanDoi: [],
    loiDoi: null,
    soYeuCau: 0,
  }
}

function tra(trangThai: number, than?: unknown): Response {
  return new Response(than === undefined ? null : JSON.stringify(than), {
    status: trangThai,
    headers: { 'content-type': 'application/json' },
  })
}

const CAC_THAM_SO_KHONG_LOC = ['select', 'order', 'limit', 'offset']

/** Lọc dòng theo các bộ lọc `cot=eq.giaTri` và `cot=in.(a,b)` của PostgREST; bỏ qua phần còn lại. */
function loc(dong: readonly Dong[], thamSo: URLSearchParams): Dong[] {
  let ketQua = dong.filter((d) => {
    for (const [khoa, giaTri] of thamSo) {
      if (CAC_THAM_SO_KHONG_LOC.includes(khoa)) continue
      if (giaTri.startsWith('eq.') && String(d[khoa]) !== giaTri.slice(3)) return false
      if (giaTri.startsWith('in.(')) {
        const ds = giaTri.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, ''))
        if (!ds.includes(String(d[khoa]))) return false
      }
    }
    return true
  })
  const batDau = Number(thamSo.get('offset') ?? 0)
  const gioiHan = thamSo.get('limit')
  ketQua = ketQua.slice(batDau, gioiHan === null ? undefined : batDau + Number(gioiHan))
  return ketQua
}

/**
 * `fetch` giả đóng vai Supabase: Auth (đăng nhập), PostgREST (các bảng, hàm) trên dữ liệu trong bộ
 * nhớ. Mô phỏng phân quyền từng dòng ở mức thô (PM thấy mọi Dự án, người khác Dự án mình ở trong) để
 * có "Task của Dự án không thấy được". Không mô phỏng SQL của hàm chuyển trạng thái: `doi_trang_thai_task`
 * chỉ ghi lại lần gọi, rồi (nếu không có lỗi dặn trước) đổi trạng thái đúng như tham số.
 */
function taoFetchGia(du: DuLieuGia): typeof fetch {
  return async (input, init) => {
    du.soYeuCau += 1
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const phuongThuc = (init?.method ?? 'GET').toUpperCase()
    const than = typeof init?.body === 'string' && init.body !== '' ? (JSON.parse(init.body) as Dong) : {}

    if (url.pathname === '/auth/v1/token') {
      const nguoi = du.hoSo.find((h) => h.email === than.email)
      if (!nguoi) return tra(400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'sai' })
      return tra(200, {
        access_token: `token-${String(nguoi.id)}`,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `lam-moi-${String(nguoi.id)}`,
        user: {
          id: nguoi.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: nguoi.email,
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00+00:00',
        },
      })
    }

    const dangNhapLa = /^Bearer token-(.+)$/.exec(new Headers(init?.headers).get('authorization') ?? '')?.[1]
    const nguoiGoi = du.hoSo.find((h) => h.id === dangNhapLa)
    const laPM = nguoiGoi?.vai === 'PM'
    const duAnThay = (duAnId: unknown) =>
      laPM || du.thanhVien.some((t) => t.du_an_id === duAnId && t.nguoi_dung_id === nguoiGoi?.id)

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const ham = url.pathname.slice('/rest/v1/rpc/'.length)
      if (ham === 'ten_nguoi_cua_task') {
        const ids = (than.p_ids as string[]) ?? []
        return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
      }
      if (ham === 'doi_trang_thai_task') {
        du.lanDoi.push(than)
        if (du.loiDoi) return tra(400, { code: du.loiDoi.code, message: du.loiDoi.message, details: null, hint: null })
        const task = du.task.find((t) => t.id === than.p_task_id)
        if (task) {
          task.trang_thai = than.p_sang
          if (than.p_sang === 'TRA_LAI') task.so_lan_tra_lai = Number(task.so_lan_tra_lai) + 1
        }
        return tra(204)
      }
      if (ham === 'lich_su_task') {
        const task = du.task.find((t) => t.id === than.p_task_id)
        if (!task || !duAnThay(task.du_an_id)) {
          return tra(400, { code: 'P0001', message: 'KHONG_TIM_THAY', details: null, hint: null })
        }
        const ten = (maNguoi: unknown) => String(du.hoSo.find((h) => h.id === maNguoi)?.ten_hien_thi)
        return tra(
          200,
          du.lichSu
            .filter((l) => l.task_id === than.p_task_id)
            .map((l) => ({ stt: l.stt, nguoi_doi_id: l.nguoi_doi_id, ten_hien_thi: ten(l.nguoi_doi_id), luc: l.luc, tu: l.tu, sang: l.sang, ly_do: l.ly_do })),
        )
      }
      return tra(404, { code: 'PGRST202', message: `Không có hàm ${ham}` })
    }

    if (url.pathname.startsWith('/rest/v1/') && phuongThuc === 'GET') {
      const bang = url.pathname.slice('/rest/v1/'.length)
      const goc: Record<string, Dong[]> = {
        ho_so: du.hoSo,
        du_an: du.duAn.filter((d) => duAnThay(d.id)),
        nguoi_trong_du_an: du.thanhVien.filter((t) => duAnThay(t.du_an_id)),
        task: du.task.filter((t) => duAnThay(t.du_an_id)),
      }
      if (!(bang in goc)) return tra(404, { code: 'PGRST205', message: `Không có bảng ${bang}` })
      return tra(200, loc(goc[bang], url.searchParams))
    }
    return tra(404, { code: 'PGRST000', message: `Yêu cầu không mong đợi: ${phuongThuc} ${url.pathname}` })
  }
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

interface BoiCanh {
  du: DuLieuGia
  kho: KhoDuLieu
  phien: Record<'pm' | 'an' | 'binh' | 'chi' | 'em' | 'ngoai', Phien>
}

async function dungBoiCanh(): Promise<BoiCanh> {
  const du = dungDuLieu()
  const kho = taoKhoSupabase({
    url: URL_GIA,
    khoaCongKhai: KHOA_ANON,
    tuDongLamMoiPhien: false,
    fetch: taoFetchGia(du),
  })
  const dangNhap = async (ten: string): Promise<Phien> =>
    giaTri(await kho.dangNhap({ email: `${ten}@vi-du.vn`, matKhau: MAT_KHAU }))
  return {
    du,
    kho,
    phien: {
      pm: await dangNhap('pm'),
      an: await dangNhap('an'),
      binh: await dangNhap('binh'),
      chi: await dangNhap('chi'),
      em: await dangNhap('em'),
      ngoai: await dangNhap('ngoai'),
    },
  }
}

function datTrangThaiTask(du: DuLieuGia, maTask: string, trangThai: string): void {
  const task = du.task.find((t) => t.id === maTask)
  if (!task) throw new Error('Không có Task')
  task.trang_thai = trangThai
}

const trangThaiCua = (du: DuLieuGia, maTask: string) => du.task.find((t) => t.id === maTask)?.trang_thai

describe('đổi trạng thái Task trên bản Supabase, máy chủ là fetch giả', () => {
  it('bước hợp lệ: gọi đúng một lần hàm cơ sở dữ liệu với người gọi là phiên, trạng thái đích và lý do; trả Task đã đổi', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const task = giaTri(await kho.doiTrangThaiTask(phien.an, ID.task, { sang: 'DANG_LAM' }, LUC))
    expect(task).toMatchObject({ id: ID.task, trangThai: 'DANG_LAM', soLanTraLai: 0 })
    // Hàm không nhận người gọi qua tham số: chỉ Task, trạng thái đích và lý do.
    expect(du.lanDoi).toEqual([{ p_task_id: ID.task, p_sang: 'DANG_LAM', p_ly_do: null }])
  })

  it('lý do gửi đi là bản đã cắt khoảng trắng; bước Trả lại tăng bộ đếm mà Kho đọc lại', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    datTrangThaiTask(du, ID.task, 'CHO_DUYET')
    const task = giaTri(await kho.doiTrangThaiTask(phien.binh, ID.task, { sang: 'TRA_LAI', lyDo: '  Thiếu ảnh  ' }, LUC))
    expect(task.trangThai).toBe('TRA_LAI')
    expect(task.soLanTraLai).toBe(1)
    expect(du.lanDoi).toEqual([{ p_task_id: ID.task, p_sang: 'TRA_LAI', p_ly_do: 'Thiếu ảnh' }])
  })

  it('PM ngoài Dự án đổi được (PM ở mọi Dự án)', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    giaTri(await kho.doiTrangThaiTask(phien.pm, ID.task, { sang: 'DANG_LAM' }, LUC))
    expect(du.lanDoi).toHaveLength(1)
  })

  const CAC_CA_TU_CHOI: {
    ten: string
    nguoi: 'pm' | 'an' | 'binh' | 'chi' | 'em' | 'ngoai'
    task?: string
    tu: string
    dauVao: { sang: string; lyDo?: string }
    ma: MaLoi
  }[] = [
    { ten: 'Người thực hiện tự duyệt', nguoi: 'an', tu: 'CHO_DUYET', dauVao: { sang: 'HOAN_THANH' }, ma: 'KHONG_CO_QUYEN' },
    { ten: 'Người kiểm tra bắt đầu việc', nguoi: 'binh', tu: 'MOI', dauVao: { sang: 'DANG_LAM' }, ma: 'KHONG_CO_QUYEN' },
    { ten: 'Người thực hiện đưa Bị lỗi về Đang làm', nguoi: 'an', tu: 'BI_LOI', dauVao: { sang: 'DANG_LAM' }, ma: 'KHONG_CO_QUYEN' },
    { ten: 'Thành viên khác trong Dự án', nguoi: 'em', tu: 'MOI', dauVao: { sang: 'DANG_LAM' }, ma: 'KHONG_CO_QUYEN' },
    { ten: 'Thành viên ngoài Dự án (Task như không thấy được)', nguoi: 'ngoai', tu: 'MOI', dauVao: { sang: 'DANG_LAM' }, ma: 'KHONG_CO_QUYEN' },
    { ten: 'bước không có trong ma trận', nguoi: 'chi', tu: 'MOI', dauVao: { sang: 'HOAN_THANH' }, ma: 'BUOC_KHONG_HOP_LE' },
    { ten: 'chuyển sang chính trạng thái hiện tại', nguoi: 'pm', tu: 'DANG_LAM', dauVao: { sang: 'DANG_LAM' }, ma: 'BUOC_KHONG_HOP_LE' },
    { ten: 'Trả lại thiếu lý do', nguoi: 'binh', tu: 'CHO_DUYET', dauVao: { sang: 'TRA_LAI' }, ma: 'LY_DO_BAT_BUOC' },
    { ten: 'Bị lỗi, lý do chỉ khoảng trắng', nguoi: 'binh', tu: 'CHO_DUYET', dauVao: { sang: 'BI_LOI', lyDo: '   ' }, ma: 'LY_DO_BAT_BUOC' },
    { ten: 'Huỷ thiếu lý do', nguoi: 'chi', tu: 'DANG_LAM', dauVao: { sang: 'HUY' }, ma: 'LY_DO_BAT_BUOC' },
    { ten: 'Hoàn thành không đi tiếp', nguoi: 'pm', tu: 'HOAN_THANH', dauVao: { sang: 'DANG_LAM' }, ma: 'TASK_DA_CHOT' },
    { ten: 'Huỷ không đi tiếp', nguoi: 'chi', tu: 'HUY', dauVao: { sang: 'HUY', lyDo: 'Lại huỷ' }, ma: 'TASK_DA_CHOT' },
    { ten: 'Dự án đã Lưu trữ', nguoi: 'pm', task: ID.taskLuuTru, tu: 'MOI', dauVao: { sang: 'DANG_LAM' }, ma: 'DU_AN_DA_LUU_TRU' },
    { ten: 'trạng thái đích không có thật', nguoi: 'an', tu: 'MOI', dauVao: { sang: 'DANG_LAMM' }, ma: 'KHONG_HOP_LE' },
    { ten: 'lý do quá dài', nguoi: 'binh', tu: 'CHO_DUYET', dauVao: { sang: 'TRA_LAI', lyDo: 'a'.repeat(1001) }, ma: 'KHONG_HOP_LE' },
  ]

  it.each(CAC_CA_TU_CHOI)('luật thuần từ chối trước khi gọi hàm cơ sở dữ liệu: $ten → $ma, không ghi gì', async (ca) => {
    const { du, kho, phien } = await dungBoiCanh()
    const maTask = ca.task ?? ID.task
    datTrangThaiTask(du, maTask, ca.tu)
    const kq = await kho.doiTrangThaiTask(phien[ca.nguoi], maTask, ca.dauVao, LUC)
    expect(maLoi(kq)).toBe(ca.ma)
    expect(du.lanDoi).toEqual([])
    expect(trangThaiCua(du, maTask)).toBe(ca.tu)
    expect(du.lichSu).toEqual([])
    if (!kq.ok && ca.ma === 'LY_DO_BAT_BUOC') {
      expect(kq.loi.loiTheoO).toHaveProperty('lyDo', THONG_BAO_CHUYEN_TRANG_THAI.lyDoTrong)
    }
    if (!kq.ok && ca.ma === 'KHONG_HOP_LE') expect(kq.loi.loiTheoO).toBeDefined()
  })

  it('chưa đăng nhập hoặc phiên không có thật: CHUA_DANG_NHAP ngay, không gọi gì tới máy chủ', async () => {
    const { du, kho } = await dungBoiCanh()
    const truoc = du.soYeuCau
    const phienGia: Phien = { maPhien: 'khong-ton-tai', nguoiDungId: ID.an }
    for (const phien of [null, phienGia]) {
      expect(maLoi(await kho.doiTrangThaiTask(phien, ID.task, { sang: 'DANG_LAM' }, LUC))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.lichSuTask(phien, ID.task))).toBe('CHUA_DANG_NHAP')
    }
    expect(du.soYeuCau).toBe(truoc)
  })

  it('Task không tồn tại hay mã không phải uuid: PM nhận KHONG_TIM_THAY, người khác nhận KHONG_CO_QUYEN (không lộ gì)', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    for (const maTask of [id(999), `${ID.task}-khong-ton-tai`, '']) {
      expect(maLoi(await kho.doiTrangThaiTask(phien.pm, maTask, { sang: 'DANG_LAM' }, LUC))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.doiTrangThaiTask(phien.an, maTask, { sang: 'DANG_LAM' }, LUC))).toBe('KHONG_CO_QUYEN')
      expect(maLoi(await kho.doiTrangThaiTask(phien.ngoai, maTask, { sang: 'DANG_LAM' }, LUC))).toBe('KHONG_CO_QUYEN')
    }
    expect(du.lanDoi).toEqual([])
  })

  it.each<{ ten: string; loi: LoiRpc; ma: MaLoi }>([
    { ten: 'Task vừa bị chốt giữa hai bước', loi: { code: 'P0001', message: 'TASK_DA_CHOT' }, ma: 'TASK_DA_CHOT' },
    { ten: 'Dự án vừa bị Lưu trữ', loi: { code: 'P0001', message: 'DU_AN_DA_LUU_TRU' }, ma: 'DU_AN_DA_LUU_TRU' },
    { ten: 'cơ sở dữ liệu từ chối quyền', loi: { code: 'P0001', message: 'KHONG_CO_QUYEN' }, ma: 'KHONG_CO_QUYEN' },
    { ten: 'lỗi quyền cột hay quyền hàm', loi: { code: '42501', message: 'permission denied' }, ma: 'KHONG_CO_QUYEN' },
    { ten: 'bước không hợp lệ', loi: { code: 'P0001', message: 'BUOC_KHONG_HOP_LE' }, ma: 'BUOC_KHONG_HOP_LE' },
    { ten: 'lý do bắt buộc', loi: { code: 'P0001', message: 'LY_DO_BAT_BUOC' }, ma: 'LY_DO_BAT_BUOC' },
    { ten: 'dữ liệu không hợp lệ', loi: { code: 'P0001', message: 'KHONG_HOP_LE' }, ma: 'KHONG_HOP_LE' },
    { ten: 'Task không tồn tại với PM', loi: { code: 'P0001', message: 'KHONG_TIM_THAY' }, ma: 'KHONG_TIM_THAY' },
    { ten: 'phiên hết hạn', loi: { code: 'PGRST301', message: 'JWT expired' }, ma: 'CHUA_DANG_NHAP' },
    { ten: 'lỗi lạ của máy chủ', loi: { code: '57014', message: 'canceling statement' }, ma: 'LOI_HE_THONG' },
  ])('lỗi do hàm cơ sở dữ liệu ném về đúng mã của Kho: $ten → $ma', async ({ loi, ma }) => {
    const { du, kho, phien } = await dungBoiCanh()
    du.loiDoi = loi
    const kq = await kho.doiTrangThaiTask(phien.an, ID.task, { sang: 'DANG_LAM' }, LUC)
    expect(maLoi(kq)).toBe(ma)
    if (!kq.ok) expect(kq.loi.thongBao).not.toBe('')
    if (!kq.ok && ma === 'TASK_DA_CHOT') expect(kq.loi.thongBao).toBe(THONG_BAO_CHUYEN_TRANG_THAI.daChot)
    expect(trangThaiCua(du, ID.task)).toBe('MOI')
  })
})

describe('lịch sử trạng thái Task trên bản Supabase, máy chủ là fetch giả', () => {
  function dongLichSu(stt: number, nguoi: string, luc: string, tu: string, sang: string, lyDo: string | null): Dong {
    return { stt, task_id: ID.task, nguoi_doi_id: nguoi, luc, tu, sang, ly_do: lyDo }
  }

  it('đọc đủ người đổi (kèm tên), thời điểm, từ, sang, lý do; xếp theo thời điểm tăng dần, cùng lúc thì theo thứ tự ghi', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    // Cố ý trả không đúng thứ tự để thấy Kho xếp lại.
    du.lichSu = [
      dongLichSu(3, ID.an, '2026-06-02T03:00:00+00:00', 'TRA_LAI', 'DANG_LAM', null),
      dongLichSu(2, ID.binh, '2026-06-02T02:00:00+00:00', 'CHO_DUYET', 'TRA_LAI', 'Thiếu ảnh'),
      dongLichSu(1, ID.an, '2026-06-02T02:00:00+00:00', 'DANG_LAM', 'CHO_DUYET', null),
      dongLichSu(0, ID.an, '2026-06-02T01:00:00+00:00', 'MOI', 'DANG_LAM', null),
    ]
    const ls = giaTri(await kho.lichSuTask(phien.em, ID.task))
    expect(ls.map((d) => `${d.tu}>${d.sang}`)).toEqual([
      'MOI>DANG_LAM',
      'DANG_LAM>CHO_DUYET',
      'CHO_DUYET>TRA_LAI',
      'TRA_LAI>DANG_LAM',
    ])
    expect(ls[2]).toEqual({
      nguoiDoi: { id: ID.binh, tenHienThi: 'Binh' },
      luc: new Date('2026-06-02T02:00:00+00:00'),
      tu: 'CHO_DUYET',
      sang: 'TRA_LAI',
      lyDo: 'Thiếu ảnh',
    })
    expect(ls[0].lyDo).toBeNull()
  })

  it('Task chưa đổi trạng thái lần nào: rỗng; lịch sử Task khác không lẫn sang', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    du.lichSu = [{ ...dongLichSu(1, ID.an, '2026-06-02T01:00:00+00:00', 'MOI', 'DANG_LAM', null), task_id: ID.taskKhac }]
    expect(giaTri(await kho.lichSuTask(phien.an, ID.task))).toEqual([])
    expect(giaTri(await kho.lichSuTask(phien.an, ID.taskKhac))).toHaveLength(1)
  })

  it('người ngoài Dự án, Task không tồn tại hay mã không phải uuid: cùng KHONG_TIM_THAY; PM xem được', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    du.lichSu = [dongLichSu(1, ID.an, '2026-06-02T01:00:00+00:00', 'MOI', 'DANG_LAM', null)]
    expect(maLoi(await kho.lichSuTask(phien.ngoai, ID.task))).toBe('KHONG_TIM_THAY')
    expect(maLoi(await kho.lichSuTask(phien.ngoai, id(999)))).toBe('KHONG_TIM_THAY')
    expect(maLoi(await kho.lichSuTask(phien.pm, id(999)))).toBe('KHONG_TIM_THAY')
    expect(maLoi(await kho.lichSuTask(phien.an, 'khong-phai-uuid'))).toBe('KHONG_TIM_THAY')
    expect(giaTri(await kho.lichSuTask(phien.pm, ID.task))).toHaveLength(1)
  })
})

// --- Cấu trúc file migration lát 3 (không chạy SQL) ---

/** Bỏ chú thích `-- ...` để không khớp nhầm lời giải thích. */
function boChuThich(sql: string): string {
  return sql.replace(/--.*$/gm, '')
}

const SQL = boChuThich(migrationLen)
const SQL_XUONG = boChuThich(migrationXuong)

/** Cả hàm `create function <ten>(...)`, đến `$$;` kết thúc thân hàm. */
function thanHam(ten: string): string {
  const khop = new RegExp(`create function ${ten.replace('.', '\\.')}\\([\\s\\S]*?\\$\\$;`).exec(SQL)
  if (!khop) throw new Error(`Không tìm thấy hàm ${ten}`)
  return khop[0]
}

describe('migration lát 3 (vòng duyệt): cấu trúc file, không chạy SQL', () => {
  it('ma trận chuyển trạng thái trong SQL giống hệt ma trận của luật thuần (cùng 12 bước, người làm, lý do)', () => {
    const khung = /create function rieng\.ma_tran_chuyen_trang_thai\(\)[\s\S]*?from \(values([\s\S]*?)\) as v/.exec(SQL)
    if (!khung) throw new Error('Không tìm thấy ma trận trong SQL')
    const dong = [
      ...khung[1].matchAll(/\(\s*'([A-Z_]+)'\s*,\s*'([A-Z_]+)'\s*,\s*array\[([^\]]*)\]\s*,\s*(true|false)\s*\)/g),
    ].map((m) => ({
      tu: m[1],
      sang: m[2],
      nguoiLam: [...m[3].matchAll(/'([A-Z_]+)'/g)].map((v) => v[1]),
      canLyDo: m[4] === 'true',
    }))
    const luat = MA_TRAN_CHUYEN_TRANG_THAI.map((b) => ({
      tu: b.tu,
      sang: b.sang,
      nguoiLam: [...b.nguoiLam],
      canLyDo: b.canLyDo,
    }))
    const theoKhoa = (a: { tu: string; sang: string }, b: { tu: string; sang: string }) =>
      `${a.tu}>${a.sang}`.localeCompare(`${b.tu}>${b.sang}`)
    expect(dong).toHaveLength(12)
    expect([...dong].sort(theoKhoa)).toEqual([...luat].sort(theoKhoa))
  })

  it('mọi mã lỗi hàm ném là mã của Kho, và có đủ sáu mã của luật chuyển trạng thái', () => {
    const ma = new Set([...SQL.matchAll(/raise exception '([A-Z_]+)'/g)].map((m) => m[1]))
    for (const m of ma) expect(Object.keys(THONG_BAO_MAC_DINH), m).toContain(m)
    for (const m of [
      'KHONG_CO_QUYEN',
      'DU_AN_DA_LUU_TRU',
      'TASK_DA_CHOT',
      'KHONG_HOP_LE',
      'BUOC_KHONG_HOP_LE',
      'LY_DO_BAT_BUOC',
      'KHONG_TIM_THAY',
      'CHUA_DANG_NHAP',
    ]) {
      expect([...ma], m).toContain(m)
    }
  })

  it('hàm chuyển trạng thái là security definer, đặt search_path rỗng, lấy người gọi từ phiên (không có tham số người)', () => {
    const ham = thanHam('public.doi_trang_thai_task')
    expect(ham).toMatch(/security definer/i)
    expect(ham).toMatch(/set search_path = ''/i)
    expect(ham).toMatch(/v_nguoi uuid := auth\.uid\(\)/)
    // Chữ ký chỉ có Task, trạng thái đích và lý do.
    expect(ham).toMatch(/doi_trang_thai_task\(p_task_id uuid, p_sang text, p_ly_do text default null\)/)
    expect(ham).not.toMatch(/p_nguoi/)
    // Người ghi trong lịch sử là người gọi từ phiên.
    expect(ham).toMatch(/values \(p_task_id, v_nguoi, now\(\)/)
  })

  it('hàm chỉ bật cờ giao dịch SAU khi kiểm xong mọi luật, rồi tắt ngay sau lệnh update', () => {
    const ham = thanHam('public.doi_trang_thai_task')
    const viTri = (mau: RegExp) => {
      const m = mau.exec(ham)
      if (!m) throw new Error(`Không thấy ${mau}`)
      return m.index
    }
    const bat = viTri(/set_config\('rieng\.dang_chuyen_trang_thai', 'co', true\)/)
    const capNhat = viTri(/update public\.task t/)
    const tat = viTri(/set_config\('rieng\.dang_chuyen_trang_thai', '', true\)/)
    expect(ham.match(/set_config\(/g)).toHaveLength(2)
    for (const ma of [
      'CHUA_DANG_NHAP',
      'KHONG_CO_QUYEN',
      'DU_AN_DA_LUU_TRU',
      'TASK_DA_CHOT',
      'KHONG_HOP_LE',
      'BUOC_KHONG_HOP_LE',
      'LY_DO_BAT_BUOC',
    ]) {
      const cuoiCung = ham.lastIndexOf(`raise exception '${ma}'`)
      expect(cuoiCung, ma).toBeGreaterThan(-1)
      expect(cuoiCung, ma).toBeLessThan(bat)
    }
    expect(bat).toBeLessThan(capNhat)
    expect(capNhat).toBeLessThan(tat)
    // Khoá dòng Task và khoá chia sẻ dòng Dự án; bộ đếm Trả lại tăng đúng 1 chỉ khi sang Trả lại.
    expect(ham).toMatch(/from public\.task t where t\.id = p_task_id for update/)
    expect(ham).toMatch(/from public\.du_an d where d\.id = v_task\.du_an_id for share/)
    expect(ham).toMatch(/so_lan_tra_lai = t\.so_lan_tra_lai \+ case when p_sang = 'TRA_LAI' then 1 else 0 end/)
  })

  it('bảng lịch sử: bật RLS, chỉ có policy đọc, không cấp quyền ghi cho client, không có policy cho anon', () => {
    expect(SQL).toMatch(/alter table public\.lich_su_trang_thai_task enable row level security/i)
    const policy = [...SQL.matchAll(/create policy (\w+) on public\.lich_su_trang_thai_task\s+for (\w+) to (\w+)/gi)]
    expect(policy.map((p) => [p[1], p[2], p[3]])).toEqual([['lich_su_doc', 'select', 'authenticated']])
    expect(SQL).toMatch(/revoke all on table public\.lich_su_trang_thai_task from public, anon, authenticated/i)
    expect(SQL).toMatch(/grant select on table public\.lich_su_trang_thai_task to authenticated/i)
    expect(SQL).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*public\.lich_su_trang_thai_task\s+to\s+[^;]*authenticated/i)
    // Đọc theo quyền xem Dự án của Task.
    expect(SQL).toMatch(/using \(rieng\.duoc_xem_task\(task_id\)\)/)
    // Lịch sử chỉ thêm: trigger chặn sửa.
    expect(SQL).toMatch(/create trigger lich_su_truoc_khi_sua\s+before update on public\.lich_su_trang_thai_task/i)
  })

  it('bảng lịch sử có ràng buộc: bước nằm trong ma trận, lý do hợp lệ, Trả lại, Bị lỗi, Huỷ bắt buộc lý do', () => {
    for (const rangBuoc of ['lich_su_buoc_hop_le', 'lich_su_ly_do_hop_le', 'lich_su_ly_do_bat_buoc']) {
      expect(SQL).toContain(rangBuoc)
    }
    expect(SQL).toMatch(/check \(rieng\.la_buoc_chuyen_hop_le\(tu, sang\)\)/)
    expect(SQL).toMatch(/char_length\(ly_do\) <= 1000/)
    expect(SQL).toMatch(/sang not in \('TRA_LAI', 'BI_LOI', 'HUY'\) or ly_do is not null/)
  })

  it('hàm đọc lịch sử chỉ trả cho người thấy Dự án của Task, và sắp theo thời điểm rồi thứ tự ghi', () => {
    const ham = thanHam('public.lich_su_task')
    expect(ham).toMatch(/security definer/i)
    expect(ham).toMatch(/if not rieng\.duoc_xem_task\(p_task_id\) then\s+raise exception 'KHONG_TIM_THAY'/)
    expect(ham).toMatch(/order by l\.luc, l\.stt/)
  })

  it('hàm của client chỉ cấp cho người đã đăng nhập; hàm hỗ trợ và hàm trigger không mở cho client', () => {
    expect(SQL).toMatch(/revoke all on function\s+public\.doi_trang_thai_task\(uuid, text, text\),\s+public\.lich_su_task\(uuid\)\s+from public, anon/i)
    expect(SQL).toMatch(/grant execute on function\s+public\.doi_trang_thai_task\(uuid, text, text\),\s+public\.lich_su_task\(uuid\)\s+to authenticated, service_role/i)
    expect(SQL).toMatch(/revoke all on function\s+rieng\.ma_tran_chuyen_trang_thai\(\),[\s\S]*?rieng\.lich_su_truoc_khi_sua\(\)\s+from public, anon, authenticated/i)
    expect(SQL).not.toMatch(/to\s+anon/i)
  })

  it('bản xuống bỏ mọi bảng, hàm và chỉ mục mà bản lên tạo', () => {
    const bang = [...SQL.matchAll(/create table (public\.[a-z_]+)/gi)].map((m) => m[1])
    expect(bang).toEqual(['public.lich_su_trang_thai_task'])
    for (const ten of bang) expect(SQL_XUONG).toMatch(new RegExp(`drop table if exists ${ten.replace('.', '\\.')}\\b`, 'i'))
    const ham = [...SQL.matchAll(/create function ([a-z_]+\.[a-z_]+)\(/gi)].map((m) => m[1])
    expect(ham.length).toBeGreaterThan(0)
    for (const ten of ham) expect(SQL_XUONG).toMatch(new RegExp(`drop function if exists ${ten.replace('.', '\\.')}\\(`, 'i'))
    // Chỉ mục trên bảng task (bảng này không bị bỏ) phải được bỏ riêng; chỉ mục của bảng lịch sử đi theo bảng.
    const chiMucTask = [...SQL.matchAll(/create index (\w+) on public\.task\b/gi)].map((m) => m[1])
    expect(chiMucTask.length).toBeGreaterThan(0)
    for (const ten of chiMucTask) expect(SQL_XUONG).toMatch(new RegExp(`drop index if exists public\\.${ten}\\b`, 'i'))
  })
})
