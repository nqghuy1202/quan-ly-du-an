-- =================================================================================================
-- Migration xuống cho supabase/migrations/20261125000100_lat_1_ho_so_du_an.sql (lát 1, ticket 06).
-- Nằm ngoài thư mục migrations để Supabase CLI không tự áp. Chủ dự án chạy tay trong SQL Editor
-- khi cần gỡ lát 1. XOÁ HẾT dữ liệu hồ sơ, Dự án và người trong dự án; tài khoản trong auth.users
-- giữ nguyên (đăng ký lại sau khi áp lại migration lên sẽ không có hồ sơ cho tài khoản cũ).
-- CỔNG CHƯA KIỂM: file này chưa được chạy trên Supabase thật.
-- =================================================================================================

drop trigger if exists tao_ho_so_khi_dang_ky on auth.users;

drop function if exists public.ten_nguoi_dau_vet(uuid[]);
drop function if exists public.them_nguoi_vao_du_an(uuid, text);
drop function if exists public.mo_lai_du_an(uuid);
drop function if exists public.luu_tru_du_an(uuid);

-- Bỏ bảng kéo theo policy, trigger và chỉ mục của bảng.
drop table if exists public.nguoi_trong_du_an;
drop table if exists public.du_an;
drop table if exists public.ho_so;

-- Hàm hỗ trợ và hàm trigger.
drop schema if exists rieng cascade;
