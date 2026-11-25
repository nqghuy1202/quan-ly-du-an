-- =================================================================================================
-- Lát 3 (ticket 14): hàm chuyển trạng thái Task, bảng lịch sử trạng thái.
-- Chạy SAU migration lát 2 (supabase/migrations/20261125000200_lat_2_task.sql): dùng bảng task,
-- du_an, nguoi_trong_du_an, ho_so và các hàm rieng.* của hai lát trước.
-- Migration xuống: supabase/down/20261125000300_lat_3_vong_duyet.down.sql (chạy TRƯỚC bản xuống của lát 2).
--
-- Đây là bản sao phía cơ sở dữ liệu của luật thuần trong src/luat/chuyenTrangThai.ts (ma trận 12
-- bước, ai được làm, lý do bắt buộc, bộ đếm Trả lại, dòng lịch sử); hai chỗ phải khớp nhau. Nguồn sự
-- thật để đối chiếu: bảng ca dùng chung src/kho/bangCaChuyenTrangThai.ts (chạy tay trên Supabase thật
-- qua src/kho/hopDongChuyenTrangThai.ts, xem supabase/README.md). Cổng chỉ so được ma trận trong file
-- này với ma trận của luật thuần bằng cách đọc chữ (src/kho/khoSupabaseVongDuyet.test.ts).
--
-- CỔNG CHƯA KIỂM (npm test không chạy file này, không có DB, không có mạng):
--   - Toàn bộ SQL dưới đây: bảng, ràng buộc, trigger, hàm, phân quyền từng dòng (RLS), quyền cột.
--   - Hàm public.doi_trang_thai_task và public.lich_su_task chạy trên Supabase thật.
--   Người duyệt cần đọc kỹ SQL này (nhất là hàm doi_trang_thai_task) và chạy tay bộ test hợp đồng
--   cùng bảng ca dùng chung trên Supabase thật (`npx vitest run --config vitest.supabase.config.ts`).
--
-- VIỆC CHỦ DỰ ÁN LÀM TAY (AI không làm, không áp migration lên Supabase thật):
--   1. Áp migration lát 1 và lát 2 (nếu chưa), rồi áp migration này (SQL Editor, hoặc `supabase db push`).
--   2. Chạy danh sách kiểm tay về vòng duyệt trong supabase/README.md.
--
-- Luật phía cơ sở dữ liệu (không tin trình duyệt):
--   - Đổi trạng thái chỉ qua public.doi_trang_thai_task(p_task_id, p_sang, p_ly_do). Hàm KHÔNG nhận
--     "người gọi" làm tham số: người gọi luôn là auth.uid() của phiên đăng nhập.
--   - Hàm là security definer và tự kiểm đúng thứ tự của luật thuần (kiemChuyenTrangThai):
--       1. người gọi không giữ vai nào trên Task: KHONG_CO_QUYEN (Task không tồn tại: PM nhận
--          KHONG_TIM_THAY, người khác nhận KHONG_CO_QUYEN, không lộ gì);
--       2. Dự án đã Lưu trữ: DU_AN_DA_LUU_TRU;
--       3. Task đã Hoàn thành hoặc Huỷ: TASK_DA_CHOT, với mọi bước;
--       4. dữ liệu sai (trạng thái đích không có thật, lý do quá 1000 ký tự): KHONG_HOP_LE;
--       5. bước không có trong ma trận: BUOC_KHONG_HOP_LE;
--       6. bước có trong ma trận nhưng vai của người gọi không được làm: KHONG_CO_QUYEN;
--       7. bước cần lý do mà lý do rỗng hay chỉ khoảng trắng: LY_DO_BAT_BUOC.
--     Chỉ SAU khi qua cả bảy bước mới bật cờ giao dịch rồi cập nhật Task (xem hợp đồng ở đầu
--     migration lát 2): perform set_config('rieng.dang_chuyen_trang_thai', 'co', true). Cờ bị tắt
--     ngay sau lệnh update, nên phần còn lại của giao dịch không dùng ké được.
--   - Một giao dịch duy nhất: đổi trạng thái, tăng bộ đếm Trả lại (đúng 1 khi sang Trả lại, các
--     bước khác giữ nguyên), cập nhật người và ngày chỉnh sửa gần nhất (trigger task_truoc_khi_sua của
--     lát 2, theo auth.uid() và now()) và ghi đúng một dòng lịch sử. Lỗi ở bất kỳ bước nào thì không
--     đổi gì, không ghi dòng lịch sử nào.
--   - Hàm khoá dòng Task (for update): hai lần đổi cùng lúc xếp hàng, lần sau đọc lại trạng thái mới;
--     và khoá chia sẻ dòng Dự án (for share): lưu trữ Dự án chờ lần đổi đang chạy xong.
--   - Lịch sử (public.lich_su_trang_thai_task): chỉ thêm, không sửa (trigger chặn), không xoá. Ai
--     thấy Dự án của Task thì đọc được (RLS) và không vai nào của client ghi trực tiếp được (không
--     có policy ghi, không có quyền bảng). Ma trận được ép thêm ở ràng buộc của bảng (chỉ nhận bước
--     có trong ma trận, Trả lại, Bị lỗi, Huỷ bắt buộc có lý do).
--   - Thời điểm là giờ máy chủ (now()); tham số bayGio của Kho bị bỏ qua (như các lát trước).
--
-- Lỗi nghiệp vụ được ném bằng `raise exception '<MÃ>'` với MÃ là mã lỗi của Kho dữ liệu
-- (src/kho/ketQua.ts); bản cài Supabase đọc lại mã đó từ thông báo lỗi.
--
-- TIẾN ĐỘ VÀ TRỄ HẠN (ticket 14, ticket 13): KHÔNG có luật nào được viết lại bằng SQL ở đây. Hai thứ
-- này tính bằng hàm thuần của ticket 13 trên danh sách Task mà Kho đọc (`danhSachTask` đã trả đủ
-- trạng thái và hạn, đọc hết các trang). Migration này chỉ thêm hai chỉ mục để các truy vấn đó (Task
-- của một Dự án theo trạng thái; Task còn hạn chưa chốt) không phải quét cả bảng.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. Ma trận chuyển trạng thái, ở dạng dữ liệu. Cùng nội dung với MA_TRAN_CHUYEN_TRANG_THAI trong
--    src/luat/chuyenTrangThai.ts (cổng đọc chữ để so hai bên). Cột nguoi_lam dùng đúng tên vai của
--    luật thuần: NGUOI_THUC_HIEN, NGUOI_KIEM_TRA, SUPPORT (của Dự án), PM.
--    Hoàn thành và Huỷ không có dòng nào đi ra: trạng thái cuối.
-- -------------------------------------------------------------------------------------------------

create function rieng.ma_tran_chuyen_trang_thai()
returns table (tu text, sang text, nguoi_lam text[], can_ly_do boolean)
language sql immutable set search_path = ''
as $$
  select v.tu, v.sang, v.nguoi_lam, v.can_ly_do
  from (values
    ('MOI',       'DANG_LAM',   array['NGUOI_THUC_HIEN', 'SUPPORT', 'PM'], false),
    ('DANG_LAM',  'CHO_DUYET',  array['NGUOI_THUC_HIEN', 'SUPPORT', 'PM'], false),
    ('CHO_DUYET', 'HOAN_THANH', array['NGUOI_KIEM_TRA', 'SUPPORT', 'PM'], false),
    ('CHO_DUYET', 'TRA_LAI',    array['NGUOI_KIEM_TRA', 'SUPPORT', 'PM'], true),
    ('CHO_DUYET', 'BI_LOI',     array['NGUOI_KIEM_TRA', 'SUPPORT', 'PM'], true),
    ('TRA_LAI',   'DANG_LAM',   array['NGUOI_THUC_HIEN', 'SUPPORT', 'PM'], false),
    ('BI_LOI',    'DANG_LAM',   array['SUPPORT', 'PM'], false),
    ('MOI',       'HUY',        array['SUPPORT', 'PM'], true),
    ('DANG_LAM',  'HUY',        array['SUPPORT', 'PM'], true),
    ('CHO_DUYET', 'HUY',        array['SUPPORT', 'PM'], true),
    ('TRA_LAI',   'HUY',        array['SUPPORT', 'PM'], true),
    ('BI_LOI',    'HUY',        array['SUPPORT', 'PM'], true)
  ) as v (tu, sang, nguoi_lam, can_ly_do)
$$;

-- Bước (tu, sang) có trong ma trận không. Dùng trong ràng buộc của bảng lịch sử.
create function rieng.la_buoc_chuyen_hop_le(p_tu text, p_sang text) returns boolean
language sql immutable set search_path = ''
as $$
  select exists (
    select 1 from rieng.ma_tran_chuyen_trang_thai() m where m.tu = p_tu and m.sang = p_sang
  )
$$;

-- -------------------------------------------------------------------------------------------------
-- 2. Bảng lịch sử trạng thái: mỗi lần đổi một dòng (Task, người đổi, thời điểm, từ, sang, lý do).
-- -------------------------------------------------------------------------------------------------

create table public.lich_su_trang_thai_task (
  -- Số thứ tự ghi: cùng một thời điểm thì dòng ghi trước đứng trước.
  stt bigint generated always as identity,
  task_id uuid not null,
  nguoi_doi_id uuid not null,
  luc timestamptz not null default now(),
  tu text not null,
  sang text not null,
  -- Null khi bước không cần lý do và người đổi không nhập. Có thì đã cắt khoảng trắng hai đầu.
  ly_do text,
  constraint lich_su_trang_thai_task_pkey primary key (stt),
  -- Xoá Task (chỉ xảy ra khi xoá cả Dự án ngoài ứng dụng) kéo theo lịch sử của nó.
  constraint lich_su_trang_thai_task_task_id_fkey foreign key (task_id) references public.task (id) on delete cascade,
  -- Không xoá được tài khoản đã từng đổi trạng thái (như người tạo Task, Dự án): lịch sử giữ người đổi.
  constraint lich_su_trang_thai_task_nguoi_doi_id_fkey foreign key (nguoi_doi_id) references public.ho_so (id),
  -- Chỉ nhận bước có trong ma trận (nên cũng không có dòng đi ra từ Hoàn thành, Huỷ).
  constraint lich_su_buoc_hop_le check (rieng.la_buoc_chuyen_hop_le(tu, sang)),
  -- Cùng giới hạn với DO_DAI_LY_DO_TOI_DA trong src/luat/chuyenTrangThai.ts; ký tự đầu và cuối đều
  -- không phải khoảng trắng nên lý do rỗng hay chỉ khoảng trắng bị loại.
  constraint lich_su_ly_do_hop_le check (ly_do is null or (ly_do ~ '^\S(.*\S)?$' and char_length(ly_do) <= 1000)),
  -- Trả lại, Bị lỗi và Huỷ bắt buộc có lý do.
  constraint lich_su_ly_do_bat_buoc check (sang not in ('TRA_LAI', 'BI_LOI', 'HUY') or ly_do is not null)
);

comment on table public.lich_su_trang_thai_task is 'Lịch sử trạng thái Task: chỉ thêm, chỉ qua hàm doi_trang_thai_task. Đọc theo quyền xem Dự án.';

create index lich_su_trang_thai_task_task_idx on public.lich_su_trang_thai_task (task_id, luc, stt);
create index lich_su_trang_thai_task_nguoi_doi_idx on public.lich_su_trang_thai_task (nguoi_doi_id);

-- Hai chỉ mục cho các truy vấn Tiến độ và Trễ hạn trên bảng Task (xem phần đầu file).
create index task_du_an_trang_thai_idx on public.task (du_an_id, trang_thai);
create index task_han_chua_chot_idx on public.task (han)
  where han is not null and trang_thai not in ('HOAN_THANH', 'HUY');

-- -------------------------------------------------------------------------------------------------
-- 3. Hàm hỗ trợ và trigger
-- -------------------------------------------------------------------------------------------------

-- Người gọi (auth.uid()) có thấy Task `p_task_id` không: thấy Dự án của Task. Task không tồn tại
-- thì không thấy. Dùng trong policy đọc lịch sử.
create function rieng.duoc_xem_task(p_task_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.task t
    where t.id = p_task_id and rieng.duoc_xem_du_an(t.du_an_id)
  )
$$;

-- Lịch sử không sửa được (mọi vai, kể cả chủ dự án sửa tay: muốn sửa phải tắt trigger có chủ ý).
create function rieng.lich_su_truoc_khi_sua() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'KHONG_CO_QUYEN' using detail = 'Lịch sử trạng thái chỉ thêm, không sửa được.';
end;
$$;

create trigger lich_su_truoc_khi_sua
  before update on public.lich_su_trang_thai_task
  for each row execute function rieng.lich_su_truoc_khi_sua();

-- -------------------------------------------------------------------------------------------------
-- 4. Phân quyền từng dòng và quyền bảng. Không có policy ghi và không có quyền ghi: chỉ hàm
--    doi_trang_thai_task (chạy bằng quyền chủ hàm) thêm được dòng. anon không có policy nào.
-- -------------------------------------------------------------------------------------------------

alter table public.lich_su_trang_thai_task enable row level security;

-- Ai thấy Dự án của Task thì đọc được lịch sử của Task (PM: mọi Dự án; người khác: Dự án mình ở trong).
create policy lich_su_doc on public.lich_su_trang_thai_task
  for select to authenticated
  using (rieng.duoc_xem_task(task_id));

revoke all on table public.lich_su_trang_thai_task from public, anon, authenticated;
grant select on table public.lich_su_trang_thai_task to authenticated;
grant all on table public.lich_su_trang_thai_task to service_role;

-- -------------------------------------------------------------------------------------------------
-- 5. Hàm client gọi (RPC)
-- -------------------------------------------------------------------------------------------------

-- Đổi trạng thái Task. Xem thứ tự kiểm ở phần đầu file; mỗi bước khớp một bước của kiemChuyenTrangThai.
create function public.doi_trang_thai_task(p_task_id uuid, p_sang text, p_ly_do text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_nguoi uuid := auth.uid();
  v_du_an_id uuid;
  v_task public.task;
  v_trang_thai_du_an text;
  v_vai_he_thong text;
  v_vai text[] := array[]::text[];
  v_nguoi_lam text[];
  v_can_ly_do boolean;
  v_ly_do text;
begin
  if v_nguoi is null then
    raise exception 'CHUA_DANG_NHAP';
  end if;

  -- Đọc nhanh, chưa khoá: người không thấy Dự án của Task (hoặc Task không tồn tại) không khoá được
  -- dòng nào. Người không thấy Dự án thì chắc chắn không giữ vai nào, nên KHONG_CO_QUYEN ở đây
  -- trùng với kết quả của bước 1.
  select t.du_an_id into v_du_an_id from public.task t where t.id = p_task_id;
  if not found then
    -- Task không tồn tại: PM nhận KHONG_TIM_THAY, người khác nhận KHONG_CO_QUYEN (không lộ gì).
    if rieng.la_pm() then
      raise exception 'KHONG_TIM_THAY' using detail = 'Task không tồn tại.';
    end if;
    raise exception 'KHONG_CO_QUYEN' using detail = 'Bạn không đổi được trạng thái Task này.';
  end if;
  if not rieng.duoc_xem_du_an(v_du_an_id) then
    raise exception 'KHONG_CO_QUYEN' using detail = 'Bạn không đổi được trạng thái Task này.';
  end if;

  -- Khoá dòng Task rồi đọc lại: từ đây trạng thái và hai người của Task không đổi được dưới chân hàm.
  select t.* into v_task from public.task t where t.id = p_task_id for update;
  if not found then
    if rieng.la_pm() then
      raise exception 'KHONG_TIM_THAY' using detail = 'Task không tồn tại.';
    end if;
    raise exception 'KHONG_CO_QUYEN' using detail = 'Bạn không đổi được trạng thái Task này.';
  end if;
  -- Khoá chia sẻ dòng Dự án: lưu trữ Dự án (for update) chờ lần đổi này xong.
  select d.trang_thai into v_trang_thai_du_an from public.du_an d where d.id = v_task.du_an_id for share;

  -- Bước 1: các vai người gọi giữ trên Task (cacVaiTrenTask). Người thực hiện và Người kiểm tra chỉ
  -- tính khi còn ở trong Dự án; Support chỉ của Dự án mình ở trong; PM ở mọi Dự án.
  v_vai_he_thong := rieng.vai_cua_toi();
  if rieng.la_nguoi_trong_du_an(v_task.du_an_id, v_nguoi) then
    if v_nguoi = v_task.nguoi_thuc_hien_id then
      v_vai := array_append(v_vai, 'NGUOI_THUC_HIEN');
    end if;
    if v_nguoi = v_task.nguoi_kiem_tra_id then
      v_vai := array_append(v_vai, 'NGUOI_KIEM_TRA');
    end if;
    if v_vai_he_thong = 'SUPPORT' then
      v_vai := array_append(v_vai, 'SUPPORT');
    end if;
  end if;
  if v_vai_he_thong = 'PM' then
    v_vai := array_append(v_vai, 'PM');
  end if;
  if coalesce(array_length(v_vai, 1), 0) = 0 then
    raise exception 'KHONG_CO_QUYEN' using detail = 'Chỉ Người thực hiện, Người kiểm tra của Task, Support của Dự án hoặc PM mới đổi được trạng thái Task này.';
  end if;

  -- Bước 2: Dự án đã Lưu trữ.
  if v_trang_thai_du_an = 'LUU_TRU' then
    raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên Task chỉ xem được.';
  end if;

  -- Bước 3: Task đã chốt, với mọi bước.
  if v_task.trang_thai in ('HOAN_THANH', 'HUY') then
    raise exception 'TASK_DA_CHOT' using detail = 'Task đã Hoàn thành hoặc Huỷ nên không chuyển trạng thái được nữa.';
  end if;

  -- Bước 4: dữ liệu. Lý do: chuẩn hoá NFC, cắt khoảng trắng hai đầu, rỗng là không có lý do.
  if p_sang is null or p_sang not in ('MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY') then
    raise exception 'KHONG_HOP_LE' using detail = 'Trạng thái muốn chuyển sang không hợp lệ.';
  end if;
  v_ly_do := nullif(regexp_replace(normalize(coalesce(p_ly_do, ''), NFC), '^\s+|\s+$', '', 'g'), '');
  if char_length(v_ly_do) > 1000 then
    raise exception 'KHONG_HOP_LE' using detail = 'Lý do tối đa 1000 ký tự.';
  end if;

  -- Bước 5: bước có trong ma trận không (kể cả "sang chính trạng thái hiện tại": không có).
  select m.nguoi_lam, m.can_ly_do
    into v_nguoi_lam, v_can_ly_do
    from rieng.ma_tran_chuyen_trang_thai() m
    where m.tu = v_task.trang_thai and m.sang = p_sang;
  if not found then
    raise exception 'BUOC_KHONG_HOP_LE' using detail = 'Không có bước chuyển này trong vòng duyệt.';
  end if;

  -- Bước 6: vai của người gọi có được làm bước này không.
  if not (v_vai && v_nguoi_lam) then
    raise exception 'KHONG_CO_QUYEN' using detail = 'Bạn không có quyền làm bước chuyển này.';
  end if;

  -- Bước 7: lý do bắt buộc.
  if v_can_ly_do and v_ly_do is null then
    raise exception 'LY_DO_BAT_BUOC' using detail = 'Hãy nhập lý do. Trả lại, báo Bị lỗi và Huỷ Task đều bắt buộc có lý do.';
  end if;

  -- Qua hết bảy bước mới được ghi. Bật cờ giao dịch cho trigger task_truoc_khi_sua (chỉ hàm này bật),
  -- đổi trạng thái và bộ đếm Trả lại, rồi tắt cờ ngay. Trigger đặt người và ngày chỉnh sửa gần nhất
  -- theo auth.uid() và now(), và vẫn chặn Dự án Lưu trữ, Task đã chốt (đã kiểm ở trên, kiểm lại một lớp).
  perform set_config('rieng.dang_chuyen_trang_thai', 'co', true);
  update public.task t
    set trang_thai = p_sang,
        so_lan_tra_lai = t.so_lan_tra_lai + case when p_sang = 'TRA_LAI' then 1 else 0 end
    where t.id = p_task_id;
  perform set_config('rieng.dang_chuyen_trang_thai', '', true);

  -- Đúng một dòng lịch sử cho lần đổi này, cùng giao dịch (và cùng now()) với phần cập nhật trên.
  insert into public.lich_su_trang_thai_task (task_id, nguoi_doi_id, luc, tu, sang, ly_do)
  values (p_task_id, v_nguoi, now(), v_task.trang_thai, p_sang, v_ly_do);
end;
$$;

-- Lịch sử trạng thái của Task, theo thứ tự thời gian tăng dần (cùng lúc thì theo thứ tự ghi), kèm
-- tên hiển thị hiện tại của người đổi. Đọc tên bằng quyền chủ hàm vì người đổi có thể đã rời Dự án
-- (người xem chưa chắc đọc được hồ sơ của họ); chỉ trả cho người thấy Dự án của Task. Task không
-- tồn tại hoặc người gọi không thấy: cùng một lỗi KHONG_TIM_THAY (không lộ là có tồn tại).
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

-- Quyền gọi hàm: hàm hỗ trợ và hàm trigger không ai gọi thẳng; hàm của client chỉ người đã đăng nhập
-- (và service_role). rieng.duoc_xem_task cần cho policy; hai hàm ma trận cần cho ràng buộc của bảng
-- khi service_role ghi trực tiếp (dựng dữ liệu thử).
revoke all on function
  rieng.ma_tran_chuyen_trang_thai(),
  rieng.la_buoc_chuyen_hop_le(text, text),
  rieng.duoc_xem_task(uuid),
  rieng.lich_su_truoc_khi_sua()
  from public, anon, authenticated;
grant execute on function rieng.duoc_xem_task(uuid) to authenticated;
grant execute on function
  rieng.ma_tran_chuyen_trang_thai(),
  rieng.la_buoc_chuyen_hop_le(text, text)
  to service_role;

revoke all on function
  public.doi_trang_thai_task(uuid, text, text),
  public.lich_su_task(uuid)
  from public, anon;
grant execute on function
  public.doi_trang_thai_task(uuid, text, text),
  public.lich_su_task(uuid)
  to authenticated, service_role;
