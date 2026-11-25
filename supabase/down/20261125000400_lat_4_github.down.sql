-- =================================================================================================
-- Migration xuống cho supabase/migrations/20261125000400_lat_4_github.sql (lát 4, ticket 17).
-- Nằm ngoài thư mục migrations để Supabase CLI không tự áp. Chủ dự án chạy tay trong SQL Editor
-- khi cần gỡ lát 4. XOÁ HẾT repo của Dự án và link của Task. Hồ sơ, Dự án, người trong dự án (lát 1) và
-- Task (lát 2) giữ nguyên. Phải chạy TRƯỚC bản xuống của lát 2 (bảng lien_ket_task trỏ vào task).
-- Hàm trigger của Task được trả về đúng bản của lát 2 (bỏ nhánh link GitHub): nếu sau lát 2 có migration
-- khác (ví dụ ticket 14) đã sửa hàm này, hãy trả hàm về bản của migration đó thay vì bản dưới đây.
-- CỔNG CHƯA KIỂM: file này chưa được chạy trên Supabase thật.
-- =================================================================================================

drop function if exists public.them_lien_ket_vao_task(uuid, text, text, bigint);
drop function if exists public.go_lien_ket_khoi_task(uuid, text, text, bigint);

-- Bỏ bảng kéo theo policy, trigger, chỉ mục và ràng buộc của bảng.
drop table if exists public.lien_ket_task;
drop table if exists public.repo_du_an;

drop function if exists rieng.repo_du_an_truoc_khi_them();
drop function if exists rieng.repo_du_an_truoc_khi_go();
drop function if exists rieng.ghi_dau_vet_task(uuid);
-- rieng.duoc_xem_task do lát 3 khai (lát 4 chỉ `create or replace`) và policy của bảng lịch sử vẫn dùng nó:
-- không gỡ ở đây, bản xuống của lát 3 gỡ.
drop function if exists rieng.la_ten_repo_hop_le(text);

-- Trả hàm trigger của Task về bản của lát 2 (không còn nhánh rieng.dang_ghi_lien_ket).
create or replace function rieng.task_truoc_khi_sua() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_nguoi_goi uuid := auth.uid();
  -- Cờ do hàm chuyển trạng thái của ticket 14 đặt (xem đầu file); client không đặt được.
  v_dang_chuyen boolean := coalesce(current_setting('rieng.dang_chuyen_trang_thai', true), '') = 'co';
  v_trang_thai_du_an text;
begin
  new.id := old.id;
  new.du_an_id := old.du_an_id;
  new.tao_boi := old.tao_boi;
  new.tao_luc := old.tao_luc;

  if v_nguoi_goi is not null then
    if not v_dang_chuyen and not rieng.duoc_quan_ly_du_an(old.du_an_id) then
      raise exception 'KHONG_CO_QUYEN' using detail = 'Chỉ PM hoặc Support của Dự án sửa được Task.';
    end if;
    -- Hai cột này chỉ đổi qua hàm của ticket 14.
    if (new.trang_thai is distinct from old.trang_thai
        or new.so_lan_tra_lai is distinct from old.so_lan_tra_lai)
       and not v_dang_chuyen then
      raise exception 'KHONG_CO_QUYEN' using detail = 'Trạng thái và số lần Trả lại chỉ đổi qua hàm chuyển trạng thái.';
    end if;

    select d.trang_thai into v_trang_thai_du_an from public.du_an d where d.id = old.du_an_id for share;
    if v_trang_thai_du_an = 'LUU_TRU' then
      raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên Task chỉ xem được.';
    end if;
    if old.trang_thai in ('HOAN_THANH', 'HUY') then
      raise exception 'TASK_DA_CHOT' using detail = 'Task đã Hoàn thành hoặc Huỷ nên không sửa được nữa.';
    end if;

    new.sua_boi := v_nguoi_goi;
    new.sua_luc := now();
  else
    -- Chủ dự án sửa tay (không có người gọi): không đổi dấu vết chỉnh sửa.
    new.sua_boi := old.sua_boi;
    new.sua_luc := old.sua_luc;
  end if;

  -- Đổi người: cả hai bắt buộc; người MỚI được chọn phải ở trong Dự án (người cũ giữ nguyên thì
  -- không cần, dù đã rời Dự án); và hai người khác nhau.
  if new.nguoi_thuc_hien_id is distinct from old.nguoi_thuc_hien_id
     or new.nguoi_kiem_tra_id is distinct from old.nguoi_kiem_tra_id then
    if new.nguoi_thuc_hien_id is null or new.nguoi_kiem_tra_id is null then
      raise exception 'THIEU_NGUOI' using detail = 'Task phải có đủ Người thực hiện và Người kiểm tra.';
    end if;
    if (new.nguoi_thuc_hien_id is distinct from old.nguoi_thuc_hien_id
        and not rieng.la_nguoi_trong_du_an(old.du_an_id, new.nguoi_thuc_hien_id))
       or (new.nguoi_kiem_tra_id is distinct from old.nguoi_kiem_tra_id
           and not rieng.la_nguoi_trong_du_an(old.du_an_id, new.nguoi_kiem_tra_id)) then
      raise exception 'NGUOI_NGOAI_DU_AN' using detail = 'Người được chọn không ở trong Dự án.';
    end if;
    if new.nguoi_thuc_hien_id = new.nguoi_kiem_tra_id then
      raise exception 'TRUNG_NGUOI' using detail = 'Người kiểm tra phải khác Người thực hiện.';
    end if;
  end if;

  return new;
end;
$$;

