// @vitest-environment node
// Test ĐỐI CHIẾU TÀI LIỆU với repo (ticket 18). Chỉ đọc file thuộc repo bằng Node `fs`; không mạng,
// không DB, không đồng hồ thật, không file ngoài repo. Môi trường test mặc định là node.
//
// Mục đích: tài liệu không được lệch khỏi repo. README gốc và supabase/README.md là thứ chủ dự án
// làm theo từng bước; một lệnh, đường dẫn hay thứ tự migration sai trong đó là một lỗi thật.
// Cổng KHÔNG kiểm được nội dung đúng của hướng dẫn trên Supabase thật (xem supabase/README.md,
// Phần C): ở đây chỉ kiểm cấu trúc và đối chiếu.
/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mucDieuHuong } from './luat/dieuHuong'
import { TEN_TRANG_THAI_DU_AN } from './luat/duAn'
import { TEN_TRANG_THAI_TASK } from './luat/task'
import { TEN_VAI } from './luat/taiKhoan'

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function doc(duongDan: string): string {
  return readFileSync(join(GOC, duongDan), 'utf8')
}

function lietKeFile(thuMuc: string, loc: (ten: string) => boolean): string[] {
  const ketQua: string[] = []
  for (const muc of readdirSync(join(GOC, thuMuc))) {
    const duongDan = `${thuMuc}/${muc}`
    if (statSync(join(GOC, duongDan)).isDirectory()) ketQua.push(...lietKeFile(duongDan, loc))
    else if (loc(muc)) ketQua.push(duongDan)
  }
  return ketQua.sort()
}

const README = doc('README.md')
const HUONG_DAN = doc('supabase/README.md')
const GLOSSARY = doc('GLOSSARY.md')
const SPEC = doc('.scratch/quan-ly-du-an/spec.md')
const SPEC_BO_CUC = doc('.scratch/bo-cuc-va-truong-moi/spec.md')
const AGENTS = doc('AGENTS.md')
const SCRIPTS = (JSON.parse(doc('package.json')) as { scripts: Record<string, string> }).scripts

/** Gộp xuống dòng và khoảng trắng để tìm cụm từ nhiều chữ. */
const gon = (vanBan: string) => vanBan.replace(/\s+/g, ' ')

/** Cắt một mục theo tiêu đề: từ dòng tiêu đề tới tiêu đề kế cùng cấp hoặc cao hơn. */
function mucTheoTieuDe(vanBan: string, batDau: RegExp): string {
  const dong = vanBan.split('\n')
  const i = dong.findIndex((d) => batDau.test(d))
  if (i < 0) throw new Error(`Không thấy mục ${batDau}`)
  const cap = (dong[i]?.match(/^#+/) ?? [''])[0].length
  let j = i + 1
  while (j < dong.length && !new RegExp(`^#{1,${cap}} `).test(dong[j] ?? '')) j += 1
  return dong.slice(i, j).join('\n')
}

/** Các hàng của một bảng markdown: [ô 1, ô 2, ...], bỏ dòng tiêu đề và dòng kẻ. */
function hangBang(vanBan: string): string[][] {
  return vanBan
    .split('\n')
    .filter((d) => d.startsWith('|') && !/^\|[\s|:-]+\|$/.test(d))
    .slice(1)
    .map((d) => d.split('|').slice(1, -1).map((o) => o.trim()))
}

describe('README gốc: lệnh đối chiếu với package.json', () => {
  it('mọi lệnh `npm run ...` và `npm test` được nhắc đều có trong package.json', () => {
    for (const [ten, vanBan] of [['README.md', README], ['supabase/README.md', HUONG_DAN]] as const) {
      for (const m of vanBan.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
        expect(Object.keys(SCRIPTS), `${ten}: npm run ${m[1]}`).toContain(m[1])
      }
      if (/npm test\b/.test(vanBan)) expect(Object.keys(SCRIPTS)).toContain('test')
    }
  })

  it('danh sách lệnh trong README liệt kê mọi script của package.json', () => {
    const muc = mucTheoTieuDe(README, /^## Các lệnh của dự án/)
    for (const ten of Object.keys(SCRIPTS)) {
      const lenh = ten === 'test' ? 'npm test' : `npm run ${ten}`
      expect(muc, `thiếu lệnh ${lenh}`).toContain(`\`${lenh}`)
    }
  })

  it('lệnh chạy bộ test trên Supabase thật có mặt và trỏ tới file cấu hình có thật', () => {
    const lenh = 'npx vitest run --config vitest.supabase.config.ts'
    expect(README).toContain(lenh)
    expect(HUONG_DAN).toContain(lenh)
    expect(AGENTS).toContain(lenh)
    expect(existsSync(join(GOC, 'vitest.supabase.config.ts'))).toBe(true)
    // Lệnh này không nằm trong `npm test`.
    expect(Object.values(SCRIPTS).join('\n')).not.toContain('vitest.supabase.config.ts')
  })

  it('mọi lệnh `npx astryx` và `npx vitest` trong README có đích thật', () => {
    for (const m of README.matchAll(/npx (\w+)/g)) expect(['astryx', 'vitest']).toContain(m[1])
    expect(SCRIPTS.astryx).toBeDefined()
  })

  it('cách chạy thử đúng với cấu hình: bản bộ nhớ khi không có biến VITE_SUPABASE_*', () => {
    const muc = mucTheoTieuDe(README, /^## Chạy thử trên máy/)
    expect(muc).toContain('npm run dev')
    expect(muc).toContain('VITE_SUPABASE_URL')
    expect(muc).toContain('VITE_SUPABASE_ANON_KEY')
    expect(muc).toMatch(/bản bộ nhớ/)
    const khoBoNho = doc('src/kho/khoBoNho.ts')
    // PM chạy thử được nêu trong README phải đúng với mã.
    const email = /email: '([^']+)'/.exec(khoBoNho.slice(khoBoNho.indexOf('PM_CHAY_THU')))?.[1]
    const matKhau = /matKhau: '([^']+)'/.exec(khoBoNho.slice(khoBoNho.indexOf('PM_CHAY_THU')))?.[1]
    expect(email).toBeDefined()
    expect(matKhau).toBeDefined()
    expect(muc).toContain(email)
    expect(muc).toContain(matKhau)
  })
})

describe('README gốc: nội dung bắt buộc', () => {
  it('nêu mục đích và ba vai hệ thống', () => {
    expect(README).toMatch(/PM/)
    const muc = mucTheoTieuDe(README, /^## Ba vai/)
    for (const vai of Object.values(TEN_VAI)) expect(muc).toContain(`**${vai}**`)
  })

  it('các màn chính trùng với thanh điều hướng của ứng dụng và có trang tổng quan', () => {
    const muc = mucTheoTieuDe(README, /^## Các màn chính/)
    // Mục điều hướng nằm ở luật thuần (`luat/dieuHuong.ts`); PM thấy đủ mọi mục.
    const nhanCuaPM = mucDieuHuong('PM').map((m) => m.nhan)
    for (const nhan of ['Dự án của tôi', 'Việc của tôi', 'Chờ tôi duyệt', 'Tất cả Dự án', 'Hồ sơ', 'Người dùng']) {
      expect(nhanCuaPM, `ứng dụng không có mục ${nhan}`).toContain(nhan)
      expect(muc, `README thiếu màn ${nhan}`).toContain(nhan)
    }
    for (const tu of ['Đăng ký', 'Đăng nhập', 'Chi tiết Dự án', 'Chi tiết Task', 'Kanban', 'Trang tổng quan', 'Tiến độ', 'Trễ hạn']) {
      expect(muc, `README thiếu ${tu}`).toContain(tu)
    }
  })

  it('mô tả kiến trúc: Kho dữ liệu, Cổng GitHub, bảng ca dùng chung và hai bản cài', () => {
    const muc = mucTheoTieuDe(README, /^## Kiến trúc/)
    for (const tu of ['Kho dữ liệu', 'Cổng GitHub', 'Bảng ca dùng chung', 'bản bộ nhớ', 'bản Supabase', 'Edge Function', 'bộ test hợp đồng']) {
      expect(muc.toLowerCase(), `thiếu ${tu}`).toContain(tu.toLowerCase())
    }
  })

  it('đường dẫn trong dấu huyền của hai README trỏ tới file có thật', () => {
    const boQua = new Set(['supabase/config.toml'])
    for (const [ten, vanBan, goc] of [['README.md', README, ['']], ['supabase/README.md', HUONG_DAN, ['', 'supabase/']]] as const) {
      for (const m of vanBan.matchAll(/`([^`\s]+)`/g)) {
        const duongDan = m[1] ?? ''
        const laDuongDan =
          /^(\.?[\w-]+\/)+[\w.-]+\.(ts|tsx|sql|html|md|json)$/.test(duongDan) ||
          /^(src|supabase|migrations|down|functions|templates)\/[\w./-]+$/.test(duongDan) ||
          duongDan === '.env.example'
        if (!laDuongDan || /[*<>]|\.\.\./.test(duongDan) || boQua.has(duongDan)) continue
        const coThat = goc.some((g) => existsSync(join(GOC, g + duongDan.replace(/\/$/, ''))))
        expect(coThat, `${ten}: \`${duongDan}\` không có trong repo`).toBe(true)
      }
    }
  })

  it('liên kết markdown tương đối trỏ tới file có thật', () => {
    for (const m of README.matchAll(/\]\(([^)#\s]+)\)/g)) {
      const dich = m[1] ?? ''
      if (/^https?:/.test(dich)) continue
      expect(existsSync(join(GOC, dich)), `README: liên kết ${dich}`).toBe(true)
    }
  })
})

describe('Hướng dẫn Supabase: các bước theo thứ tự', () => {
  const cacBuoc = [...HUONG_DAN.matchAll(/^### Bước (\d+)\. (.+)$/gm)].map((m) => ({ so: Number(m[1]), ten: m[2] ?? '' }))

  it('các bước đánh số liên tiếp từ 1 và mỗi bước nói rõ ai làm và kiểm kết quả thế nào', () => {
    expect(cacBuoc.length).toBeGreaterThanOrEqual(11)
    cacBuoc.forEach((b, i) => expect(b.so).toBe(i + 1))
    for (const b of cacBuoc) {
      const muc = mucTheoTieuDe(HUONG_DAN, new RegExp(`^### Bước ${b.so}\\. `))
      expect(muc, `Bước ${b.so} thiếu "Ai làm"`).toMatch(/\*\*Ai làm:\*\*/)
      expect(muc, `Bước ${b.so} thiếu "Kiểm"`).toMatch(/\*\*Kiểm:\*\*/)
    }
  })

  it('đủ các việc của ticket và đúng thứ tự: project, đăng ký email, migration, PM đầu tiên, token, secret, Edge Function', () => {
    const viTri = (mau: RegExp) => {
      const b = cacBuoc.find((x) => mau.test(x.ten))
      expect(b, `không có bước khớp ${mau}`).toBeDefined()
      return b?.so ?? -1
    }
    const thuTu = [
      viTri(/project Supabase/i),
      viTri(/đăng ký email/i),
      viTri(/migration/i),
      viTri(/PM đầu tiên/i),
      viTri(/token GitHub/i),
      viTri(/^Đặt secret/i),
      viTri(/^Triển khai Edge Function/i),
    ]
    expect(thuTu).toEqual([...thuTu].sort((a, b) => a - b))
    expect(new Set(thuTu).size).toBe(thuTu.length)
  })

  it('bước đăng ký email nói rõ phải bật xác nhận email', () => {
    const muc = mucTheoTieuDe(HUONG_DAN, /^### Bước 2\./)
    expect(muc).toMatch(/Confirm email/)
  })

  it('bước migration liệt kê MỌI file trong supabase/migrations đúng thứ tự tên, và mọi file xuống', () => {
    const lenLen = lietKeFile('supabase/migrations', (t) => t.endsWith('.sql')).map((d) => d.split('/').pop() ?? '')
    const lenXuong = lietKeFile('supabase/down', (t) => t.endsWith('.sql')).map((d) => d.split('/').pop() ?? '')
    expect(lenLen.length).toBeGreaterThanOrEqual(4)
    const muc = mucTheoTieuDe(HUONG_DAN, /^### Bước 4\./)
    const viTri = lenLen.map((ten) => {
      const i = muc.indexOf(`migrations/${ten}`)
      expect(i, `bước migration thiếu ${ten}`).toBeGreaterThanOrEqual(0)
      return i
    })
    expect(viTri).toEqual([...viTri].sort((a, b) => a - b))
    // Số thứ tự trong tên tăng dần: thứ tự liệt kê chính là thứ tự áp.
    expect(lenLen).toEqual([...lenLen].sort())
    expect(lenXuong.length).toBe(lenLen.length)
    // Bản xuống: nhắc thư mục down/ và thứ tự ngược.
    expect(muc).toContain('down/')
    expect(muc).toMatch(/ngược/)
  })

  it('migration được nêu trong các phần khác của hướng dẫn đều có thật', () => {
    const co = new Set(lietKeFile('supabase/migrations', () => true).map((d) => d.split('/').pop()))
    const coXuong = new Set(lietKeFile('supabase/down', () => true).map((d) => d.split('/').pop()))
    for (const m of HUONG_DAN.matchAll(/migrations\/(\d{14}_[\w]+\.sql)/g)) expect(co.has(m[1]), m[1]).toBe(true)
    for (const m of HUONG_DAN.matchAll(/down\/(\d{14}_[\w.]+\.sql)/g)) expect(coXuong.has(m[1]), m[1]).toBe(true)
  })

  it('đặt PM đầu tiên bằng SQL trên bảng ho_so có thật', () => {
    const muc = mucTheoTieuDe(HUONG_DAN, /^### Bước 7\./)
    expect(muc).toMatch(/update public\.ho_so set vai = 'PM'/)
    expect(doc('supabase/migrations/20261125000100_lat_1_ho_so_du_an.sql')).toContain('create table public.ho_so')
  })

  it('secret và Edge Function khớp với mã của hàm', () => {
    const index = doc('supabase/functions/doc-github/index.ts')
    const ten = /GITHUB_TOKEN_CHI_DOC/.exec(HUONG_DAN)
    expect(ten).not.toBeNull()
    expect(index).toContain('GITHUB_TOKEN_CHI_DOC')
    expect(HUONG_DAN).toContain('supabase secrets set GITHUB_TOKEN_CHI_DOC=')
    expect(HUONG_DAN).toContain('supabase functions deploy doc-github')
    expect(existsSync(join(GOC, 'supabase/functions/doc-github/index.ts'))).toBe(true)
    // Token chỉ đọc: hướng dẫn nêu quyền Read-only và không cấp quyền ghi.
    const muc = mucTheoTieuDe(HUONG_DAN, /^### Bước 8\./)
    expect(muc).toMatch(/Issues: Read-only/)
    expect(muc).toMatch(/Pull requests: Read-only/)
  })

  it('mẫu thư đặt lại mật khẩu được nhắc có thật và có mã {{ .Token }}', () => {
    expect(HUONG_DAN).toContain('templates/dat-lai-mat-khau.html')
    expect(doc('supabase/templates/dat-lai-mat-khau.html')).toContain('{{ .Token }}')
  })

  it('biến môi trường được nêu có trong .env.example và mã cấu hình', () => {
    const mau = doc('.env.example')
    const cauHinh = doc('src/kho/cauHinh.ts')
    for (const bien of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
      expect(HUONG_DAN).toContain(bien)
      expect(mau).toContain(bien)
      expect(cauHinh).toContain(bien)
    }
    for (const bien of ['SUPABASE_TEST_URL', 'SUPABASE_TEST_ANON_KEY', 'SUPABASE_TEST_SERVICE_ROLE_KEY']) {
      expect(HUONG_DAN).toContain(bien)
      expect(mau).toContain(bien)
    }
  })

  it('không tài liệu nào khuyên đặt khoá service vào biến VITE_*', () => {
    for (const [ten, vanBan] of [['README.md', README], ['supabase/README.md', HUONG_DAN], ['.env.example', doc('.env.example')]] as const) {
      expect(vanBan, ten).not.toMatch(/VITE_[A-Z0-9_]*(SERVICE|SECRET)/)
      // Mọi dòng điền một biến VITE_*= phải không kèm khoá service.
      for (const dong of vanBan.split('\n')) {
        if (/^\s*VITE_[A-Z_]+=/.test(dong)) expect(dong, ten).not.toMatch(/service_role|sb_secret_/)
      }
    }
    expect(HUONG_DAN).toMatch(/Không bao giờ[^\n]*(service_role|khoá service)/i)
  })
})

describe('Hướng dẫn Supabase: danh sách kiểm tay RLS', () => {
  const cacMuc = [...HUONG_DAN.matchAll(/^### Mục kiểm (\d+): (.+)$/gm)].map((m) => ({ so: Number(m[1]), ten: m[2] ?? '' }))

  it('có đúng bảy mục kiểm, đánh số 1 đến 7', () => {
    expect(cacMuc.map((m) => m.so)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('mỗi mục có cách kiểm cụ thể và kết quả mong đợi', () => {
    for (const m of cacMuc) {
      const muc = mucTheoTieuDe(HUONG_DAN, new RegExp(`^### Mục kiểm ${m.so}: `))
      expect(muc, `mục ${m.so} thiếu cách kiểm`).toMatch(/\*\*Cách kiểm:\*\*/)
      expect(muc, `mục ${m.so} thiếu kết quả mong đợi`).toMatch(/\*\*Kết quả mong đợi:\*\*/)
      // Cách kiểm cụ thể: có câu lệnh hoặc lệnh gọi, không chỉ lời văn.
      expect(muc, `mục ${m.so} không có lệnh cụ thể`).toMatch(/`[^`]*(select|update|insert|delete|npx|POST|rpc|Authorization)[^`]*`/i)
    }
  })

  it('bảy mục đúng là bảy mục của ticket (theo từng ý)', () => {
    const ten = cacMuc.map((m) => m.ten.toLowerCase())
    const mongDoi: RegExp[] = [
      /người lạ.*không đọc được gì.*hồ sơ của mình/,
      /thành viên không sửa được dự án hay task.*không tự nâng vai/,
      /người ngoài dự án không đọc và không ghi được task/,
      /không ghi thẳng được cột trạng thái.*hàm kiểm luật/,
      /người kiểm tra trùng người thực hiện bị từ chối ở cơ sở dữ liệu/,
      /chạy toàn bộ bảng ca dùng chung trên supabase thật và đạt/,
      /edge function từ chối người chưa đăng nhập và repo chưa gắn/,
    ]
    mongDoi.forEach((mau, i) => expect(ten[i], `mục ${i + 1}`).toMatch(mau))
  })

  it('các mục nhắc đúng bảng, hàm và mã lỗi có thật trong migration', () => {
    const sql = lietKeFile('supabase/migrations', (t) => t.endsWith('.sql')).map(doc).join('\n')
    const phan = mucTheoTieuDe(HUONG_DAN, /^## Phần B\./)
    for (const bang of ['ho_so', 'du_an', 'nguoi_trong_du_an', 'task', 'lich_su_trang_thai_task', 'repo_du_an', 'lien_ket_task']) {
      expect(phan, bang).toContain(`public.${bang}`)
      expect(sql, bang).toContain(`create table public.${bang}`)
    }
    expect(phan).toContain('doi_trang_thai_task')
    expect(sql).toContain('create function public.doi_trang_thai_task')
    for (const ma of ['KHONG_CO_QUYEN', 'TRUNG_NGUOI', 'NGUOI_NGOAI_DU_AN', 'THIEU_NGUOI', 'BUOC_KHONG_HOP_LE', 'LY_DO_BAT_BUOC', 'TASK_DA_CHOT', 'DU_AN_DA_LUU_TRU', 'PHAI_CON_PM']) {
      expect(phan, ma).toContain(ma)
      expect(sql, `${ma} không có trong migration`).toContain(`'${ma}'`)
    }
    // Hai bảng ca dùng chung có thật.
    expect(phan).toContain('BANG_CA_QUYEN')
    expect(phan).toContain('BANG_CA_CHUYEN_TRANG_THAI')
    expect(doc('src/kho/bangCaQuyen.ts')).toContain('BANG_CA_QUYEN')
    expect(doc('src/kho/bangCaChuyenTrangThai.ts')).toContain('BANG_CA_CHUYEN_TRANG_THAI')
  })

  it('mục Edge Function gọi đúng đường dẫn và dạng thân yêu cầu của Cổng GitHub', () => {
    const muc = mucTheoTieuDe(HUONG_DAN, /^### Mục kiểm 7:/)
    const edge = doc('src/github/congGitHubEdge.ts')
    expect(muc).toContain('/functions/v1/doc-github')
    expect(edge).toContain('/functions/v1/')
    expect(doc('supabase/functions/_shared/github.ts')).toMatch(/TEN_HAM_DOC_GITHUB = 'doc-github'/)
    expect(muc).toContain('cacLienKet')
    expect(edge).toContain('cacLienKet')
    expect(muc).toMatch(/401/)
    expect(muc).toContain('KHONG_TIM_THAY')
    expect(muc).toMatch(/github_pat_/)
  })
})

/**
 * Một gạch đầu dòng in đậm `- **tiêu đề**...` kèm các dòng thụt sâu hơn bên dưới nó (phần tiếp của chính gạch
 * đó), dừng ở gạch cùng cấp, dòng thụt nông hơn hay dòng trống.
 */
function gachDauDong(vanBan: string, tieuDe: string): string {
  const dong = vanBan.split('\n')
  const i = dong.findIndex((d) => /^\s*- \*\*/.test(d) && d.includes(`**${tieuDe}**`))
  if (i < 0) throw new Error(`Không thấy gạch đầu dòng **${tieuDe}**`)
  const thut = (d: string) => (d.match(/^\s*/) ?? [''])[0].length
  const cap = thut(dong[i] ?? '')
  let j = i + 1
  while (j < dong.length && (dong[j] ?? '').trim() !== '' && thut(dong[j] ?? '') > cap) j += 1
  return dong.slice(i, j).join('\n')
}

describe('Hướng dẫn Supabase: trường mới (ticket truong-moi 11)', () => {
  const LEN_DU_AN = '20261126000500_truong_du_an'
  const LEN_TASK_HO_SO = '20261126000600_truong_task_ho_so_nguoi'
  const nangCap = mucTheoTieuDe(HUONG_DAN, /^### Nâng cấp lên trường mới/)
  const phanDDuAn = mucTheoTieuDe(HUONG_DAN, /^## Trường mới của Dự án trên Supabase/)
  const phanDTaskHoSo = mucTheoTieuDe(HUONG_DAN, /^## Task, hồ sơ và Người trong dự án trên Supabase/)

  it('hai migration mới và hai bản xuống có thật, được nêu ở bước migration và ở mục nâng cấp', () => {
    for (const ten of [LEN_DU_AN, LEN_TASK_HO_SO]) {
      expect(existsSync(join(GOC, `supabase/migrations/${ten}.sql`)), ten).toBe(true)
      expect(existsSync(join(GOC, `supabase/down/${ten}.down.sql`)), ten).toBe(true)
    }
    const buocMigration = mucTheoTieuDe(HUONG_DAN, /^### Bước 4\./)
    for (const muc of [buocMigration, nangCap]) {
      for (const ten of [LEN_DU_AN, LEN_TASK_HO_SO]) {
        expect(muc, ten).toContain(`migrations/${ten}.sql`)
        expect(muc, ten).toContain(`down/${ten}.down.sql`)
      }
    }
  })

  it('mục nâng cấp: áp 000500 trước 000600, quay lại bằng bản xuống theo thứ tự ngược', () => {
    expect(nangCap.indexOf(`migrations/${LEN_DU_AN}.sql`)).toBeLessThan(nangCap.indexOf(`migrations/${LEN_TASK_HO_SO}.sql`))
    const quayLai = nangCap.slice(nangCap.search(/\*\*Quay lại\*\*/))
    expect(quayLai.length).toBeLessThan(nangCap.length)
    expect(quayLai).toMatch(/ngược/)
    expect(quayLai.indexOf(`down/${LEN_TASK_HO_SO}.down.sql`)).toBeGreaterThanOrEqual(0)
    expect(quayLai.indexOf(`down/${LEN_TASK_HO_SO}.down.sql`)).toBeLessThan(quayLai.indexOf(`down/${LEN_DU_AN}.down.sql`))
    // Thứ tự này đúng với chính bản xuống: 000600 phải chạy trước 000500.
    expect(gon(doc(`supabase/down/${LEN_TASK_HO_SO}.down.sql`))).toMatch(new RegExp(`TRƯỚC bản xuống của ${LEN_DU_AN}`))
  })

  it('mục nâng cấp có bước sửa mã tạm DA-… thành mã thật, sau bước kiểm tay, khớp với migration', () => {
    const suaMa = nangCap.search(/\*\*Sửa mã tạm `DA-…` thành mã thật\*\*/)
    const kiemTay = nangCap.search(/\*\*Kiểm tay bốn mục mới\*\*/)
    expect(suaMa).toBeGreaterThanOrEqual(0)
    expect(kiemTay).toBeGreaterThanOrEqual(0)
    expect(kiemTay).toBeLessThan(suaMa)
    // Có câu lệnh cụ thể để liệt kê Dự án còn mã tạm.
    expect(nangCap).toMatch(/`select [^`]*from public\.du_an where ma like 'DA-%'[^`]*`/)
    // Migration thật sự gán mã tạm dạng DA-.
    expect(doc(`supabase/migrations/${LEN_DU_AN}.sql`)).toMatch(/set ma = 'DA-'/)
    // Bước kiểm tay tổng (Phần A) và Phần B trỏ tới mục nâng cấp.
    expect(mucTheoTieuDe(HUONG_DAN, /^### Bước 13\./)).toMatch(/bốn mục kiểm tay của trường mới/)
    expect(mucTheoTieuDe(HUONG_DAN, /^## Phần B\./)).toMatch(/Nâng cấp lên trường mới/)
  })

  // Bốn mục kiểm tay mới của ticket: tiêu đề, phần Phần D chứa cách kiểm chi tiết, và những gì cách kiểm
  // đó phải nhắc (câu lệnh cụ thể và kết quả mong đợi).
  const BON_MUC: ReadonlyArray<{ tieuDe: string; phan: () => string; phaiCo: Array<string | RegExp> }> = [
    {
      tieuDe: 'Quyền xem Thông tin nhân sự theo từng dòng',
      phan: () => phanDTaskHoSo,
      phaiCo: [/select so_dien_thoai from public\.ho_so/, /không cùng Dự án/, /không trả dòng nào/, /Lưu trữ/],
    },
    {
      tieuDe: 'Trùng Mã Dự án khác hoa thường bị từ chối',
      phan: () => phanDDuAn,
      phaiCo: [/insert into public\.du_an/, /lower\(/, 'du_an_ma_key', /Lưu trữ/],
    },
    {
      tieuDe: 'Người phụ trách về trống khi bị gỡ',
      phan: () => phanDDuAn,
      phaiCo: [/delete from public\.nguoi_trong_du_an/, 'nguoi_phu_trach_id', /null/],
    },
    {
      tieuDe: 'Thành viên không đổi được Mức ưu tiên của Task',
      phan: () => phanDTaskHoSo,
      phaiCo: [/update public\.task set muc_uu_tien/, /Người thực hiện/, /Người kiểm tra/, /không đổi dòng nào/],
    },
  ]

  it('mục nâng cấp liệt kê đủ bốn mục kiểm tay mới', () => {
    for (const m of BON_MUC) expect(gachDauDong(nangCap, m.tieuDe), m.tieuDe).toBeTruthy()
  })

  it.each(BON_MUC)('Phần D có cách kiểm cụ thể cho "$tieuDe"', ({ tieuDe, phan, phaiCo }) => {
    const muc = gon(gachDauDong(phan(), tieuDe))
    for (const mau of phaiCo) {
      if (typeof mau === 'string') expect(muc, `${tieuDe}: thiếu ${mau}`).toContain(mau)
      else expect(muc, `${tieuDe}: thiếu ${mau}`).toMatch(mau)
    }
  })

  it('tên ràng buộc và cột được nhắc trong bốn mục có trong migration', () => {
    const sql = [LEN_DU_AN, LEN_TASK_HO_SO].map((ten) => doc(`supabase/migrations/${ten}.sql`)).join('\n')
    expect(sql).toMatch(/create unique index du_an_ma_key on public\.du_an \(upper\(ma\)\)/)
    for (const cot of ['nguoi_phu_trach_id', 'so_dien_thoai', 'muc_uu_tien']) expect(sql, cot).toContain(`add column ${cot}`)
    expect(sql).toContain('on delete set null (nguoi_phu_trach_id)')
  })
})

describe('Hướng dẫn Supabase: cổng không kiểm được', () => {
  const phanC = mucTheoTieuDe(HUONG_DAN, /^## Phần C\./)

  it('liệt kê rõ sáu thứ cổng test không kiểm được', () => {
    for (const tu of ['bản Supabase', 'migration', 'phân quyền từng dòng', 'hàm cơ sở dữ liệu', 'Edge Function', 'GitHub thật', 'luồng email']) {
      expect(gon(phanC).toLowerCase(), `thiếu ${tu}`).toContain(tu.toLowerCase())
    }
  })

  it('nói rằng chưa kiểm xong danh sách thì chưa đưa lên mạng (hướng dẫn và README gốc)', () => {
    const cau = /chưa kiểm xong danh sách[^.\n]*thì chưa đưa[^.\n]*lên mạng/i
    expect(phanC).toMatch(cau)
    expect(README).toMatch(cau)
    expect(HUONG_DAN).toMatch(/Bước 13\. Chỉ khi bảy mục đạt mới đưa lên mạng/)
  })

  it('README gốc cũng nêu các thứ cổng không kiểm được', () => {
    const muc = mucTheoTieuDe(README, /^## Supabase và điều kiện/)
    for (const tu of ['bản Supabase', 'migration', 'phân quyền từng dòng', 'hàm cơ sở dữ liệu', 'Edge Function', 'luồng email']) {
      expect(gon(muc).toLowerCase(), `thiếu ${tu}`).toContain(tu.toLowerCase())
    }
  })
})

describe('Bảng thuật ngữ khớp spec và GLOSSARY', () => {
  const TU_CUA_SPEC = [
    'Dự án', 'Task', 'Người thực hiện', 'Người kiểm tra', 'Người trong dự án', 'PM', 'Support', 'Thành viên',
    'Chờ duyệt', 'Hoàn thành', 'Trả lại', 'Bị lỗi', 'Huỷ', 'Lưu trữ', 'Dấu vết', 'Tiến độ', 'Trễ hạn',
  ]

  /** Bỏ dấu `**`, phần trong ngoặc và dấu chấm cuối để so nghĩa giữa các văn bản. */
  const chuanHoa = (nghia: string) =>
    nghia.replace(/\*\*/g, '').replace(/\s*\(.*$/, '').replace(/[.\s]+$/, '').replace(/\.\s*$/, '').trim()

  function bangTuVung(vanBan: string) {
    const bang = new Map<string, { nghia: string; dungViet: string }>()
    for (const [o1 = '', o2 = '', o3 = ''] of hangBang(mucTheoTieuDe(vanBan, /^## Từ vựng|^# Từ vựng/))) {
      bang.set(o1.replace(/\*\*/g, ''), { nghia: o2, dungViet: o3 })
    }
    return bang
  }

  const glossary = bangTuVung(GLOSSARY)
  const spec = bangTuVung(SPEC)

  /** Tìm hàng chứa từ (hàng "PM / Support / Thành viên" chứa ba từ). */
  function hangCuaTu(bang: Map<string, { nghia: string; dungViet: string }>, tu: string) {
    for (const [khoa, gtri] of bang) if (khoa.split(' / ').includes(tu)) return gtri
    return undefined
  }

  it('GLOSSARY có đủ các từ của spec, và nghĩa khớp spec', () => {
    for (const tu of TU_CUA_SPEC) {
      const g = hangCuaTu(glossary, tu)
      const s = hangCuaTu(spec, tu)
      expect(g, `GLOSSARY thiếu ${tu}`).toBeDefined()
      expect(s, `spec thiếu ${tu}`).toBeDefined()
      expect(chuanHoa(g?.nghia ?? ''), `nghĩa của ${tu}`).toBe(chuanHoa(s?.nghia ?? ''))
    }
  })

  it('bảng thuật ngữ trong README gốc có đủ các từ và nghĩa đúng như GLOSSARY', () => {
    const bang = bangTuVung(README.replace(/^## Thuật ngữ/m, '## Từ vựng'))
    for (const tu of TU_CUA_SPEC) {
      const r = hangCuaTu(bang, tu)
      const g = hangCuaTu(glossary, tu)
      expect(r, `README thiếu ${tu}`).toBeDefined()
      expect(r?.nghia, `nghĩa của ${tu}`).toBe(g?.nghia)
    }
  })

  it('GLOSSARY có đủ mười từ mới của spec bố cục và trường mới, nghĩa và "Đừng viết" khớp spec', () => {
    const TU_MOI = [
      'Mã Dự án', 'Khách hàng', 'Người phụ trách', 'Mức ưu tiên', 'Quá hạn dự kiến', 'Vai trò trong Dự án',
      'Thông tin nhân sự', 'Tổng quan', 'Thanh bên', 'Ngăn trượt',
    ]
    const specMoi = bangTuVung(SPEC_BO_CUC)
    // Bảng từ vựng của spec bố cục đúng là mười từ này: thêm từ vào spec thì danh sách ở đây phải theo.
    expect([...specMoi.keys()].sort()).toEqual([...TU_MOI].sort())
    for (const tu of TU_MOI) {
      const g = hangCuaTu(glossary, tu)
      const s = hangCuaTu(specMoi, tu)
      expect(g, `GLOSSARY thiếu ${tu}`).toBeDefined()
      // GLOSSARY được phép nói thêm sau nghĩa của spec (vd. ai xem được Thông tin nhân sự), không được nói khác.
      expect(chuanHoa(g?.nghia ?? ''), `nghĩa của ${tu}`).toMatch(new RegExp(`^${chuanHoa(s?.nghia ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
      expect(g?.dungViet, `"Đừng viết" của ${tu}`).toBe(s?.dungViet)
    }
  })

  it('GLOSSARY có các từ kỹ thuật mới của lát tài liệu', () => {
    const muc = mucTheoTieuDe(GLOSSARY, /^## Từ kỹ thuật/)
    for (const tu of ['Kho dữ liệu', 'Bảng ca dùng chung', 'Cổng GitHub', 'Edge Function', 'Danh sách kiểm tay']) {
      expect(muc, tu).toContain(`**${tu}**`)
    }
  })

  it('văn bản giao diện dùng đúng tên trạng thái và vai theo từ vựng', () => {
    const tenTrangThai = Object.values(TEN_TRANG_THAI_TASK)
    for (const tu of ['Mới', 'Đang làm', 'Chờ duyệt', 'Hoàn thành', 'Trả lại', 'Bị lỗi', 'Huỷ']) expect(tenTrangThai).toContain(tu)
    for (const tu of ['Chờ duyệt', 'Hoàn thành', 'Trả lại', 'Bị lỗi', 'Huỷ']) expect(hangCuaTu(glossary, tu), tu).toBeDefined()
    expect(Object.values(TEN_VAI)).toEqual(['PM', 'Support', 'Thành viên'])
    for (const vai of Object.values(TEN_VAI)) expect(hangCuaTu(glossary, vai), vai).toBeDefined()
    expect(Object.values(TEN_TRANG_THAI_DU_AN)).toContain('Lưu trữ')
  })

  it('giao diện và luật không dùng các từ GLOSSARY bảo đừng viết', () => {
    // Danh sách này là tập con của cột "Đừng viết" trong GLOSSARY (kiểm ngay bên dưới). Chỉ chọn từ
    // không thể xuất hiện hợp lệ trong chữ tiếng Việt của giao diện. Không đưa vào: "issue" (issue
    // của GitHub), "xoá" (xoá ô nhập, khác với Huỷ Task), "user".
    const dungViet = ['project', 'công việc', 'ticket', 'assignee', 'reviewer', 'thành viên dự án', 'admin', 'audit log']
    const cot = [...glossary.values()].map((g) => g.dungViet.toLowerCase()).join(' | ')
    for (const tu of dungViet) expect(cot, `GLOSSARY không còn ghi "${tu}" là từ đừng viết`).toContain(tu)

    const files = [...lietKeFile('src/giaoDien', (t) => /\.tsx?$/.test(t) && !/\.test\./.test(t)), ...lietKeFile('src/luat', (t) => /\.ts$/.test(t) && !/\.test\./.test(t))]
    expect(files.length).toBeGreaterThan(10)
    for (const f of files) {
      // Bỏ ghi chú (không phải chữ hiển thị) trước khi tìm.
      const ma = doc(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      for (const tu of dungViet) {
        // Ngoại lệ có chủ đích: tiêu đề nhóm "Công việc" trên Thanh bên (spec bố cục, ticket 01) gom Việc
        // của tôi và Chờ tôi duyệt; ở đó "công việc" là tên nhóm, không phải cách gọi một Task.
        if (f === 'src/luat/dieuHuong.ts' && tu === 'công việc') continue
        expect(ma.toLowerCase(), `${f} dùng từ "${tu}", GLOSSARY bảo đừng viết`).not.toMatch(new RegExp(`(^|[^\\p{L}])${tu}([^\\p{L}]|$)`, 'u'))
      }
    }
  })
})
