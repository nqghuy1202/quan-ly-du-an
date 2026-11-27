-- =================================================================================================
-- Migration xuống cho supabase/migrations/20261126000600_truong_task_ho_so_nguoi.sql (Mức ưu tiên của Task,
-- Thông tin nhân sự, Vai trò trong Dự án; ticket truong-moi 10). Nằm ngoài thư mục migrations để Supabase CLI
-- không tự áp. Chủ dự án chạy tay trong SQL Editor khi cần gỡ nhóm trường này. XOÁ HẾT Mức ưu tiên và lịch sử
-- đổi Mức ưu tiên của mọi Task, Số điện thoại, Chức danh, Phòng ban của mọi hồ sơ, và Vai trò trong Dự án của
-- mọi Người trong dự án. Task, lịch sử trạng thái, hồ sơ, Dự án và người trong dự án giữ nguyên. Phải chạy
-- TRƯỚC bản xuống của 20261126000500_truong_du_an.
-- Ứng dụng phiên bản mới đọc và ghi các cột này: gỡ xong thì đọc hồ sơ, Task và Người trong dự án trên ứng
-- dụng sẽ lỗi.
-- CỔNG CHƯA KIỂM: file này chưa được chạy trên Supabase thật.
-- =================================================================================================

-- Trả hàm thêm người về đúng bản của lát 1 (hai tham số).
drop function if exists public.them_nguoi_vao_du_an(uuid, text, text);

create function public.them_nguoi_vao_du_an(p_du_an_id uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_trang_thai text;
  v_dich public.ho_so;
begin
  if auth.uid() is null then
    raise exception 'CHUA_DANG_NHAP';
  end if;
  if not rieng.duoc_quan_ly_du_an(p_du_an_id) then
    raise exception 'KHONG_CO_QUYEN';
  end if;
  select d.trang_thai into v_trang_thai from public.du_an d where d.id = p_du_an_id for share;
  if not found then
    raise exception 'KHONG_TIM_THAY';
  end if;
  if v_trang_thai = 'LUU_TRU' then
    raise exception 'DU_AN_DA_LUU_TRU';
  end if;
  select h.* into v_dich from public.ho_so h where h.email = lower(btrim(coalesce(p_email, '')));
  if not found then
    raise exception 'CHUA_DANG_KY';
  end if;
  insert into public.nguoi_trong_du_an (du_an_id, nguoi_dung_id)
  values (p_du_an_id, v_dich.id)
  on conflict do nothing;
  if not found then
    raise exception 'DA_TRONG_DU_AN';
  end if;
  return jsonb_build_object(
    'id', v_dich.id,
    'email', v_dich.email,
    'ten_hien_thi', v_dich.ten_hien_thi,
    'vai', v_dich.vai
  );
end;
$$;

revoke all on function public.them_nguoi_vao_du_an(uuid, text) from public, anon;
grant execute on function public.them_nguoi_vao_du_an(uuid, text) to authenticated, service_role;

-- Vai trò trong Dự án: bỏ quyền ghi, policy sửa, trigger và cột (quyền cột mất theo cột).
drop policy if exists nguoi_trong_du_an_sua on public.nguoi_trong_du_an;
drop trigger if exists nguoi_trong_du_an_truoc_khi_sua on public.nguoi_trong_du_an;
drop function if exists rieng.nguoi_trong_du_an_truoc_khi_sua();

alter table public.nguoi_trong_du_an
  drop constraint if exists nguoi_trong_du_an_vai_tro_hop_le,
  drop column if exists vai_tro;

-- Trả hàm trigger sửa hồ sơ về đúng bản của lát 1 TRƯỚC khi bỏ cột (bản mới đọc các cột sắp bỏ).
create or replace function rieng.ho_so_truoc_khi_sua() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_nguoi_goi uuid := auth.uid();
begin
  if v_nguoi_goi is not null then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.tao_luc is distinct from old.tao_luc then
      raise exception 'KHONG_CO_QUYEN' using detail = 'Không đổi được mã, email hay ngày tạo của hồ sơ.';
    end if;
    if (new.ten_hien_thi is distinct from old.ten_hien_thi
        or new.github_username is distinct from old.github_username)
       and old.id <> v_nguoi_goi then
      raise exception 'KHONG_CO_QUYEN' using detail = 'Chỉ chủ hồ sơ sửa được hồ sơ của mình.';
    end if;
    if new.vai is distinct from old.vai and not rieng.la_pm() then
      raise exception 'KHONG_CO_QUYEN' using detail = 'Chỉ PM đổi được vai hệ thống.';
    end if;
  end if;

  if old.vai = 'PM' and new.vai is distinct from 'PM' then
    -- Khoá theo giao dịch: hai PM hạ nhau cùng lúc thì lần sau phải chờ và đếm lại.
    perform pg_advisory_xact_lock(hashtext('public.ho_so.vai_pm'));
    if not exists (select 1 from public.ho_so h where h.vai = 'PM' and h.id <> old.id) then
      raise exception 'PHAI_CON_PM' using detail = 'Hệ thống phải luôn còn ít nhất một PM.';
    end if;
  end if;

  new.sua_luc := now();
  return new;
end;
$$;

-- Thông tin nhân sự: bỏ hàm quyền xem, ràng buộc và cột (quyền cột mất theo cột).
drop function if exists rieng.duoc_xem_thong_tin_nhan_su(uuid);

alter table public.ho_so
  drop constraint if exists ho_so_phong_ban_hop_le,
  drop constraint if exists ho_so_chuc_danh_hop_le,
  drop constraint if exists ho_so_so_dien_thoai_hop_le,
  drop column if exists phong_ban,
  drop column if exists chuc_danh,
  drop column if exists so_dien_thoai;

-- Trả hàm lịch sử Task về đúng bản của lát 3 (chỉ lịch sử trạng thái, không có cột loai) TRƯỚC khi bỏ bảng
-- lịch sử Mức ưu tiên (bản mới đọc bảng đó).
drop function if exists public.lich_su_task(uuid);

create function public.lich_su_task(p_task_id uuid)
returns table (stt bigint, nguoi_doi_id uuid, ten_hien_thi text, luc timestamptz, tu text, sang text, ly_do text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'CHUA_DANG_NHAP';
  end if;
  if not rieng.duoc_xem_task(p_task_id) then
    raise exception 'KHONG_TIM_THAY';
  end if;
  return query
    select l.stt, l.nguoi_doi_id, h.ten_hien_thi, l.luc, l.tu, l.sang, l.ly_do
    from public.lich_su_trang_thai_task l
    join public.ho_so h on h.id = l.nguoi_doi_id
    where l.task_id = p_task_id
    order by l.luc, l.stt;
end;
$$;

revoke all on function public.lich_su_task(uuid) from public, anon;
grant execute on function public.lich_su_task(uuid) to authenticated, service_role;

-- Mức ưu tiên của Task: bỏ trigger ghi lịch sử, bảng lịch sử, ràng buộc và cột (quyền cột mất theo cột).
drop trigger if exists task_sau_khi_doi_muc_uu_tien on public.task;
drop function if exists rieng.task_sau_khi_doi_muc_uu_tien();
drop table if exists public.lich_su_muc_uu_tien_task;
drop function if exists rieng.lich_su_muc_uu_tien_truoc_khi_sua();

alter table public.task
  drop constraint if exists task_muc_uu_tien_hop_le,
  drop column if exists muc_uu_tien;
