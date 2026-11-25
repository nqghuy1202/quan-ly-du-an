-- =================================================================================================
-- Migration xuống cho supabase/migrations/20261125000200_lat_2_task.sql (lát 2, ticket 10).
-- Nằm ngoài thư mục migrations để Supabase CLI không tự áp. Chủ dự án chạy tay trong SQL Editor
-- khi cần gỡ lát 2. XOÁ HẾT Task. Hồ sơ, Dự án và người trong dự án (lát 1) giữ nguyên.
-- Phải chạy TRƯỚC bản xuống của lát 1 (supabase/down/20261125000100_lat_1_ho_so_du_an.down.sql):
-- bảng du_an và ho_so không xoá được khi bảng task còn trỏ vào.
-- CỔNG CHƯA KIỂM: file này chưa được chạy trên Supabase thật.
-- =================================================================================================

drop function if exists public.ten_nguoi_cua_task(uuid[]);

-- Bỏ bảng kéo theo policy, trigger, chỉ mục và ràng buộc của bảng.
drop table if exists public.task;

-- Hàm trigger và hàm hỗ trợ của lát 2 (schema rieng giữ lại cho lát 1).
drop function if exists rieng.task_truoc_khi_tao();
drop function if exists rieng.task_truoc_khi_sua();
drop function if exists rieng.la_nguoi_trong_du_an(uuid, uuid);
