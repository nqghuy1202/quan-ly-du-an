// Edge Function `doc-github` (ticket 17): đọc trạng thái issue hoặc PR trên GitHub, CHỈ ĐỌC.
// Mọi luật nằm ở ./xuLy.ts (cổng đã kiểm bằng đầu vào giả); file này chỉ nối với Deno và Supabase.
//
// CỔNG CHƯA KIỂM (npm test không chạy Deno, không có mạng): file này chạy thật, việc nối với Supabase
// Auth, cơ sở dữ liệu và GitHub thật. Chủ dự án triển khai và kiểm tay (supabase/README.md).
//
// Bí mật và cấu hình:
// - `GITHUB_TOKEN_CHI_DOC`: token GitHub chỉ đọc (fine-grained, quyền Read-only cho Issues và Pull
//   requests), đặt bằng `supabase secrets set`. Không có trong mã, trong cơ sở dữ liệu hay trong gói
//   gửi trình duyệt. Tên không được bắt đầu bằng `SUPABASE_` (Supabase cấm).
// - `SUPABASE_URL` và `SUPABASE_ANON_KEY`: Supabase tự cấp cho hàm. Hàm KHÔNG dùng và không cần khoá
//   service: nó đọc cơ sở dữ liệu bằng chính phiên của người gọi, nên phân quyền từng dòng quyết
//   định repo nào người gọi "thấy được".
import { createClient } from 'npm:@supabase/supabase-js@2'
import { khoaRepo } from '../_shared/github.ts'
import { THOI_GIAN_CHO_GITHUB_MS, xuLyYeuCau, type PhuThuocHam } from './xuLy.ts'

// Kiểu tối thiểu của môi trường Deno (file này không nằm trong dự án TypeScript của ứng dụng).
declare const Deno: {
  env: { get(ten: string): string | undefined }
  serve(xuLy: (yeuCau: Request) => Response | Promise<Response>): unknown
}

/** `Bearer <mã>` → `<mã>`; null nếu không đúng dạng. */
function layMaTruyCap(tieuDeAuthorization: string | null): string | null {
  const khop = /^Bearer\s+(\S+)$/i.exec(tieuDeAuthorization ?? '')
  return khop ? khop[1] : null
}

function taoPhuThuoc(): PhuThuocHam {
  const urlSupabase = Deno.env.get('SUPABASE_URL') ?? ''
  const khoaCongKhai = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  return {
    token: Deno.env.get('GITHUB_TOKEN_CHI_DOC'),

    async xacThuc(tieuDeAuthorization) {
      const maTruyCap = layMaTruyCap(tieuDeAuthorization)
      if (!maTruyCap || !urlSupabase || !khoaCongKhai) return null
      // Client mang phiên của người gọi: mọi truy vấn chịu phân quyền từng dòng như chính họ.
      const db = createClient(urlSupabase, khoaCongKhai, {
        global: { headers: { Authorization: `Bearer ${maTruyCap}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
      const { data, error } = await db.auth.getUser(maTruyCap)
      if (error || !data.user) return null
      return {
        async repoDaGan(khoa: string) {
          const { data: dong, error: loi } = await db
            .from('repo_du_an')
            .select('du_an_id')
            .eq('ten_repo_khoa', khoaRepo(khoa))
            .limit(1)
          if (loi) throw new Error('Không đọc được danh sách repo đã gắn.')
          return (dong?.length ?? 0) > 0
        },
      }
    },

    async goiGitHub(url, yeuCau) {
      const phanHoi = await fetch(url, {
        method: yeuCau.method,
        headers: yeuCau.headers,
        signal: AbortSignal.timeout(THOI_GIAN_CHO_GITHUB_MS),
      })
      return {
        status: phanHoi.status,
        tieuDe: (ten: string) => phanHoi.headers.get(ten),
        chu: () => phanHoi.text(),
      }
    },
  }
}

Deno.serve((yeuCau) => xuLyYeuCau(yeuCau, taoPhuThuoc()))
