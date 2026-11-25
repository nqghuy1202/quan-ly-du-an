// Phần cổng kiểm được của bản Supabase cho repo GitHub, link của Task và Edge Function (ticket 17),
// không cần mạng hay DB.
//
// Cổng KHÔNG chạy được SQL, Deno hay GitHub thật: phân quyền từng dòng, trigger, hàm của cơ sở dữ liệu
// và việc hàm chạy thật chỉ kiểm tay (supabase/README.md). Ở đây chỉ có:
//   1. Mọi lệnh repo và link của bản Supabase từ chối ngay ở ranh giới khi chưa đăng nhập, không gọi mạng.
//   2. Bộ test hợp đồng cho bản Supabase bật phần repo và link (chạy trên Supabase thật, lệnh riêng).
//   3. Kiểm tra cấu trúc file (đọc chữ, không chạy): migration lát 4 và bản xuống, và mã của hàm
//      (một bản duy nhất của hàm chuyển đổi, không đường ghi, token chỉ từ secret, không khoá service).
import { describe, expect, it } from 'vitest'
import { BIEN_KHOA_SUPABASE, BIEN_URL_SUPABASE } from './cauHinh'
import { chonKho } from './chonKho'
import { taoBoBanCaiSupabase } from './hopDongSupabase'
import type { Phien } from './khoDuLieu'
import * as luatGitHub from '../luat/github'
import * as chung from '../../supabase/functions/_shared/github'
import migrationLen from '../../supabase/migrations/20261125000400_lat_4_github.sql?raw'
import migrationXuong from '../../supabase/down/20261125000400_lat_4_github.down.sql?raw'
import migrationTask from '../../supabase/migrations/20261125000200_lat_2_task.sql?raw'
import xuLyNguon from '../../supabase/functions/doc-github/xuLy.ts?raw'
import indexNguon from '../../supabase/functions/doc-github/index.ts?raw'
import chungNguon from '../../supabase/functions/_shared/github.ts?raw'
import luatNguon from '../luat/github.ts?raw'
import congEdgeNguon from '../github/congGitHubEdge.ts?raw'
import khoGitHubNguon from './khoSupabaseGitHub.ts?raw'

function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://du-an-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'du-an-gia', role: 'anon' })
const KHOA_SERVICE = jwtGia({ iss: 'supabase', ref: 'du-an-gia', role: 'service_role' })
const LUC = new Date('2026-04-10T09:30:00+07:00')

/** Bỏ chú thích để không khớp nhầm lời giải thích. */
const boChuThichSql = (sql: string) => sql.replace(/--.*$/gm, '')
const boChuThichTs = (ts: string) => ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '')

describe('lệnh repo và link của bản Supabase, không gọi mạng', () => {
  it('chưa đăng nhập (hoặc phiên không có thật): cả sáu lệnh trả CHUA_DANG_NHAP ngay, không gọi mạng', async () => {
    let soLanGoi = 0
    const fetchCam: typeof fetch = async () => {
      soLanGoi += 1
      throw new Error('Test không được gọi mạng')
    }
    const chon = chonKho({ [BIEN_URL_SUPABASE]: URL_GIA, [BIEN_KHOA_SUPABASE]: KHOA_ANON }, { fetch: fetchCam })
    if (chon.loai !== 'SUPABASE') throw new Error(`Mong đợi bản Supabase, nhận ${chon.loai}`)
    const kho = chon.kho
    const phienGia: Phien = { maPhien: 'khong-ton-tai', nguoiDungId: 'khong-ton-tai' }
    for (const phien of [null, phienGia]) {
      const ketQua = [
        await kho.ganRepoVaoDuAn(phien, 'du-an', { repo: 'a/b' }),
        await kho.goRepoKhoiDuAn(phien, 'du-an', 'a/b'),
        await kho.danhSachRepoCuaDuAn(phien, 'du-an'),
        await kho.themLienKetVaoTask(phien, 'task', { duongDan: 'https://github.com/a/b/issues/1' }, LUC),
        await kho.goLienKetKhoiTask(phien, 'task', { repo: 'a/b', loai: 'ISSUE', so: 1 }, LUC),
        await kho.danhSachLienKetCuaTask(phien, 'task'),
      ]
      expect(ketQua).toHaveLength(6)
      for (const kq of ketQua) expect(kq.ok || kq.loi.ma).toBe('CHUA_DANG_NHAP')
    }
    expect(soLanGoi).toBe(0)
  })
})

describe('bộ test hợp đồng cho bản Supabase có phần repo và link', () => {
  it('bật coTask (ca link chạy, không bị bỏ qua); dựng bản cài không gọi mạng', () => {
    const { tuyChon, taoBanCai } = taoBoBanCaiSupabase({
      url: URL_GIA,
      khoaCongKhai: KHOA_ANON,
      khoaService: KHOA_SERVICE,
      tenMien: 'example.com',
      thoiHanMaDatLaiMs: 3600 * 1000,
    })
    expect(tuyChon.coTask).not.toBe(false)
    expect(typeof taoBanCai().kho.ganRepoVaoDuAn).toBe('function')
  })
})

// --- Cấu trúc migration lát 4 (không chạy SQL) ---

const SQL = boChuThichSql(migrationLen)
const SQL_XUONG = boChuThichSql(migrationXuong)

describe('migration lát 4 (repo, link): cấu trúc file, không chạy SQL', () => {
  it('bật phân quyền từng dòng cho cả hai bảng, không policy cho anon hay public', () => {
    expect(SQL).toMatch(/alter table public\.repo_du_an enable row level security/i)
    expect(SQL).toMatch(/alter table public\.lien_ket_task enable row level security/i)
    expect(SQL).not.toMatch(/create policy[\s\S]*?to\s+anon/i)
    expect(SQL).not.toMatch(/\bto\s+public\b/i)
  })

  it('repo: ai thấy Dự án đọc; chỉ người quản lý được Dự án gắn và gỡ; không sửa tại chỗ', () => {
    expect(SQL).toMatch(/create policy repo_du_an_doc[\s\S]*?for select[\s\S]*?using \(rieng\.duoc_xem_du_an\(du_an_id\)\)/i)
    expect(SQL).toMatch(/create policy repo_du_an_tao[\s\S]*?for insert[\s\S]*?with check \(rieng\.duoc_quan_ly_du_an\(du_an_id\)\)/i)
    expect(SQL).toMatch(/create policy repo_du_an_go[\s\S]*?for delete[\s\S]*?using \(rieng\.duoc_quan_ly_du_an\(du_an_id\)\)/i)
    expect(SQL).not.toMatch(/on public\.repo_du_an\s+for update/i)
    expect(SQL).toMatch(/grant insert \(du_an_id, ten_repo\) on table public\.repo_du_an to authenticated/i)
    expect(SQL).not.toMatch(/grant\s+(all|update)[^;]*public\.repo_du_an[^;]*to\s+[^;]*authenticated/i)
  })

  it('link: ai thấy Task đọc; client không có quyền ghi thẳng bảng, chỉ hai hàm ghi', () => {
    expect(SQL).toMatch(/create policy lien_ket_task_doc[\s\S]*?for select[\s\S]*?using \(rieng\.duoc_xem_task\(task_id\)\)/i)
    expect(SQL).not.toMatch(/create policy lien_ket_task_(?!doc)/i)
    expect(SQL).toMatch(/grant select on table public\.lien_ket_task to authenticated/i)
    expect(SQL).not.toMatch(/grant\s+[^;]*\b(insert|update|delete|all)\b[^;]*public\.lien_ket_task[^;]*to\s+[^;]*authenticated/i)
    expect(SQL).toMatch(/revoke all on table public\.repo_du_an, public\.lien_ket_task from public, anon, authenticated/i)
    for (const ham of ['them_lien_ket_vao_task', 'go_lien_ket_khoi_task']) {
      expect(SQL).toMatch(new RegExp(`create function public\\.${ham}\\(`, 'i'))
      expect(SQL).toMatch(new RegExp(`grant execute on function[^;]*public\\.${ham}[^;]*to authenticated`, 'i'))
    }
  })

  it('ràng buộc: tên repo, không trùng không phân biệt hoa thường, loại và số của link, không trùng link', () => {
    for (const rangBuoc of [
      'repo_du_an_ten_hop_le',
      'repo_du_an_khong_trung',
      'lien_ket_task_loai_hop_le',
      'lien_ket_task_so_hop_le',
      'lien_ket_task_repo_hop_le',
      'lien_ket_task_khong_trung',
    ]) {
      expect(SQL).toContain(rangBuoc)
    }
    expect(SQL).toMatch(/ten_repo_khoa text generated always as \(lower\(ten_repo\)\) stored/)
    expect(SQL).toMatch(/unique \(du_an_id, ten_repo_khoa\)/)
    expect(SQL).toMatch(/unique \(task_id, repo_khoa, loai, so\)/)
    expect(SQL).toMatch(/loai in \('ISSUE', 'PR'\)/)
  })

  it('trigger và hàm ném đúng các mã lỗi của Kho', () => {
    expect(SQL).toMatch(/create trigger repo_du_an_truoc_khi_them\s+before insert on public\.repo_du_an/i)
    expect(SQL).toMatch(/create trigger repo_du_an_truoc_khi_go\s+before delete on public\.repo_du_an/i)
    for (const ma of [
      'KHONG_CO_QUYEN',
      'KHONG_TIM_THAY',
      'DU_AN_DA_LUU_TRU',
      'REPO_KHONG_HOP_LE',
      'REPO_DA_GAN',
      'LINK_KHONG_HOP_LE',
      'LINK_REPO_CHUA_GAN',
      'LINK_TRUNG',
      'CHUA_DANG_NHAP',
    ]) {
      expect(SQL).toContain(`raise exception '${ma}'`)
    }
  })

  it('cùng biểu thức tên repo ở ràng buộc, hàm và Edge Function; cùng định dạng với hàm thuần dùng chung', () => {
    const bieuThuc = "'^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/[A-Za-z0-9_.-]{1,100}$'"
    expect(SQL.split(bieuThuc).length - 1).toBe(3)
    // Dạng hợp lệ và không hợp lệ giống hệt nhau giữa biểu thức SQL (viết lại ở đây bằng JS) và hàm thuần.
    const sql = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}$/
    const khongPhaiDauCham = (r: string) => !/\/\.{1,2}$/.test(r)
    const cas = ['vercel/next.js', 'a/b', 'A-b/c_d.e', 'chu/..', 'chu/.', 'chu/...', '-chu/repo', 'chu-/repo', 'chu_so/repo', 'a/b/c', 'chu/', '/repo', `${'a'.repeat(40)}/r`, `chu/${'r'.repeat(101)}`, 'chu so/repo']
    for (const repo of cas) expect(sql.test(repo) && khongPhaiDauCham(repo), repo).toBe(chung.laTenRepoHopLe(repo))
  })

  it('hàm trigger của Task chỉ thêm đúng nhánh cờ link; vẫn giữ các luật của lát 2', () => {
    const hamMoi = SQL.slice(SQL.indexOf('create or replace function rieng.task_truoc_khi_sua()'))
    const hamGoc = boChuThichSql(migrationTask).slice(boChuThichSql(migrationTask).indexOf('create function rieng.task_truoc_khi_sua()'))
    expect(hamMoi).toContain("current_setting('rieng.dang_ghi_lien_ket', true)")
    expect(hamMoi).toMatch(/if v_dang_ghi_lien_ket and v_nguoi_goi is not null then[\s\S]*?return new;\s*end if;/)
    for (const ma of ['KHONG_CO_QUYEN', 'DU_AN_DA_LUU_TRU', 'TASK_DA_CHOT', 'THIEU_NGUOI', 'NGUOI_NGOAI_DU_AN', 'TRUNG_NGUOI']) {
      expect(hamMoi).toContain(`raise exception '${ma}'`)
    }
    expect(hamMoi).toContain("current_setting('rieng.dang_chuyen_trang_thai', true)")
    // Nhánh link chỉ đặt lại cột về giá trị cũ rồi đổi dấu vết; không được mở quyền đổi cột khác.
    const nhanh = /if v_dang_ghi_lien_ket and v_nguoi_goi is not null then([\s\S]*?)return new;/.exec(hamMoi)?.[1] ?? ''
    for (const cot of ['tieu_de', 'mo_ta', 'han', 'nguoi_thuc_hien_id', 'nguoi_kiem_tra_id', 'trang_thai', 'so_lan_tra_lai']) {
      expect(nhanh).toContain(`new.${cot} := old.${cot};`)
    }
    // Phần còn lại của hàm mới khớp từng dòng với hàm của lát 2 (chỉ khác nhánh và cờ thêm vào).
    const dongGoc = hamGoc.slice(0, hamGoc.indexOf('create trigger')).split('\n').map((d) => d.trim()).filter(Boolean)
    const dongMoi = hamMoi.slice(0, hamMoi.indexOf('create function public.them_lien_ket_vao_task')).split('\n').map((d) => d.trim()).filter(Boolean)
    const thuaSoVoiGoc = dongMoi.filter((d) => !dongGoc.includes(d))
    expect(thuaSoVoiGoc.every((d) => /dang_ghi_lien_ket|new\.(tieu_de|mo_ta|han|nguoi_thuc_hien_id|nguoi_kiem_tra_id|trang_thai|so_lan_tra_lai) := old\.|new\.sua_boi := v_nguoi_goi|new\.sua_luc := now|return new|end if|^create or replace function|^declare$/i.test(d) || d === '')).toBe(true)
    for (const dong of dongGoc) {
      if (/^create function/.test(dong)) continue
      expect(dongMoi, dong).toContain(dong)
    }
  })

  it('bản xuống bỏ mọi bảng và hàm mà bản lên tạo, và trả hàm trigger của Task về bản lát 2', () => {
    const bang = [...SQL.matchAll(/create table (public\.[a-z_]+)/gi)].map((m) => m[1])
    expect(bang.sort()).toEqual(['public.lien_ket_task', 'public.repo_du_an'])
    for (const ten of bang) expect(SQL_XUONG).toMatch(new RegExp(`drop table if exists ${ten.replace('.', '\\.')}\\b`, 'i'))
    const ham = [...SQL.matchAll(/create function ([a-z_]+\.[a-z_]+)\(/gi)].map((m) => m[1])
    expect(ham.length).toBeGreaterThan(0)
    for (const ten of ham) expect(SQL_XUONG).toMatch(new RegExp(`drop function if exists ${ten.replace('.', '\\.')}\\(`, 'i'))
    expect(SQL_XUONG).toMatch(/create or replace function rieng\.task_truoc_khi_sua\(\)/)
    expect(SQL_XUONG).not.toContain('dang_ghi_lien_ket')
    // Bản xuống chạy trước bản xuống lát 2 và nói rõ như vậy.
    expect(migrationXuong).toMatch(/TRƯỚC bản xuống của lát 2/)
  })
})

// --- Edge Function: một bản duy nhất của hàm chuyển đổi, chỉ đọc, token chỉ từ secret ---

describe('Edge Function doc-github: cấu trúc mã, không chạy Deno', () => {
  it('chỉ MỘT bản của hàm chuyển đổi: file dùng chung; ứng dụng và hàm cùng dùng đúng bản đó', () => {
    expect(luatGitHub.chuyenPhanHoiGitHub).toBe(chung.chuyenPhanHoiGitHub)
    expect(luatGitHub.phanTichLienKet).toBe(chung.phanTichLienKet)
    expect(luatGitHub.laTenRepoHopLe).toBe(chung.laTenRepoHopLe)
    expect(luatGitHub.thatBaiGitHub).toBe(chung.thatBaiGitHub)
    expect(luatGitHub.THONG_BAO_GITHUB_MAC_DINH).toBe(chung.THONG_BAO_GITHUB_MAC_DINH)
    // Không định nghĩa lại ở nơi nào khác.
    for (const nguon of [luatNguon, xuLyNguon, indexNguon, congEdgeNguon, khoGitHubNguon]) {
      expect(nguon).not.toMatch(/function\s+chuyenPhanHoiGitHub\b/)
      expect(nguon).not.toMatch(/function\s+phanTichLienKet\b/)
      expect(nguon).not.toMatch(/function\s+laTenRepoHopLe\b/)
    }
    expect(chungNguon.match(/export function chuyenPhanHoiGitHub\b/g)).toHaveLength(1)
    // Hàm lấy đúng file dùng chung, với đuôi .ts (Deno không tự thêm đuôi).
    expect(xuLyNguon).toMatch(/from '\.\.\/_shared\/github\.ts'/)
    expect(xuLyNguon).toMatch(/chuyenPhanHoiGitHub/)
    expect(luatNguon).toMatch(/from '\.\.\/\.\.\/supabase\/functions\/_shared\/github\.ts'/)
  })

  it('file dùng chung không import gì (Deno không có zod, không tự thêm đuôi .ts)', () => {
    expect(boChuThichTs(chungNguon)).not.toMatch(/^\s*import\s/m)
    expect(boChuThichTs(chungNguon)).not.toMatch(/from\s+['"]/)
    expect(boChuThichTs(chungNguon)).not.toMatch(/\bDate\.now|new Date\(|Math\.random|fetch\(/)
  })

  it('mọi import trong mã của hàm có đuôi .ts hoặc là npm:, không import từ src/ của ứng dụng', () => {
    for (const nguon of [xuLyNguon, indexNguon]) {
      for (const m of boChuThichTs(nguon).matchAll(/from\s+'([^']+)'/g)) {
        expect(m[1], m[1]).toMatch(/^(npm:|\.\.?\/.*\.ts$)/)
        expect(m[1]).not.toMatch(/src\//)
      }
    }
  })

  it('không có đường ghi lên GitHub: chỉ GET, không có phương thức ghi, chỉ api.github.com', () => {
    const ma = boChuThichTs(xuLyNguon) + boChuThichTs(indexNguon)
    expect(ma).not.toMatch(/['"`](POST|PUT|PATCH|DELETE)['"`]\s*[,}]/)
    // Một chỗ duy nhất đặt phương thức gửi GitHub (kiểu `method: 'GET'` của giao diện không tính).
    expect((boChuThichTs(xuLyNguon).match(/method: 'GET',/g) ?? []).length).toBe(1)
    expect(boChuThichTs(xuLyNguon)).toMatch(/method: 'GET',\s*headers:/)
    expect(ma).not.toMatch(/\/graphql|\/git\/|\/comments|\/merge|\/labels/)
    // Mọi URL gửi GitHub bắt đầu từ MAY_CHU_API_GITHUB; ngoài ra không có địa chỉ http nào khác.
    const diaChi = [...ma.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0])
    expect(diaChi.every((d) => d === 'https://api.github.com')).toBe(true)
    // Trong index.ts, `fetch` chỉ gọi bằng url và yêu cầu do xuLy dựng (không có chuỗi phương thức riêng).
    expect(indexNguon.match(/\bfetch\(/g)).toHaveLength(1)
  })

  it('token chỉ đọc từ secret của môi trường hàm; không có trong mã, trong cấu hình gửi trình duyệt hay cơ sở dữ liệu', () => {
    expect(indexNguon).toMatch(/Deno\.env\.get\('GITHUB_TOKEN_CHI_DOC'\)/)
    // Không có chuỗi giống token GitHub nằm trong mã nguồn.
    for (const [ten, nguon] of [
      ['xuLy.ts', xuLyNguon],
      ['index.ts', indexNguon],
      ['_shared/github.ts', chungNguon],
      ['congGitHubEdge.ts', congEdgeNguon],
      ['migration', migrationLen],
    ]) {
      expect(nguon, ten).not.toMatch(/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/)
      expect(nguon, ten).not.toMatch(/github_pat_[A-Za-z0-9_]{20,}/)
    }
    // Phía trình duyệt không biết tên secret, và không có biến VITE_* nào mang token GitHub.
    expect(congEdgeNguon).not.toMatch(/GITHUB_TOKEN/)
    expect(khoGitHubNguon).not.toMatch(/GITHUB_TOKEN/)
    expect(SQL).not.toMatch(/GITHUB_TOKEN/i)
    expect(SQL).not.toMatch(/\btoken\b/i)
    expect(`${xuLyNguon}${indexNguon}${congEdgeNguon}`).not.toMatch(/VITE_[A-Z_]*(GITHUB|TOKEN)/)
  })

  it('hàm không dùng khoá service: đọc cơ sở dữ liệu bằng phiên của người gọi, nên phân quyền từng dòng quyết định', () => {
    expect(indexNguon).not.toMatch(/SERVICE_ROLE|service_role/i)
    expect(indexNguon).toMatch(/SUPABASE_ANON_KEY/)
    expect(indexNguon).toMatch(/Authorization: `Bearer \$\{maTruyCap\}`/)
    expect(indexNguon).toMatch(/\.from\('repo_du_an'\)/)
    // Chỉ truy vấn đọc; không có ghi nào.
    expect(boChuThichTs(indexNguon)).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/)
  })

  it('thông báo lỗi của hàm không nội suy lỗi bắt được (catch không đọc biến lỗi)', () => {
    const ma = boChuThichTs(xuLyNguon)
    expect(ma).not.toMatch(/catch\s*\(/)
    // Chỉ `message` trong JSON của GitHub được đọc (để quyết định mã lỗi), không bao giờ `message` của một lỗi bắt được.
    expect(ma).not.toMatch(/\b(error|err|e|loi|lỗi)\.message\b/)
    expect(indexNguon).not.toMatch(/catch\s*\(\w+\)/)
  })
})
