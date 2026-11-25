-- =================================================================================================
-- Migration xuống cho supabase/migrations/20261125000300_lat_3_vong_duyet.sql (lát 3, ticket 14).
-- Nằm ngoài thư mục migrations để Supabase CLI không tự áp. Chủ dự án chạy tay trong SQL Editor
-- khi cần gỡ lát 3. XOÁ HẾT LỊCH SỬ TRẠNG THÁI. Bảng Task (lát 2) giữ nguyên, kể cả trạng thái và số
-- lần Trả lại hiện có; sau khi gỡ thì không còn đường nào đổi hai cột đó (chỉ còn sửa tay bằng
-- SQL Editor hay khoá service).
-- Phải chạy TRƯỚC bản xuống của lát 2 (supabase/down/20261125000200_lat_2_task.down.sql):
-- bảng task không xoá được khi bảng lịch sử còn trỏ vào.
-- CỔNG CHƯA KIỂM: file này chưa được chạy trên Supabase thật.
-- =================================================================================================

drop function if exists public.lich_su_task(uuid);
drop function if exists public.doi_trang_thai_task(uuid, text, text);

-- Bỏ bảng kéo theo policy, trigger, chỉ mục và ràng buộc của bảng (ràng buộc dùng hàm ma trận, nên
-- phải bỏ bảng trước khi bỏ hàm).
drop table if exists public.lich_su_trang_thai_task;

-- Hàm trigger và hàm hỗ trợ của lát 3 (schema rieng giữ lại cho lát 1 và lát 2).
drop function if exists rieng.lich_su_truoc_khi_sua();
drop function if exists rieng.duoc_xem_task(uuid);
drop function if exists rieng.la_buoc_chuyen_hop_le(text, text);
drop function if exists rieng.ma_tran_chuyen_trang_thai();

-- Hai chỉ mục lát 3 thêm trên bảng task.
drop index if exists public.task_du_an_trang_thai_idx;
drop index if exists public.task_han_chua_chot_idx;
