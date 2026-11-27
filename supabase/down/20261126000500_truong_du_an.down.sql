-- =================================================================================================
-- Migration xuống cho supabase/migrations/20261126000500_truong_du_an.sql (trường mới của Dự án, ticket
-- truong-moi 09). Nằm ngoài thư mục migrations để Supabase CLI không tự áp. Chủ dự án chạy tay trong SQL
-- Editor khi cần gỡ nhóm trường này. XOÁ HẾT Mã Dự án, Khách hàng, Ngày bắt đầu, Ngày kết thúc dự kiến,
-- Mức ưu tiên và Người phụ trách của mọi Dự án (áp lại bản lên thì Dự án nhận lại mã tạm DA-…). Dự án,
-- người trong dự án, Task, lịch sử, repo và link giữ nguyên. Phải chạy TRƯỚC bản xuống của lát 4.
-- Ứng dụng phiên bản mới đọc và ghi các cột này: gỡ xong thì tạo và sửa Dự án trên ứng dụng sẽ lỗi.
-- CỔNG CHƯA KIỂM: file này chưa được chạy trên Supabase thật.
-- =================================================================================================

-- Trả hai hàm trigger của Dự án và hàm tên hiển thị về đúng bản của lát 1 TRƯỚC khi bỏ cột (bản mới đọc
-- các cột sắp bỏ).
create or replace function rieng.du_an_truoc_khi_tao() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.tao_boi := auth.uid();
  end if;
  new.tao_luc := now();
  new.sua_boi := null;
  new.sua_luc := null;
  new.trang_thai := 'HOAT_DONG';
  return new;
end;
$$;

create or replace function rieng.du_an_truoc_khi_sua() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.id := old.id;
  new.tao_boi := old.tao_boi;
  new.tao_luc := old.tao_luc;

  if old.trang_thai = 'LUU_TRU'
     and (new.trang_thai = 'LUU_TRU'
          or new.ten is distinct from old.ten
          or new.mo_ta is distinct from old.mo_ta) then
    raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên chỉ xem được.';
  end if;

  if auth.uid() is not null then
    new.sua_boi := auth.uid();
    new.sua_luc := now();
  else
    -- Chủ dự án sửa tay (không có người gọi): không đổi dấu vết chỉnh sửa.
    new.sua_boi := old.sua_boi;
    new.sua_luc := old.sua_luc;
  end if;
  return new;
end;
$$;

create or replace function public.ten_nguoi_dau_vet(p_ids uuid[]) returns table (id uuid, ten_hien_thi text)
language sql stable security definer set search_path = ''
as $$
  select h.id, h.ten_hien_thi
  from public.ho_so h
  where h.id = any (p_ids)
    and exists (
      select 1 from public.du_an d
      where (d.tao_boi = h.id or d.sua_boi = h.id) and rieng.duoc_xem_du_an(d.id)
    )
$$;

-- Bỏ chỉ mục, ràng buộc và cột (quyền cột trên các cột này mất theo cột).
drop index if exists public.du_an_ma_key;

alter table public.du_an
  drop constraint if exists du_an_nguoi_phu_trach_fkey,
  drop constraint if exists du_an_muc_uu_tien_hop_le,
  drop constraint if exists du_an_ngay_hop_le,
  drop constraint if exists du_an_khach_hang_hop_le,
  drop constraint if exists du_an_ma_hop_le,
  drop column if exists nguoi_phu_trach_id,
  drop column if exists muc_uu_tien,
  drop column if exists ngay_ket_thuc_du_kien,
  drop column if exists ngay_bat_dau,
  drop column if exists khach_hang,
  drop column if exists ma;
