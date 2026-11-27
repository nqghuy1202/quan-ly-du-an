# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Bổ sung cho AGENTS.md

### Chạy một test

- Một file: `npx vitest run src/kho/khoBoNho.test.ts`
- Một ca theo tên: `npx vitest run src/luat/chuyenTrangThai.test.ts -t "<một phần tên ca>"`
- Chạy lại mỗi khi sửa: `npm run test:watch`

### Bức tranh lớn (phải đọc nhiều file mới thấy)

- **Luật nghiệp vụ có hai bản phải khớp nhau.** Bản thuần ở `src/luat/` được giao diện và bản bộ nhớ dùng. Bản Supabase ép lại cùng bộ luật trong SQL: phân quyền từng dòng (RLS), và trạng thái Task chỉ đổi qua hàm `doi_trang_thai_task`, không ghi thẳng cột. Sửa luật ở một bên thì phải sửa cả migration tương ứng (thêm bản `supabase/down/`), và ghi vào `supabase/README.md` những chỗ cần kiểm tay.
- **Bảng ca dùng chung** giữ hai bản trên khớp nhau. `src/kho/bangCaChuyenTrangThai.ts` (ma trận chuyển trạng thái) và `src/kho/bangCaQuyen.ts` (quyền xem và sửa) là nguồn sự thật dạng dữ liệu. Bản bộ nhớ chạy hết bảng ca trong `npm test`. Bản Supabase chạy cùng bảng ca qua `vitest.supabase.config.ts`, và chỉ chủ dự án chạy tay.
- **Bộ test hợp đồng chia theo lát.** Có `hopDong.ts` và các file `hopDong*.ts` (mỗi file một nhóm hành vi: Mã Dự án, Mức ưu tiên, Tổng quan...). Mỗi bản cài của Kho dữ liệu đều chạy lại các file này. Hành vi mới của Kho cần thêm vào hợp đồng, không viết test riêng cho một bản cài.
- **Cổng GitHub** (`src/github/`) là seam thứ hai, chỉ đọc. Có bản giả để test, bản gọi Edge Function `doc-github` (`supabase/functions/`) và bản không khả dụng. Token GitHub chỉ nằm trong secret của Supabase. Lỗi GitHub chỉ hiện cạnh link, không chặn phần còn lại của Task.
- **Phiên đăng nhập của bản Supabase không lưu** (`persistSession: false`). Tải lại trang hay mở tab mới đều phải đăng nhập lại; đây là hành vi đã chọn, không phải lỗi.
- **Tài liệu có test giữ khớp.** `src/taiLieu.test.ts` đối chiếu `README.md`, `supabase/README.md` và `AGENTS.md` với `package.json` và cấu hình. Thêm hay đổi script hoặc lệnh trong các file đó thì phải chạy `npm test`.

### Chạy với Supabase trên máy

`supabase start` đọc `supabase/config.toml` (sinh bởi `supabase init`; xem có được commit chưa trước khi dựa vào nó). Muốn ứng dụng dùng bản Supabase thì điền `VITE_SUPABASE_URL` và khoá anon của bản trên máy vào `.env.local`; bỏ trống cả hai thì dùng bản bộ nhớ. Migration phải áp đúng thứ tự trong `supabase/migrations/`. Hộp thư giả (Mailpit) nhận thư xác nhận và mã đặt lại mật khẩu. Chi tiết từng bước ở `supabase/README.md`.
