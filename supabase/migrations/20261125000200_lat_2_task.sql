-- =================================================================================================
-- Lát 2 (ticket 10): bảng Task, phân quyền từng dòng và ràng buộc của cơ sở dữ liệu.
-- Chạy SAU migration lát 1 (supabase/migrations/20261125000100_lat_1_ho_so_du_an.sql): dùng bảng
-- du_an, nguoi_trong_du_an, ho_so và các hàm rieng.* của lát đó.
-- Migration xuống: supabase/down/20261125000200_lat_2_task.down.sql (chạy TRƯỚC bản xuống của lát 1).
--
-- Đây là bản sao phía cơ sở dữ liệu của luật thuần trong src/luat/task.ts (tạo, sửa, đổi người,
-- người được giao phải ở trong Dự án, Task đã chốt) và quyền xem/ghi như Dự án; hai chỗ phải khớp
-- nhau. Bảng ca dùng chung (src/kho/bangCaQuyen.ts, các dòng Task) là nguồn sự thật để đối chiếu.
--
-- CỔNG CHƯA KIỂM (npm test không chạy file này, không có DB, không có mạng):
--   - Toàn bộ SQL dưới đây: bảng, ràng buộc, trigger, hàm, phân quyền từng dòng (RLS), quyền cột.
--   - Bản cài src/kho/khoSupabase.ts cho các lệnh Task chạy trên Supabase thật.
--   Người duyệt cần đọc kỹ SQL này và chạy tay bộ test hợp đồng cùng bảng ca dùng chung trên
--   Supabase thật (xem supabase/README.md, lệnh `npx vitest run --config vitest.supabase.config.ts`).
--
-- VIỆC CHỦ DỰ ÁN LÀM TAY (AI không làm, không áp migration lên Supabase thật):
--   1. Áp migration lát 1 (nếu chưa), rồi áp migration này (SQL Editor, hoặc `supabase db push`).
--   2. Chạy danh sách kiểm tay về Task trong supabase/README.md.
--
-- Luật phía cơ sở dữ liệu (không tin trình duyệt):
--   - Đọc: ai thấy Dự án thì thấy mọi Task của nó (PM thấy mọi Dự án; người khác chỉ Dự án mình ở
--     trong). Người ngoài Dự án không thấy dòng nào.
--   - Ghi (tạo, sửa tiêu đề, mô tả, hạn, đổi người): chỉ PM, hoặc Support của chính Dự án đó.
--   - Người thực hiện và Người kiểm tra: bắt buộc, khác nhau, và người được chọn phải đang ở trong
--     Dự án của Task. Gỡ người khỏi Dự án sau đó KHÔNG đổi Task (Người cũ vẫn ghi trên Task cho đến
--     khi được giao lại), nên ràng buộc "ở trong Dự án" chỉ kiểm lúc tạo và lúc đổi người, chỉ cho
--     người mới được chọn.
--   - Tiêu đề: không rỗng, không chỉ khoảng trắng, không có khoảng trắng đầu cuối, tối đa 200 ký tự.
--   - Dự án đã Lưu trữ: không tạo, không sửa Task của nó (DU_AN_DA_LUU_TRU). Task Hoàn thành hoặc
--     Huỷ: không sửa, không đổi người (TASK_DA_CHOT).
--   - Dấu vết: người tạo, ngày tạo, người chỉnh sửa, ngày chỉnh sửa do trigger đặt theo auth.uid()
--     và now(); giá trị client gửi lên bị ghi đè. Client cũng không có quyền cột trên các cột này.
--   - Trạng thái và số lần bị Trả lại: Task mới luôn bắt đầu ở Mới với 0 lần Trả lại. Không vai nào
--     ghi thẳng được hai cột này (client không có quyền cột; trigger chặn thêm một lớp). Chúng chỉ
--     đổi qua hàm chuyển trạng thái của ticket 14. Hợp đồng cho hàm đó: là security definer, tự kiểm
--     ma trận chuyển trạng thái và quyền, rồi MỚI gọi
--         perform set_config('rieng.dang_chuyen_trang_thai', 'co', true);
--     (đúng một giao dịch) trước khi update hai cột đó; trigger task_truoc_khi_sua thấy cờ này thì
--     cho đổi hai cột, bỏ qua kiểm "PM hoặc Support" (hàm đã tự kiểm), nhưng vẫn chặn Dự án Lưu trữ
--     và Task đã chốt, và vẫn đặt dấu vết chỉnh sửa theo auth.uid().
--   - Chủ dự án sửa tay trong SQL Editor hoặc dùng khoá service (không có auth.uid()): được đổi
--     trạng thái trực tiếp (để dựng dữ liệu test), không bị khoá Task đã chốt hay Dự án Lưu trữ,
--     dấu vết chỉnh sửa giữ nguyên. Vẫn không đổi được mã, Dự án, người tạo, ngày tạo, và vẫn phải
--     qua kiểm tra người thực hiện/kiểm tra.
--   - Xoá Task: không có quyền xoá (không xoá cứng; chỉ Huỷ). Xoá tài khoản đang giữ Task bị chặn
--     bởi khoá ngoại (on delete restrict): giao lại Task trước.
--
-- Lỗi nghiệp vụ được ném bằng `raise exception '<MÃ>'` với MÃ là mã lỗi của Kho dữ liệu
-- (src/kho/ketQua.ts); bản cài Supabase đọc lại mã đó từ thông báo lỗi.
-- Lưu ý PostgreSQL: trigger BEFORE chạy TRƯỚC khi kiểm WITH CHECK của RLS, nên mọi trigger dưới đây
-- tự kiểm quyền "PM hoặc Support của Dự án" đầu tiên, để người không có quyền chỉ nhận
-- KHONG_CO_QUYEN và không biết gì thêm (Dự án có Lưu trữ không, người đó có ở trong Dự án không...).
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. Bảng
-- -------------------------------------------------------------------------------------------------

create table public.task (
  id uuid not null default gen_random_uuid(),
  du_an_id uuid not null,
  tieu_de text not null,
  mo_ta text not null default '',
  -- Hạn là một ngày, không có giờ (spec, giả định 10). Kiểu date tự từ chối ngày không có thật.
  han date,
  nguoi_thuc_hien_id uuid not null,
  nguoi_kiem_tra_id uuid not null,
  -- Chỉ nhận giá trị ban đầu (MOI, 0) khi tạo; đổi qua hàm của ticket 14 (xem phần đầu file).
  trang_thai text not null default 'MOI',
  so_lan_tra_lai integer not null default 0,
  tao_boi uuid not null,
  tao_luc timestamptz not null default now(),
  sua_boi uuid,
  sua_luc timestamptz,
  constraint task_pkey primary key (id),
  constraint task_du_an_id_fkey foreign key (du_an_id) references public.du_an (id) on delete cascade,
  -- Người được giao ghi trên Task kể cả khi đã rời Dự án, nên khoá ngoại trỏ hồ sơ, không trỏ
  -- nguoi_trong_du_an. Không xoá được tài khoản còn giữ Task.
  constraint task_nguoi_thuc_hien_id_fkey foreign key (nguoi_thuc_hien_id) references public.ho_so (id) on delete restrict,
  constraint task_nguoi_kiem_tra_id_fkey foreign key (nguoi_kiem_tra_id) references public.ho_so (id) on delete restrict,
  constraint task_tao_boi_fkey foreign key (tao_boi) references public.ho_so (id),
  constraint task_sua_boi_fkey foreign key (sua_boi) references public.ho_so (id),
  -- Cùng giới hạn với DO_DAI_TIEU_DE_TASK_TOI_DA trong src/luat/task.ts. Biểu thức chính quy: ký
  -- tự đầu và cuối đều không phải khoảng trắng (kể cả tab, xuống dòng), nên chuỗi rỗng và chuỗi
  -- chỉ khoảng trắng bị loại.
  constraint task_tieu_de_hop_le check (tieu_de ~ '^\S(.*\S)?$' and char_length(tieu_de) <= 200),
  constraint task_trang_thai_hop_le check (
    trang_thai in ('MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY')
  ),
  constraint task_so_lan_tra_lai_hop_le check (so_lan_tra_lai >= 0),
  -- Người kiểm tra khác Người thực hiện (không ai tự duyệt việc của mình). Trigger ném TRUNG_NGUOI
  -- trước; ràng buộc này là hàng rào cuối cùng.
  constraint task_nguoi_khac_nhau check (nguoi_thuc_hien_id <> nguoi_kiem_tra_id),
  constraint task_dau_vet_sua_du_cap check ((sua_boi is null) = (sua_luc is null))
);

comment on table public.task is 'Task của một Dự án. Dấu vết do trigger đặt; trạng thái và số lần Trả lại chỉ đổi qua hàm của ticket 14.';

create index task_du_an_id_idx on public.task (du_an_id);
create index task_nguoi_thuc_hien_id_idx on public.task (nguoi_thuc_hien_id);
create index task_nguoi_kiem_tra_id_idx on public.task (nguoi_kiem_tra_id);
create index task_tao_boi_idx on public.task (tao_boi);
create index task_sua_boi_idx on public.task (sua_boi) where sua_boi is not null;

-- -------------------------------------------------------------------------------------------------
-- 2. Hàm hỗ trợ (dùng trong trigger; không mở cho client)
-- -------------------------------------------------------------------------------------------------

-- Tài khoản `p_nguoi_id` có đang ở trong Dự án `p_du_an_id` không (không phụ thuộc người gọi).
create function rieng.la_nguoi_trong_du_an(p_du_an_id uuid, p_nguoi_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.nguoi_trong_du_an n
    where n.du_an_id = p_du_an_id and n.nguoi_dung_id = p_nguoi_id
  )
$$;

-- -------------------------------------------------------------------------------------------------
-- 3. Trigger: luật không tin client
-- -------------------------------------------------------------------------------------------------

-- Tạo Task. Thứ tự kiểm giống bản bộ nhớ: quyền, Dự án tồn tại, Dự án chưa Lưu trữ, rồi người.
-- Người tạo là người gọi, ngày tạo là giờ máy chủ, chưa có phần chỉnh sửa, luôn bắt đầu ở Mới
-- với 0 lần Trả lại (giá trị client gửi lên, nếu có, bị ghi đè).
create function rieng.task_truoc_khi_tao() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_trang_thai_du_an text;
begin
  if auth.uid() is not null then
    if not rieng.duoc_quan_ly_du_an(new.du_an_id) then
      raise exception 'KHONG_CO_QUYEN' using detail = 'Chỉ PM hoặc Support của Dự án tạo được Task.';
    end if;
    new.tao_boi := auth.uid();
  end if;

  -- Khoá chia sẻ dòng Dự án: lưu trữ Dự án (for update) chờ việc tạo Task này xong.
  select d.trang_thai into v_trang_thai_du_an from public.du_an d where d.id = new.du_an_id for share;
  if not found then
    raise exception 'KHONG_TIM_THAY' using detail = 'Dự án không tồn tại.';
  end if;
  if v_trang_thai_du_an = 'LUU_TRU' then
    raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên không tạo Task được.';
  end if;

  if new.nguoi_thuc_hien_id is null or new.nguoi_kiem_tra_id is null then
    raise exception 'THIEU_NGUOI' using detail = 'Task phải có đủ Người thực hiện và Người kiểm tra.';
  end if;
  if not rieng.la_nguoi_trong_du_an(new.du_an_id, new.nguoi_thuc_hien_id)
     or not rieng.la_nguoi_trong_du_an(new.du_an_id, new.nguoi_kiem_tra_id) then
    raise exception 'NGUOI_NGOAI_DU_AN' using detail = 'Người được chọn không ở trong Dự án.';
  end if;
  if new.nguoi_thuc_hien_id = new.nguoi_kiem_tra_id then
    raise exception 'TRUNG_NGUOI' using detail = 'Người kiểm tra phải khác Người thực hiện.';
  end if;

  new.tao_luc := now();
  new.sua_boi := null;
  new.sua_luc := null;
  new.trang_thai := 'MOI';
  new.so_lan_tra_lai := 0;
  return new;
end;
$$;

create trigger task_truoc_khi_tao
  before insert on public.task
  for each row execute function rieng.task_truoc_khi_tao();

-- Sửa Task (tiêu đề, mô tả, hạn, đổi người, và đổi trạng thái qua hàm của ticket 14).
-- Mã, Dự án, người tạo và ngày tạo giữ nguyên với mọi người.
-- Với client (auth.uid() có giá trị), theo thứ tự như bản bộ nhớ: quyền, Dự án Lưu trữ, Task đã
-- chốt, rồi người. Với chủ dự án / khoá service (không có người gọi): chỉ giữ ràng buộc về người.
create function rieng.task_truoc_khi_sua() returns trigger
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

create trigger task_truoc_khi_sua
  before update on public.task
  for each row execute function rieng.task_truoc_khi_sua();

-- -------------------------------------------------------------------------------------------------
-- 4. Phân quyền từng dòng. Không có policy nào thì không ai đọc hay ghi được gì; mỗi policy dưới
--    đây là một thứ được phép. anon (chưa đăng nhập) không có policy nào.
-- -------------------------------------------------------------------------------------------------

alter table public.task enable row level security;

-- Ai thấy Dự án thì thấy mọi Task của nó (PM: mọi Dự án; người khác: Dự án mình ở trong).
create policy task_doc on public.task
  for select to authenticated
  using (rieng.duoc_xem_du_an(du_an_id));

-- Ghi: PM, hoặc Support của chính Dự án đó.
create policy task_tao on public.task
  for insert to authenticated
  with check (rieng.duoc_quan_ly_du_an(du_an_id));

create policy task_sua on public.task
  for update to authenticated
  using (rieng.duoc_quan_ly_du_an(du_an_id))
  with check (rieng.duoc_quan_ly_du_an(du_an_id));

-- Không có policy delete cho Task: không xoá cứng, chỉ Huỷ.

-- Quyền bảng và cột: bỏ mặc định của Supabase, chỉ mở đúng cột client được ghi. Không có quyền cột
-- trên id, trang_thai, so_lan_tra_lai, tao_boi, tao_luc, sua_boi, sua_luc.
revoke all on table public.task from public, anon, authenticated;
grant select on table public.task to authenticated;
grant insert (du_an_id, tieu_de, mo_ta, han, nguoi_thuc_hien_id, nguoi_kiem_tra_id)
  on table public.task to authenticated;
grant update (tieu_de, mo_ta, han, nguoi_thuc_hien_id, nguoi_kiem_tra_id)
  on table public.task to authenticated;
grant all on table public.task to service_role;

-- -------------------------------------------------------------------------------------------------
-- 5. Hàm client gọi (RPC)
-- -------------------------------------------------------------------------------------------------

-- Tên hiển thị hiện tại của người ghi trên Task (Người thực hiện, Người kiểm tra, người tạo, người
-- chỉnh sửa), chỉ cho Task của Dự án người gọi thấy được. Người đã rời Dự án hoặc PM không ở trong
-- Dự án thì người xem chưa chắc đọc được hồ sơ của họ, nên không đọc thẳng bảng ho_so.
create function public.ten_nguoi_cua_task(p_ids uuid[]) returns table (id uuid, ten_hien_thi text)
language sql stable security definer set search_path = ''
as $$
  select h.id, h.ten_hien_thi
  from public.ho_so h
  where auth.uid() is not null
    and h.id = any (p_ids)
    and exists (
      select 1 from public.task t
      where (t.nguoi_thuc_hien_id = h.id or t.nguoi_kiem_tra_id = h.id or t.tao_boi = h.id or t.sua_boi = h.id)
        and rieng.duoc_xem_du_an(t.du_an_id)
    )
$$;

-- Quyền gọi hàm: chỉ người đã đăng nhập (và service_role); hàm trigger và hàm hỗ trợ không ai gọi thẳng.
revoke all on function
  rieng.la_nguoi_trong_du_an(uuid, uuid),
  rieng.task_truoc_khi_tao(),
  rieng.task_truoc_khi_sua()
  from public, anon, authenticated;

revoke all on function public.ten_nguoi_cua_task(uuid[]) from public, anon;
grant execute on function public.ten_nguoi_cua_task(uuid[]) to authenticated, service_role;
