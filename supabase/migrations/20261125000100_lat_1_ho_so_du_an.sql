-- =================================================================================================
-- Lát 1 (ticket 06): hồ sơ, vai hệ thống, Dự án và người trong dự án.
-- Migration lên. Migration xuống: supabase/down/20261125000100_lat_1_ho_so_du_an.down.sql
--
-- Đây là bản sao phía cơ sở dữ liệu của luật thuần trong src/luat/ (taiKhoan.ts, duAn.ts); hai chỗ
-- phải khớp nhau, và bảng ca dùng chung (src/kho/bangCaQuyen.ts) là nguồn sự thật để đối chiếu.
--
-- CỔNG CHƯA KIỂM (npm test không chạy file này, không có DB, không có mạng):
--   - Toàn bộ SQL dưới đây: bảng, ràng buộc, trigger, hàm, phân quyền từng dòng (RLS), quyền cột.
--   - Supabase Auth thật: đăng ký, xác nhận email, đăng nhập, đặt lại mật khẩu, thư gửi đi.
--   - Bản cài src/kho/khoSupabase.ts chạy trên Supabase thật.
--   Người duyệt cần đọc kỹ SQL này và chạy tay bộ test hợp đồng cùng bảng ca dùng chung trên
--   Supabase thật (xem supabase/README.md, lệnh `npx vitest run --config vitest.supabase.config.ts`).
--
-- VIỆC CHỦ DỰ ÁN LÀM TAY (AI không làm, không áp migration lên Supabase thật):
--   1. Áp migration này (SQL Editor, hoặc `supabase db push` / `supabase migration up`).
--   2. Bật đăng ký bằng email kèm xác nhận email (Authentication > Providers > Email > Confirm email).
--   3. Sửa mẫu thư "Reset password" để thư có mã {{ .Token }} (mẫu: supabase/templates/dat-lai-mat-khau.html).
--   4. Đặt PM đầu tiên MỘT LẦN, sau khi tài khoản của mình đã đăng ký (chạy trong SQL Editor, vai
--      postgres nên trigger cho phép):
--        update public.ho_so set vai = 'PM' where email = lower('email-cua-ban@vi-du.vn');
--      Không có luật "người đầu tiên thành PM". Từ đó chỉ PM đổi được vai, và luôn còn ít nhất một PM.
--   5. Chạy danh sách kiểm tay trong supabase/README.md.
--
-- Luật phía cơ sở dữ liệu (không tin trình duyệt):
--   - Hồ sơ tự tạo khi đăng ký (trigger trên auth.users), vai luôn là Thành viên.
--   - Chỉ PM đổi được vai; không ai tự nâng vai. Luôn còn ít nhất một PM (kể cả khi xoá tài khoản).
--   - Chỉ chủ hồ sơ sửa tên hiển thị và GitHub username của mình; email, mã, ngày tạo không đổi được.
--   - Người tạo, ngày tạo, người chỉnh sửa, ngày chỉnh sửa của Dự án do trigger đặt theo auth.uid()
--     và now(); giá trị client gửi lên bị ghi đè. Client cũng không có quyền cột trên các cột này.
--   - Trạng thái Dự án không ghi thẳng được: chỉ đổi qua hàm luu_tru_du_an / mo_lai_du_an.
--   - Dự án đã Lưu trữ: không sửa, không thêm, không gỡ người được (DU_AN_DA_LUU_TRU).
--   - Thêm người chỉ qua hàm them_nguoi_vao_du_an (tìm tài khoản theo email mà không lộ danh sách).
--
-- Lỗi nghiệp vụ được ném bằng `raise exception '<MÃ>'` với MÃ là mã lỗi của Kho dữ liệu
-- (src/kho/ketQua.ts); bản cài Supabase đọc lại mã đó từ thông báo lỗi.
-- =================================================================================================

-- Hàm hỗ trợ và hàm trigger nằm trong schema riêng, không mở ra API (PostgREST chỉ mở `public`).
create schema if not exists rieng;
revoke all on schema rieng from public;
grant usage on schema rieng to authenticated, service_role;
-- Supabase Auth (vai supabase_auth_admin) ghi auth.users, nơi trigger tạo hồ sơ chạy.
grant usage on schema rieng to supabase_auth_admin;

-- -------------------------------------------------------------------------------------------------
-- 1. Bảng
-- -------------------------------------------------------------------------------------------------

create table public.ho_so (
  id uuid not null,
  email text not null,
  ten_hien_thi text not null,
  github_username text,
  vai text not null default 'THANH_VIEN',
  tao_luc timestamptz not null default now(),
  sua_luc timestamptz,
  constraint ho_so_pkey primary key (id),
  constraint ho_so_id_fkey foreign key (id) references auth.users (id) on delete cascade,
  constraint ho_so_email_key unique (email),
  constraint ho_so_email_chuan check (email <> '' and email = lower(btrim(email))),
  constraint ho_so_ten_hop_le check (
    ten_hien_thi = btrim(ten_hien_thi) and char_length(ten_hien_thi) between 1 and 100
  ),
  -- Cùng định dạng với GITHUB_USERNAME trong src/luat/taiKhoan.ts.
  constraint ho_so_github_hop_le check (
    github_username is null or github_username ~* '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$'
  ),
  constraint ho_so_vai_hop_le check (vai in ('PM', 'SUPPORT', 'THANH_VIEN'))
);

comment on table public.ho_so is 'Hồ sơ của mỗi tài khoản (tự tạo khi đăng ký). Vai: PM, SUPPORT, THANH_VIEN.';

create table public.du_an (
  id uuid not null default gen_random_uuid(),
  ten text not null,
  mo_ta text not null default '',
  trang_thai text not null default 'HOAT_DONG',
  tao_boi uuid not null,
  tao_luc timestamptz not null default now(),
  sua_boi uuid,
  sua_luc timestamptz,
  constraint du_an_pkey primary key (id),
  constraint du_an_tao_boi_fkey foreign key (tao_boi) references public.ho_so (id),
  constraint du_an_sua_boi_fkey foreign key (sua_boi) references public.ho_so (id),
  -- Cùng giới hạn với DO_DAI_TEN_DU_AN_TOI_DA trong src/luat/duAn.ts.
  constraint du_an_ten_hop_le check (ten = btrim(ten) and char_length(ten) between 1 and 120),
  constraint du_an_trang_thai_hop_le check (trang_thai in ('HOAT_DONG', 'LUU_TRU')),
  constraint du_an_dau_vet_sua_du_cap check ((sua_boi is null) = (sua_luc is null))
);

comment on table public.du_an is 'Dự án. Dấu vết (tao_boi, tao_luc, sua_boi, sua_luc) do trigger đặt.';

create table public.nguoi_trong_du_an (
  du_an_id uuid not null,
  nguoi_dung_id uuid not null,
  them_boi uuid,
  them_luc timestamptz not null default now(),
  constraint nguoi_trong_du_an_pkey primary key (du_an_id, nguoi_dung_id),
  constraint nguoi_trong_du_an_du_an_id_fkey foreign key (du_an_id) references public.du_an (id) on delete cascade,
  constraint nguoi_trong_du_an_nguoi_dung_id_fkey foreign key (nguoi_dung_id) references public.ho_so (id) on delete cascade,
  constraint nguoi_trong_du_an_them_boi_fkey foreign key (them_boi) references public.ho_so (id) on delete set null
);

create index nguoi_trong_du_an_nguoi_dung_id_idx on public.nguoi_trong_du_an (nguoi_dung_id);

comment on table public.nguoi_trong_du_an is 'Người trong dự án: cặp (Dự án, tài khoản). Support có trong danh sách thì quản lý được Dự án.';

-- -------------------------------------------------------------------------------------------------
-- 2. Hàm hỗ trợ: quyền của người gọi (auth.uid()). security definer để đọc được bảng mà không
--    vướng chính RLS của bảng đó (tránh đệ quy policy). Chỉ trả thông tin về người gọi.
-- -------------------------------------------------------------------------------------------------

create function rieng.vai_cua_toi() returns text
language sql stable security definer set search_path = ''
as $$
  select h.vai from public.ho_so h where h.id = auth.uid()
$$;

-- duocQuanLyNguoiDung, duocTaoDuAn, duocXemMoiDuAn: chỉ PM.
create function rieng.la_pm() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(rieng.vai_cua_toi() = 'PM', false)
$$;

create function rieng.o_trong_du_an(p_du_an_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.nguoi_trong_du_an n
    where n.du_an_id = p_du_an_id and n.nguoi_dung_id = auth.uid()
  )
$$;

-- duocXemDuAn: PM thấy mọi Dự án; Support và Thành viên chỉ Dự án mình ở trong.
create function rieng.duoc_xem_du_an(p_du_an_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select rieng.la_pm() or rieng.o_trong_du_an(p_du_an_id)
$$;

-- duocQuanLyDuAn: PM ở mọi Dự án; Support chỉ ở Dự án mình ở trong; Thành viên không.
create function rieng.duoc_quan_ly_du_an(p_du_an_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select rieng.la_pm()
      or (coalesce(rieng.vai_cua_toi() = 'SUPPORT', false) and rieng.o_trong_du_an(p_du_an_id))
$$;

-- Người gọi thấy hồ sơ của một người khác khi người đó ở trong một Dự án người gọi thấy được.
create function rieng.thay_ho_so(p_nguoi_dung_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.nguoi_trong_du_an n
    where n.nguoi_dung_id = p_nguoi_dung_id and rieng.duoc_xem_du_an(n.du_an_id)
  )
$$;

create function rieng.du_an_dang_hoat_dong(p_du_an_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.du_an d where d.id = p_du_an_id and d.trang_thai = 'HOAT_DONG')
$$;

-- -------------------------------------------------------------------------------------------------
-- 3. Trigger: luật không tin client
-- -------------------------------------------------------------------------------------------------

-- Hồ sơ tự tạo khi đăng ký, vai luôn là Thành viên (không đọc vai từ dữ liệu client gửi lên).
-- Tên hiển thị lấy từ raw_user_meta_data.ten_hien_thi (client đã kiểm bằng zod); thiếu thì lấy
-- phần trước @ của email để không làm hỏng việc đăng ký.
create function rieng.tao_ho_so_khi_dang_ky() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ten text := btrim(left(btrim(coalesce(new.raw_user_meta_data ->> 'ten_hien_thi', '')), 100));
begin
  if v_ten = '' then
    v_ten := btrim(left(split_part(coalesce(new.email, ''), '@', 1), 100));
  end if;
  if v_ten = '' then
    v_ten := 'Người dùng';
  end if;
  insert into public.ho_so (id, email, ten_hien_thi, vai)
  values (new.id, lower(btrim(new.email)), v_ten, 'THANH_VIEN');
  return new;
end;
$$;

create trigger tao_ho_so_khi_dang_ky
  after insert on auth.users
  for each row execute function rieng.tao_ho_so_khi_dang_ky();

-- Sửa hồ sơ. Với client (auth.uid() có giá trị):
--   - mã, email, ngày tạo không đổi được;
--   - tên hiển thị và GitHub username: chỉ chủ hồ sơ;
--   - vai: chỉ PM (người không phải PM không tự nâng vai được).
-- Với mọi người, kể cả chủ dự án sửa tay trong SQL Editor: luôn còn ít nhất một PM.
create function rieng.ho_so_truoc_khi_sua() returns trigger
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

create trigger ho_so_truoc_khi_sua
  before update on public.ho_so
  for each row execute function rieng.ho_so_truoc_khi_sua();

-- Xoá hồ sơ (xoá tài khoản kéo theo): không xoá được PM cuối cùng.
create function rieng.ho_so_truoc_khi_xoa() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.vai = 'PM' then
    perform pg_advisory_xact_lock(hashtext('public.ho_so.vai_pm'));
    if not exists (select 1 from public.ho_so h where h.vai = 'PM' and h.id <> old.id) then
      raise exception 'PHAI_CON_PM' using detail = 'Không xoá được PM cuối cùng.';
    end if;
  end if;
  return old;
end;
$$;

create trigger ho_so_truoc_khi_xoa
  before delete on public.ho_so
  for each row execute function rieng.ho_so_truoc_khi_xoa();

-- Tạo Dự án: người tạo là người gọi, ngày tạo là giờ máy chủ, chưa có phần chỉnh sửa, đang hoạt động.
create function rieng.du_an_truoc_khi_tao() returns trigger
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

create trigger du_an_truoc_khi_tao
  before insert on public.du_an
  for each row execute function rieng.du_an_truoc_khi_tao();

-- Sửa Dự án: người tạo và ngày tạo giữ nguyên; người và ngày chỉnh sửa do máy chủ đặt.
-- Dự án đã Lưu trữ chỉ được đổi đúng một việc: mở lại (trạng thái sang HOAT_DONG, không đổi gì khác).
create function rieng.du_an_truoc_khi_sua() returns trigger
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

create trigger du_an_truoc_khi_sua
  before update on public.du_an
  for each row execute function rieng.du_an_truoc_khi_sua();

-- Thêm người: người thêm và ngày thêm do máy chủ đặt; Dự án đã Lưu trữ thì không thêm được.
create function rieng.nguoi_trong_du_an_truoc_khi_them() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not rieng.du_an_dang_hoat_dong(new.du_an_id) then
    raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên không thêm người được.';
  end if;
  new.them_boi := auth.uid();
  new.them_luc := now();
  return new;
end;
$$;

create trigger nguoi_trong_du_an_truoc_khi_them
  before insert on public.nguoi_trong_du_an
  for each row execute function rieng.nguoi_trong_du_an_truoc_khi_them();

-- Gỡ người do client yêu cầu: Dự án đã Lưu trữ thì không gỡ được. (Xoá tài khoản ngoài ứng dụng,
-- không có người gọi, vẫn kéo theo dòng này như bình thường.)
create function rieng.nguoi_trong_du_an_truoc_khi_go() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not rieng.du_an_dang_hoat_dong(old.du_an_id) then
    raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên không gỡ người được.';
  end if;
  return old;
end;
$$;

create trigger nguoi_trong_du_an_truoc_khi_go
  before delete on public.nguoi_trong_du_an
  for each row execute function rieng.nguoi_trong_du_an_truoc_khi_go();

-- -------------------------------------------------------------------------------------------------
-- 4. Phân quyền từng dòng: bật cho cả ba bảng. Không có policy nào thì không ai đọc hay ghi được
--    gì; mỗi policy dưới đây là một thứ được phép. anon (chưa đăng nhập) không có policy nào.
-- -------------------------------------------------------------------------------------------------

alter table public.ho_so enable row level security;
alter table public.du_an enable row level security;
alter table public.nguoi_trong_du_an enable row level security;

-- Hồ sơ: của mình; PM thấy mọi tài khoản; người trong một Dự án mình thấy được.
create policy ho_so_doc on public.ho_so
  for select to authenticated
  using (id = auth.uid() or rieng.la_pm() or rieng.thay_ho_so(id));

-- Hồ sơ: chủ hồ sơ sửa hồ sơ mình, PM đổi vai (trigger ho_so_truoc_khi_sua giới hạn cột nào ai sửa).
create policy ho_so_sua on public.ho_so
  for update to authenticated
  using (id = auth.uid() or rieng.la_pm())
  with check (id = auth.uid() or rieng.la_pm());

-- Không có policy insert/delete cho hồ sơ: chỉ trigger đăng ký tạo, chỉ xoá tài khoản mới xoá.

create policy du_an_doc on public.du_an
  for select to authenticated
  using (rieng.duoc_xem_du_an(id));

create policy du_an_tao on public.du_an
  for insert to authenticated
  with check (rieng.la_pm());

create policy du_an_sua on public.du_an
  for update to authenticated
  using (rieng.duoc_quan_ly_du_an(id))
  with check (rieng.duoc_quan_ly_du_an(id));

-- Không có policy delete cho Dự án: không xoá cứng, chỉ Lưu trữ.

create policy nguoi_trong_du_an_doc on public.nguoi_trong_du_an
  for select to authenticated
  using (rieng.duoc_xem_du_an(du_an_id));

create policy nguoi_trong_du_an_go on public.nguoi_trong_du_an
  for delete to authenticated
  using (rieng.duoc_quan_ly_du_an(du_an_id) and rieng.du_an_dang_hoat_dong(du_an_id));

-- Không có policy insert: thêm người chỉ qua hàm them_nguoi_vao_du_an.

-- Quyền bảng và cột: bỏ mặc định của Supabase, chỉ mở đúng cột client được ghi.
revoke all on table public.ho_so, public.du_an, public.nguoi_trong_du_an from public, anon, authenticated;
grant select on table public.ho_so to authenticated;
grant update (ten_hien_thi, github_username, vai) on table public.ho_so to authenticated;
grant select on table public.du_an to authenticated;
grant insert (ten, mo_ta) on table public.du_an to authenticated;
grant update (ten, mo_ta) on table public.du_an to authenticated;
grant select, delete on table public.nguoi_trong_du_an to authenticated;
grant all on table public.ho_so, public.du_an, public.nguoi_trong_du_an to service_role;

-- -------------------------------------------------------------------------------------------------
-- 5. Hàm client gọi (RPC). security definer: tự kiểm người gọi, quyền và trạng thái theo đúng
--    thứ tự của bản bộ nhớ (quyền trước, rồi tồn tại, rồi trạng thái).
-- -------------------------------------------------------------------------------------------------

create function public.luu_tru_du_an(p_du_an_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_trang_thai text;
begin
  if auth.uid() is null then
    raise exception 'CHUA_DANG_NHAP';
  end if;
  if not rieng.duoc_quan_ly_du_an(p_du_an_id) then
    raise exception 'KHONG_CO_QUYEN';
  end if;
  select d.trang_thai into v_trang_thai from public.du_an d where d.id = p_du_an_id for update;
  if not found then
    raise exception 'KHONG_TIM_THAY';
  end if;
  if v_trang_thai = 'LUU_TRU' then
    raise exception 'DU_AN_DA_LUU_TRU';
  end if;
  update public.du_an set trang_thai = 'LUU_TRU' where id = p_du_an_id;
end;
$$;

create function public.mo_lai_du_an(p_du_an_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_trang_thai text;
begin
  if auth.uid() is null then
    raise exception 'CHUA_DANG_NHAP';
  end if;
  if not rieng.duoc_quan_ly_du_an(p_du_an_id) then
    raise exception 'KHONG_CO_QUYEN';
  end if;
  select d.trang_thai into v_trang_thai from public.du_an d where d.id = p_du_an_id for update;
  if not found then
    raise exception 'KHONG_TIM_THAY';
  end if;
  if v_trang_thai <> 'LUU_TRU' then
    raise exception 'DU_AN_DANG_HOAT_DONG';
  end if;
  update public.du_an set trang_thai = 'HOAT_DONG' where id = p_du_an_id;
end;
$$;

-- Thêm tài khoản đã đăng ký (theo email, không phân biệt hoa thường) vào Dự án. Không tạo tài
-- khoản, không gửi thư mời. Trả id, email, tên hiển thị và vai của người được thêm.
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

-- Tên hiển thị hiện tại của người tạo / người chỉnh sửa gần nhất, chỉ cho Dự án người gọi thấy
-- được (người xem Dự án chưa chắc thấy hồ sơ đầy đủ của người tạo, nên không đọc thẳng ho_so).
create function public.ten_nguoi_dau_vet(p_ids uuid[]) returns table (id uuid, ten_hien_thi text)
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

-- Quyền gọi hàm: không ai ngoài người đã đăng nhập (và service_role); hàm trigger không ai gọi thẳng.
revoke all on all functions in schema rieng from public, anon, authenticated;
grant execute on function
  rieng.vai_cua_toi(),
  rieng.la_pm(),
  rieng.o_trong_du_an(uuid),
  rieng.duoc_xem_du_an(uuid),
  rieng.duoc_quan_ly_du_an(uuid),
  rieng.thay_ho_so(uuid),
  rieng.du_an_dang_hoat_dong(uuid)
  to authenticated;

revoke all on function
  public.luu_tru_du_an(uuid),
  public.mo_lai_du_an(uuid),
  public.them_nguoi_vao_du_an(uuid, text),
  public.ten_nguoi_dau_vet(uuid[])
  from public, anon;
grant execute on function
  public.luu_tru_du_an(uuid),
  public.mo_lai_du_an(uuid),
  public.them_nguoi_vao_du_an(uuid, text),
  public.ten_nguoi_dau_vet(uuid[])
  to authenticated, service_role;
