-- =================================================================================================
-- Lát 4 (ticket 17): repo GitHub của Dự án và link issue hoặc PR của Task.
-- Chạy SAU lát 1 (supabase/migrations/20261125000100_lat_1_ho_so_du_an.sql) và lát 2
-- (supabase/migrations/20261125000200_lat_2_task.sql): dùng du_an, nguoi_trong_du_an, task và các
-- hàm rieng.* của hai lát đó. Không phụ thuộc migration của ticket 14 (hàm chuyển trạng thái).
-- Migration xuống: supabase/down/20261125000400_lat_4_github.down.sql (chạy TRƯỚC bản xuống lát 2).
--
-- Đây là bản sao phía cơ sở dữ liệu của luật thuần trong src/luat/github.ts (tên repo, link, ai được
-- gắn, gỡ, thêm link) và quyền xem/ghi như Dự án; hai chỗ phải khớp nhau. Bộ test hợp đồng
-- (src/kho/hopDongRepo.ts, src/kho/hopDongLienKet.ts) là nguồn sự thật để đối chiếu.
--
-- CỔNG CHƯA KIỂM (npm test không chạy file này, không có DB, không có mạng):
--   - Toàn bộ SQL dưới đây: bảng, ràng buộc, trigger, hàm, phân quyền từng dòng (RLS), quyền cột.
--   - Bản cài src/kho/khoSupabaseGitHub.ts chạy trên Supabase thật.
--   Người duyệt cần đọc kỹ SQL này và chạy tay bộ test hợp đồng trên Supabase thật (xem
--   supabase/README.md, lệnh `npx vitest run --config vitest.supabase.config.ts`).
--
-- VIỆC CHỦ DỰ ÁN LÀM TAY (AI không làm, không áp migration lên Supabase thật):
--   1. Áp lát 1, lát 2 (nếu chưa), rồi áp migration này (SQL Editor, hoặc `supabase db push`).
--   2. Triển khai Edge Function doc-github và đặt secret token GitHub chỉ đọc (supabase/README.md).
--   3. Chạy danh sách kiểm tay về GitHub trong supabase/README.md.
--
-- Luật phía cơ sở dữ liệu (không tin trình duyệt):
--   - Repo của Dự án: ai thấy Dự án thì đọc được danh sách repo (PM thấy mọi Dự án; người khác chỉ
--     Dự án mình ở trong); người ngoài không thấy dòng nào. Gắn và gỡ: chỉ PM, hoặc Support của
--     chính Dự án đó. Dự án đã Lưu trữ: không gắn, không gỡ (DU_AN_DA_LUU_TRU). Tên repo đúng dạng
--     chu-so-huu/ten-repo (REPO_KHONG_HOP_LE), không trùng trong Dự án không phân biệt hoa thường
--     (REPO_DA_GAN); mỗi Dự án một danh sách riêng. Người gắn và ngày gắn do trigger đặt.
--   - Link của Task: ai thấy Task thì đọc được danh sách link. Thêm và gỡ chỉ qua hai hàm
--     them_lien_ket_vao_task, go_lien_ket_khoi_task (client không có quyền ghi thẳng bảng): MỌI người
--     thấy Dự án (kể cả Thành viên, kể cả Task đã chốt) thêm và gỡ được, trừ Dự án đã Lưu trữ. Link
--     phải thuộc repo đã gắn vào Dự án của Task (LINK_REPO_CHUA_GAN), không trùng trên Task không
--     phân biệt hoa thường (LINK_TRUNG). Thêm hoặc gỡ link cập nhật người và ngày chỉnh sửa gần nhất
--     của Task (xem phần 5: hàm trigger Task được cập nhật, đọc kỹ).
--   - Gỡ repo khỏi Dự án KHÔNG xoá link đã dán (như bản bộ nhớ); link đó chỉ không dán lại được.
--
-- Lỗi nghiệp vụ được ném bằng `raise exception '<MÃ>'` với MÃ là mã lỗi của Kho dữ liệu
-- (src/kho/ketQua.ts); bản cài Supabase đọc lại mã đó từ thông báo lỗi.
-- Lưu ý PostgreSQL: trigger BEFORE chạy TRƯỚC khi kiểm WITH CHECK của RLS, nên trigger dưới đây tự kiểm
-- quyền đầu tiên, để người không có quyền chỉ nhận KHONG_CO_QUYEN và không biết gì thêm.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. Bảng
-- -------------------------------------------------------------------------------------------------

-- Tên repo: cùng định dạng với laTenRepoHopLe trong supabase/functions/_shared/github.ts (chủ sở hữu
-- 1-39 ký tự chữ, số, gạch ngang, không ở đầu hay cuối; tên repo 1-100 ký tự chữ, số, gạch dưới, dấu
-- chấm, gạch ngang, không phải "." hay "..").
create table public.repo_du_an (
  id uuid not null default gen_random_uuid(),
  du_an_id uuid not null,
  -- Giữ chữ hoa chữ thường như lúc gắn.
  ten_repo text not null,
  -- Khoá so sánh không phân biệt hoa thường (cũng là cột Edge Function tra cứu).
  ten_repo_khoa text generated always as (lower(ten_repo)) stored,
  them_boi uuid,
  them_luc timestamptz not null default now(),
  -- Thứ tự gắn.
  thu_tu bigint generated always as identity,
  constraint repo_du_an_pkey primary key (id),
  constraint repo_du_an_du_an_id_fkey foreign key (du_an_id) references public.du_an (id) on delete cascade,
  constraint repo_du_an_them_boi_fkey foreign key (them_boi) references public.ho_so (id) on delete set null,
  constraint repo_du_an_khong_trung unique (du_an_id, ten_repo_khoa),
  constraint repo_du_an_ten_hop_le check (
    ten_repo ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/[A-Za-z0-9_.-]{1,100}$' and ten_repo !~ '/\.{1,2}$'
  )
);

comment on table public.repo_du_an is 'Repo GitHub gắn vào Dự án (chỉ ghi tên, không gọi GitHub). Người gắn, ngày gắn do trigger đặt.';

create index repo_du_an_ten_repo_khoa_idx on public.repo_du_an (ten_repo_khoa);

create table public.lien_ket_task (
  id uuid not null default gen_random_uuid(),
  task_id uuid not null,
  -- Giữ chữ hoa chữ thường như lúc dán.
  repo text not null,
  repo_khoa text generated always as (lower(repo)) stored,
  loai text not null,
  -- Số issue hoặc PR; bigint vì số an toàn của JavaScript vượt quá integer.
  so bigint not null,
  them_boi uuid,
  them_luc timestamptz not null default now(),
  -- Thứ tự thêm.
  thu_tu bigint generated always as identity,
  constraint lien_ket_task_pkey primary key (id),
  constraint lien_ket_task_task_id_fkey foreign key (task_id) references public.task (id) on delete cascade,
  constraint lien_ket_task_them_boi_fkey foreign key (them_boi) references public.ho_so (id) on delete set null,
  constraint lien_ket_task_khong_trung unique (task_id, repo_khoa, loai, so),
  constraint lien_ket_task_loai_hop_le check (loai in ('ISSUE', 'PR')),
  constraint lien_ket_task_so_hop_le check (so > 0),
  constraint lien_ket_task_repo_hop_le check (
    repo ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/[A-Za-z0-9_.-]{1,100}$' and repo !~ '/\.{1,2}$'
  )
);

comment on table public.lien_ket_task is 'Link issue hoặc PR trên Task. Chỉ ghi qua them_lien_ket_vao_task và go_lien_ket_khoi_task.';

create index lien_ket_task_task_id_idx on public.lien_ket_task (task_id);

-- -------------------------------------------------------------------------------------------------
-- 2. Hàm hỗ trợ (dùng trong policy, trigger và hàm; không mở cho client trừ hàm dùng trong policy)
-- -------------------------------------------------------------------------------------------------

-- Tên repo đúng dạng chủ-sở-hữu/tên-repo (cùng biểu thức với ràng buộc ten_repo_hop_le).
create function rieng.la_ten_repo_hop_le(p_repo text) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    p_repo ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/[A-Za-z0-9_.-]{1,100}$' and p_repo !~ '/\.{1,2}$',
    false
  )
$$;

-- Người gọi có thấy Task này không (ai thấy Dự án thì thấy mọi Task của nó). Lát 3 đã khai hàm này
-- (bản giống hệt), nên dùng `create or replace` để áp lát 4 sau lát 3 không lỗi.
create or replace function rieng.duoc_xem_task(p_task_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.task t
    where t.id = p_task_id and rieng.duoc_xem_du_an(t.du_an_id)
  )
$$;

-- Ghi dấu vết chỉnh sửa gần nhất của Task cho người gọi (dùng khi thêm hoặc gỡ link). Đặt cờ để
-- trigger task_truoc_khi_sua (phần 5) cho nhánh riêng này đi qua, rồi bỏ cờ.
create function rieng.ghi_dau_vet_task(p_task_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('rieng.dang_ghi_lien_ket', 'co', true);
  update public.task set sua_boi = auth.uid() where id = p_task_id;
  perform set_config('rieng.dang_ghi_lien_ket', '', true);
end;
$$;

-- -------------------------------------------------------------------------------------------------
-- 3. Trigger: luật không tin client (repo của Dự án)
-- -------------------------------------------------------------------------------------------------

-- Gắn repo. Thứ tự kiểm giống bản bộ nhớ: quyền, Dự án tồn tại, Dự án chưa Lưu trữ, tên repo, trùng.
create function rieng.repo_du_an_truoc_khi_them() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_trang_thai_du_an text;
begin
  if auth.uid() is not null then
    if not rieng.duoc_quan_ly_du_an(new.du_an_id) then
      raise exception 'KHONG_CO_QUYEN' using detail = 'Chỉ PM hoặc Support của Dự án gắn được repo.';
    end if;
    new.them_boi := auth.uid();
  end if;

  -- Khoá chia sẻ dòng Dự án: lưu trữ Dự án (for update) chờ việc gắn repo này xong.
  select d.trang_thai into v_trang_thai_du_an from public.du_an d where d.id = new.du_an_id for share;
  if not found then
    raise exception 'KHONG_TIM_THAY' using detail = 'Dự án không tồn tại.';
  end if;
  if v_trang_thai_du_an = 'LUU_TRU' then
    raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên không gắn repo được.';
  end if;

  if not rieng.la_ten_repo_hop_le(new.ten_repo) then
    raise exception 'REPO_KHONG_HOP_LE' using detail = 'Tên repo phải có dạng chu-so-huu/ten-repo.';
  end if;
  if exists (
    select 1 from public.repo_du_an r
    where r.du_an_id = new.du_an_id and r.ten_repo_khoa = lower(new.ten_repo)
  ) then
    raise exception 'REPO_DA_GAN' using detail = 'Repo này đã được gắn vào Dự án.';
  end if;

  new.them_luc := now();
  return new;
end;
$$;

create trigger repo_du_an_truoc_khi_them
  before insert on public.repo_du_an
  for each row execute function rieng.repo_du_an_truoc_khi_them();

-- Gỡ repo: quyền, rồi Dự án chưa Lưu trữ. Khi Dự án bị xoá kéo theo (không có đường nào cho client
-- xoá Dự án) hoặc chủ dự án sửa tay (không có người gọi): không kiểm.
create function rieng.repo_du_an_truoc_khi_go() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_trang_thai_du_an text;
begin
  if auth.uid() is not null then
    if not rieng.duoc_quan_ly_du_an(old.du_an_id) then
      raise exception 'KHONG_CO_QUYEN' using detail = 'Chỉ PM hoặc Support của Dự án gỡ được repo.';
    end if;
    select d.trang_thai into v_trang_thai_du_an from public.du_an d where d.id = old.du_an_id for share;
    if v_trang_thai_du_an = 'LUU_TRU' then
      raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên không gỡ repo được.';
    end if;
  end if;
  return old;
end;
$$;

create trigger repo_du_an_truoc_khi_go
  before delete on public.repo_du_an
  for each row execute function rieng.repo_du_an_truoc_khi_go();

-- -------------------------------------------------------------------------------------------------
-- 4. Phân quyền từng dòng. Không có policy nào thì không ai đọc hay ghi được gì; mỗi policy dưới
--    đây là một thứ được phép. anon (chưa đăng nhập) không có policy nào.
-- -------------------------------------------------------------------------------------------------

alter table public.repo_du_an enable row level security;
alter table public.lien_ket_task enable row level security;

-- Ai thấy Dự án thì thấy repo của nó (kể cả Dự án Lưu trữ).
create policy repo_du_an_doc on public.repo_du_an
  for select to authenticated
  using (rieng.duoc_xem_du_an(du_an_id));

-- Gắn và gỡ: PM, hoặc Support của chính Dự án đó.
create policy repo_du_an_tao on public.repo_du_an
  for insert to authenticated
  with check (rieng.duoc_quan_ly_du_an(du_an_id));

create policy repo_du_an_go on public.repo_du_an
  for delete to authenticated
  using (rieng.duoc_quan_ly_du_an(du_an_id));

-- Không có policy update cho repo: gỡ rồi gắn lại.

-- Ai thấy Task thì thấy link của nó.
create policy lien_ket_task_doc on public.lien_ket_task
  for select to authenticated
  using (rieng.duoc_xem_task(task_id));

-- Không có policy insert, update, delete cho link: chỉ hai hàm security definer ở phần 6 ghi.

-- Quyền bảng và cột: bỏ mặc định của Supabase, chỉ mở đúng thứ client được làm.
revoke all on table public.repo_du_an, public.lien_ket_task from public, anon, authenticated;
grant select, delete on table public.repo_du_an to authenticated;
grant insert (du_an_id, ten_repo) on table public.repo_du_an to authenticated;
grant select on table public.lien_ket_task to authenticated;
grant all on table public.repo_du_an, public.lien_ket_task to service_role;

-- -------------------------------------------------------------------------------------------------
-- 5. Cập nhật hàm trigger của Task: thêm đúng MỘT nhánh cho cờ rieng.dang_ghi_lien_ket.
--
--    CẨN THẬN KHI GỘP: đây là bản sao CHÉP NGUYÊN VĂN của rieng.task_truoc_khi_sua trong migration lát 2
--    (supabase/migrations/20261125000200_lat_2_task.sql) cộng nhánh `v_dang_ghi_lien_ket`. `create or
--    replace` giữ nguyên trigger task_truoc_khi_sua đã gắn. Nếu sau này ai sửa hàm này ở một migration
--    khác (ví dụ ticket 14), phải mang nhánh `v_dang_ghi_lien_ket` sang bản mới, nếu không thêm hay
--    gỡ link sẽ lỗi KHONG_CO_QUYEN với Thành viên. Lý do phải sửa: dấu vết chỉnh sửa của Task phải
--    đổi khi có link, mà trigger gốc chỉ cho PM hoặc Support đổi dòng Task và chặn Task đã chốt.
-- -------------------------------------------------------------------------------------------------

create or replace function rieng.task_truoc_khi_sua() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_nguoi_goi uuid := auth.uid();
  -- Cờ do hàm chuyển trạng thái của ticket 14 đặt (xem đầu file); client không đặt được.
  v_dang_chuyen boolean := coalesce(current_setting('rieng.dang_chuyen_trang_thai', true), '') = 'co';
  -- Cờ do hàm ghi link GitHub của ticket 17 đặt (rieng.ghi_dau_vet_task); client không đặt được.
  v_dang_ghi_lien_ket boolean := coalesce(current_setting('rieng.dang_ghi_lien_ket', true), '') = 'co';
  v_trang_thai_du_an text;
begin
  new.id := old.id;
  new.du_an_id := old.du_an_id;
  new.tao_boi := old.tao_boi;
  new.tao_luc := old.tao_luc;

  -- (Ticket 17) Thêm hoặc gỡ link GitHub trên Task là một lần chỉnh sửa Task do BẤT KỲ người nào trong
  -- Dự án làm, kể cả khi Task đã chốt: hàm đặt cờ đã tự kiểm quyền và trạng thái Dự án. Ở nhánh này
  -- CHỈ đổi dấu vết chỉnh sửa; mọi cột khác bị đặt lại về giá trị cũ, dù câu lệnh gửi gì.
  if v_dang_ghi_lien_ket and v_nguoi_goi is not null then
    new.tieu_de := old.tieu_de;
    new.mo_ta := old.mo_ta;
    new.han := old.han;
    new.nguoi_thuc_hien_id := old.nguoi_thuc_hien_id;
    new.nguoi_kiem_tra_id := old.nguoi_kiem_tra_id;
    new.trang_thai := old.trang_thai;
    new.so_lan_tra_lai := old.so_lan_tra_lai;
    new.sua_boi := v_nguoi_goi;
    new.sua_luc := now();
    return new;
  end if;

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


-- -------------------------------------------------------------------------------------------------
-- 6. Hàm client gọi (RPC): thêm và gỡ link của Task. security definer: tự kiểm người gọi, quyền và
--    trạng thái theo đúng thứ tự của bản bộ nhớ (Task thấy được, Dự án chưa Lưu trữ, rồi dữ liệu).
-- -------------------------------------------------------------------------------------------------

-- Thêm link vào Task. Trả repo, loại, số của link vừa thêm. Thứ tự lỗi: KHONG_TIM_THAY (Task không
-- tồn tại hoặc người gọi không thấy), DU_AN_DA_LUU_TRU, LINK_KHONG_HOP_LE, LINK_REPO_CHUA_GAN, LINK_TRUNG.
create function public.them_lien_ket_vao_task(p_task_id uuid, p_repo text, p_loai text, p_so bigint) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_du_an_id uuid;
  v_trang_thai_du_an text;
  v_repo text := btrim(coalesce(p_repo, ''));
begin
  if auth.uid() is null then
    raise exception 'CHUA_DANG_NHAP';
  end if;
  select t.du_an_id into v_du_an_id from public.task t where t.id = p_task_id;
  if not found or not rieng.duoc_xem_du_an(v_du_an_id) then
    raise exception 'KHONG_TIM_THAY';
  end if;
  select d.trang_thai into v_trang_thai_du_an from public.du_an d where d.id = v_du_an_id for share;
  if v_trang_thai_du_an = 'LUU_TRU' then
    raise exception 'DU_AN_DA_LUU_TRU';
  end if;
  if not rieng.la_ten_repo_hop_le(v_repo) or p_loai is null or p_loai not in ('ISSUE', 'PR')
     or p_so is null or p_so <= 0 then
    raise exception 'LINK_KHONG_HOP_LE';
  end if;
  if not exists (
    select 1 from public.repo_du_an r
    where r.du_an_id = v_du_an_id and r.ten_repo_khoa = lower(v_repo)
  ) then
    raise exception 'LINK_REPO_CHUA_GAN';
  end if;
  insert into public.lien_ket_task (task_id, repo, loai, so, them_boi)
  values (p_task_id, v_repo, p_loai, p_so, auth.uid())
  on conflict (task_id, repo_khoa, loai, so) do nothing;
  if not found then
    raise exception 'LINK_TRUNG';
  end if;
  perform rieng.ghi_dau_vet_task(p_task_id);
  return jsonb_build_object('repo', v_repo, 'loai', p_loai, 'so', p_so);
end;
$$;

-- Gỡ link khỏi Task (repo không phân biệt hoa thường). Thứ tự lỗi: KHONG_TIM_THAY (Task không thấy),
-- DU_AN_DA_LUU_TRU, KHONG_TIM_THAY (link không có trên Task).
create function public.go_lien_ket_khoi_task(p_task_id uuid, p_repo text, p_loai text, p_so bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_du_an_id uuid;
  v_trang_thai_du_an text;
begin
  if auth.uid() is null then
    raise exception 'CHUA_DANG_NHAP';
  end if;
  select t.du_an_id into v_du_an_id from public.task t where t.id = p_task_id;
  if not found or not rieng.duoc_xem_du_an(v_du_an_id) then
    raise exception 'KHONG_TIM_THAY';
  end if;
  select d.trang_thai into v_trang_thai_du_an from public.du_an d where d.id = v_du_an_id for share;
  if v_trang_thai_du_an = 'LUU_TRU' then
    raise exception 'DU_AN_DA_LUU_TRU';
  end if;
  delete from public.lien_ket_task l
  where l.task_id = p_task_id
    and l.repo_khoa = lower(btrim(coalesce(p_repo, '')))
    and l.loai = p_loai
    and l.so = p_so;
  if not found then
    raise exception 'KHONG_TIM_THAY';
  end if;
  perform rieng.ghi_dau_vet_task(p_task_id);
end;
$$;

-- Quyền gọi hàm: chỉ người đã đăng nhập (và service_role); hàm trigger và hàm hỗ trợ không ai gọi thẳng.
-- Hàm dùng trong policy phải cho authenticated gọi (như các hàm rieng.* của lát 1).
revoke all on function
  rieng.la_ten_repo_hop_le(text),
  rieng.duoc_xem_task(uuid),
  rieng.ghi_dau_vet_task(uuid),
  rieng.repo_du_an_truoc_khi_them(),
  rieng.repo_du_an_truoc_khi_go()
  from public, anon, authenticated;
grant execute on function rieng.duoc_xem_task(uuid) to authenticated;

revoke all on function
  public.them_lien_ket_vao_task(uuid, text, text, bigint),
  public.go_lien_ket_khoi_task(uuid, text, text, bigint)
  from public, anon;
grant execute on function
  public.them_lien_ket_vao_task(uuid, text, text, bigint),
  public.go_lien_ket_khoi_task(uuid, text, text, bigint)
  to authenticated, service_role;
