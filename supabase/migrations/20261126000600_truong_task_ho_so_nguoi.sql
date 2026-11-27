-- =================================================================================================
-- Trường mới của Task, hồ sơ và Người trong dự án (ticket truong-moi 10): Mức ưu tiên của Task (kèm lịch sử
-- đổi mức), Thông tin nhân sự của hồ sơ (Số điện thoại, Chức danh, Phòng ban), Vai trò trong Dự án.
-- Chạy SAU migration trường mới của Dự án (supabase/migrations/20261126000500_truong_du_an.sql), tức là sau
-- lát 1, 2, 3, 4 và 000500.
-- Migration xuống: supabase/down/20261126000600_truong_task_ho_so_nguoi.down.sql (chạy TRƯỚC bản xuống của
-- 000500).
--
-- Đây là bản sao phía cơ sở dữ liệu của luật thuần trong src/luat/mucUuTien.ts, src/luat/task.ts (đổi Mức ưu
-- tiên theo quyền sửa Task), src/luat/thongTinNhanSu.ts (dạng Số điện thoại, độ dài, quyền xem) và
-- src/luat/duAn.ts (Vai trò trong Dự án); hai chỗ phải khớp nhau. Bộ test hợp đồng
-- (src/kho/hopDongMucUuTienTask.ts, src/kho/hopDongThongTinNhanSu.ts, src/kho/hopDongVaiTroTrongDuAn.ts), bảng
-- ca dùng chung (src/kho/bangCaQuyen.ts) và bản bộ nhớ (src/kho/khoBoNho.ts) là nguồn sự thật để đối chiếu.
--
-- CỔNG CHƯA KIỂM (npm test không chạy file này, không có DB, không có mạng):
--   - Toàn bộ SQL dưới đây: cột, ràng buộc, bảng lịch sử, trigger, hàm, phân quyền từng dòng, quyền cột.
--   - Bản cài src/kho/khoSupabase.ts, khoSupabaseTask.ts, khoSupabaseVongDuyet.ts với các trường mới chạy
--     trên Supabase thật.
--   Cổng chỉ đọc chữ của file này (src/kho/khoSupabaseTaskHoSoNguoi.test.ts). Người duyệt cần đọc kỹ SQL, rồi
--   chạy tay bộ test hợp đồng trên Supabase thật (supabase/README.md, `npx vitest run --config vitest.supabase.config.ts`).
--
-- VIỆC CHỦ DỰ ÁN LÀM TAY (AI không làm, không áp migration lên Supabase thật):
--   1. Áp migration này SAU 20261126000500_truong_du_an.sql (SQL Editor, hoặc `supabase db push`).
--   2. Chạy các mục kiểm tay "Task, hồ sơ và Người trong dự án" trong supabase/README.md.
--
-- Luật phía cơ sở dữ liệu (không tin trình duyệt):
--   - Task có Mức ưu tiên THAP, TRUNG_BINH, CAO; mặc định TRUNG_BINH; Task có sẵn nhận TRUNG_BINH (giá trị mặc
--     định của cột mới, không chạy trigger sửa nên dấu vết của Task giữ nguyên).
--   - Đổi Mức ưu tiên đúng theo quyền sửa Task hiện có: trigger task_truoc_khi_sua (lát 2, lát 4) vẫn chặn mọi
--     lần sửa Task: chỉ PM hoặc Support của Dự án (KHONG_CO_QUYEN), Dự án chưa Lưu trữ (DU_AN_DA_LUU_TRU), Task
--     chưa chốt (TASK_DA_CHOT). Migration này chỉ mở quyền cột muc_uu_tien, không đổi trigger đó.
--   - Mỗi lần đổi sang mức KHÁC, cơ sở dữ liệu ghi đúng một dòng lịch sử (người đổi, lúc, từ, sang) trong cùng
--     giao dịch (trigger AFTER UPDATE). Đổi sang đúng mức đang có: không ghi. Chủ dự án sửa tay (không có
--     người gọi): không ghi, vì không có người đổi.
--   - Hàm lich_su_task trả chung một dòng thời gian cho đổi trạng thái và đổi Mức ưu tiên, kèm cột `loai`.
--   - Hồ sơ có Số điện thoại (dạng đã chuẩn hoá `0` + 9 chữ số hoặc `+84` + 9 chữ số), Chức danh và Phòng ban
--     (đã cắt khoảng trắng, tối đa 60 ký tự); trống là null. Chỉ chính chủ sửa (trigger ho_so_truoc_khi_sua).
--   - Quyền xem Thông tin nhân sự: xem phần 3.
--   - Người trong dự án có Vai trò trong Dự án (đã cắt khoảng trắng, tối đa 60 ký tự; trống là null). Chỉ PM và
--     Support của Dự án sửa (policy mới), Dự án chưa Lưu trữ (trigger). Thêm người kèm vai trò là MỘT lệnh:
--     hàm them_nguoi_vao_du_an nhận thêm tham số vai trò.
--
-- Lỗi nghiệp vụ được ném bằng `raise exception '<MÃ>'` với MÃ là mã lỗi của Kho dữ liệu (src/kho/ketQua.ts).
-- Lỗi ràng buộc (23514) mang tên ràng buộc; bản cài Supabase đổi tên đó về đúng mã lỗi và ô của biểu mẫu như
-- bản bộ nhớ.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. Mức ưu tiên của Task. Cột mới có giá trị mặc định: mọi Task có sẵn nhận TRUNG_BINH ngay khi thêm cột.
-- -------------------------------------------------------------------------------------------------

alter table public.task
  add column muc_uu_tien text not null default 'TRUNG_BINH';

alter table public.task
  -- CAC_MUC_UU_TIEN trong src/luat/mucUuTien.ts.
  add constraint task_muc_uu_tien_hop_le check (muc_uu_tien in ('THAP', 'TRUNG_BINH', 'CAO'));

comment on column public.task.muc_uu_tien is 'Mức ưu tiên: THAP, TRUNG_BINH, CAO. Đổi mức ghi một dòng vào lich_su_muc_uu_tien_task.';

-- Lịch sử đổi Mức ưu tiên: mỗi lần đổi sang mức khác một dòng (Task, người đổi, thời điểm, từ, sang).
create table public.lich_su_muc_uu_tien_task (
  -- Số thứ tự ghi: cùng một thời điểm thì dòng ghi trước đứng trước.
  stt bigint generated always as identity,
  task_id uuid not null,
  nguoi_doi_id uuid not null,
  luc timestamptz not null default now(),
  tu text not null,
  sang text not null,
  constraint lich_su_muc_uu_tien_task_pkey primary key (stt),
  -- Xoá Task (chỉ xảy ra khi xoá cả Dự án ngoài ứng dụng) kéo theo lịch sử của nó.
  constraint lich_su_muc_uu_tien_task_task_id_fkey foreign key (task_id) references public.task (id) on delete cascade,
  -- Như lịch sử trạng thái: không xoá được tài khoản đã từng đổi mức, lịch sử giữ người đổi.
  constraint lich_su_muc_uu_tien_task_nguoi_doi_id_fkey foreign key (nguoi_doi_id) references public.ho_so (id),
  -- Hai mức có thật và khác nhau (đổi sang đúng mức đang có thì không có dòng nào).
  constraint lich_su_muc_uu_tien_hop_le check (
    tu in ('THAP', 'TRUNG_BINH', 'CAO') and sang in ('THAP', 'TRUNG_BINH', 'CAO') and tu <> sang
  )
);

comment on table public.lich_su_muc_uu_tien_task is 'Lịch sử đổi Mức ưu tiên của Task: chỉ thêm, chỉ do trigger task_sau_khi_doi_muc_uu_tien ghi. Đọc theo quyền xem Dự án.';

create index lich_su_muc_uu_tien_task_task_idx on public.lich_su_muc_uu_tien_task (task_id, luc, stt);
create index lich_su_muc_uu_tien_task_nguoi_doi_idx on public.lich_su_muc_uu_tien_task (nguoi_doi_id);

-- Ghi dòng lịch sử sau mỗi lần đổi Mức ưu tiên (cùng giao dịch, cùng now() với lần sửa Task). Trigger
-- task_truoc_khi_sua (BEFORE) đã kiểm quyền, Lưu trữ, Task đã chốt; lần sửa bị từ chối thì không tới đây.
-- Hàm ghi dấu vết khi thêm hay gỡ link (lát 4) chỉ đặt sua_boi nên không làm trigger này chạy.
create function rieng.task_sau_khi_doi_muc_uu_tien() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Chủ dự án sửa tay (không có người gọi): không có người đổi nên không ghi.
  if auth.uid() is not null then
    insert into public.lich_su_muc_uu_tien_task (task_id, nguoi_doi_id, luc, tu, sang)
    values (new.id, auth.uid(), now(), old.muc_uu_tien, new.muc_uu_tien);
  end if;
  return null;
end;
$$;

create trigger task_sau_khi_doi_muc_uu_tien
  after update of muc_uu_tien on public.task
  for each row
  when (old.muc_uu_tien is distinct from new.muc_uu_tien)
  execute function rieng.task_sau_khi_doi_muc_uu_tien();

-- Lịch sử không sửa được (mọi vai, kể cả chủ dự án sửa tay).
create function rieng.lich_su_muc_uu_tien_truoc_khi_sua() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'KHONG_CO_QUYEN' using detail = 'Lịch sử Mức ưu tiên chỉ thêm, không sửa được.';
end;
$$;

create trigger lich_su_muc_uu_tien_truoc_khi_sua
  before update on public.lich_su_muc_uu_tien_task
  for each row execute function rieng.lich_su_muc_uu_tien_truoc_khi_sua();

-- Đọc: ai thấy Dự án của Task thì đọc được (như lịch sử trạng thái). Không có policy ghi, không có quyền ghi.
alter table public.lich_su_muc_uu_tien_task enable row level security;

create policy lich_su_muc_uu_tien_doc on public.lich_su_muc_uu_tien_task
  for select to authenticated
  using (rieng.duoc_xem_task(task_id));

revoke all on table public.lich_su_muc_uu_tien_task from public, anon, authenticated;
grant select on table public.lich_su_muc_uu_tien_task to authenticated;
grant all on table public.lich_su_muc_uu_tien_task to service_role;

-- Quyền cột: client ghi được Mức ưu tiên khi tạo và khi sửa Task. Hàng nào, ai ghi: policy task_tao, task_sua
-- của lát 2 và trigger task_truoc_khi_tao, task_truoc_khi_sua (chỉ PM hoặc Support của Dự án).
grant insert (muc_uu_tien) on table public.task to authenticated;
grant update (muc_uu_tien) on table public.task to authenticated;

-- Lịch sử Task: dòng đổi trạng thái và dòng đổi Mức ưu tiên trên cùng một dòng thời gian, theo thời điểm
-- (cùng thời điểm: dòng trạng thái trước, rồi theo thứ tự ghi), kèm `loai` ('TRANG_THAI' hoặc 'MUC_UU_TIEN')
-- và tên hiển thị hiện tại của người đổi. `stt` là số thứ tự trên dòng thời gian chung đó. Đổi kiểu trả về
-- nên phải bỏ hàm của lát 3 rồi tạo lại (bản xuống tạo lại đúng bản của lát 3).
drop function public.lich_su_task(uuid);

create function public.lich_su_task(p_task_id uuid)
returns table (stt bigint, loai text, nguoi_doi_id uuid, ten_hien_thi text, luc timestamptz, tu text, sang text, ly_do text)
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
    select row_number() over (order by x.luc, x.thu_tu_loai, x.stt_goc) as stt,
           x.loai, x.nguoi_doi_id, h.ten_hien_thi, x.luc, x.tu, x.sang, x.ly_do
    from (
      select l.stt as stt_goc, 'TRANG_THAI'::text as loai, 0 as thu_tu_loai, l.nguoi_doi_id, l.luc, l.tu, l.sang, l.ly_do
      from public.lich_su_trang_thai_task l
      where l.task_id = p_task_id
      union all
      select m.stt, 'MUC_UU_TIEN'::text, 1, m.nguoi_doi_id, m.luc, m.tu, m.sang, null::text
      from public.lich_su_muc_uu_tien_task m
      where m.task_id = p_task_id
    ) x
    join public.ho_so h on h.id = x.nguoi_doi_id
    order by x.luc, x.thu_tu_loai, x.stt_goc;
end;
$$;

-- -------------------------------------------------------------------------------------------------
-- 2. Thông tin nhân sự của hồ sơ.
-- -------------------------------------------------------------------------------------------------

alter table public.ho_so
  add column so_dien_thoai text,
  add column chuc_danh text,
  add column phong_ban text;

alter table public.ho_so
  -- chuanHoaSoDienThoai trong src/luat/thongTinNhanSu.ts: dạng đã chuẩn hoá.
  add constraint ho_so_so_dien_thoai_hop_le check (so_dien_thoai is null or so_dien_thoai ~ '^(0[0-9]{9}|\+84[0-9]{9})$'),
  -- DO_DAI_CHUC_DANH_TOI_DA, DO_DAI_PHONG_BAN_TOI_DA trong src/luat/thongTinNhanSu.ts; trống là null.
  add constraint ho_so_chuc_danh_hop_le check (
    chuc_danh is null or (chuc_danh = btrim(chuc_danh) and char_length(chuc_danh) between 1 and 60)
  ),
  add constraint ho_so_phong_ban_hop_le check (
    phong_ban is null or (phong_ban = btrim(phong_ban) and char_length(phong_ban) between 1 and 60)
  );

comment on column public.ho_so.so_dien_thoai is 'Thông tin nhân sự: dạng đã chuẩn hoá 0xxxxxxxxx hoặc +84xxxxxxxxx. Chỉ chính chủ sửa.';

-- Sửa hồ sơ: thay hàm trigger của lát 1 (giữ nguyên mọi luật cũ). Thêm: ba cột Thông tin nhân sự chỉ chủ hồ
-- sơ sửa được; Số điện thoại bỏ khoảng trắng, dấu chấm, gạch nối; Chức danh, Phòng ban cắt khoảng trắng; trống
-- thành null. Bản xuống trả hàm về đúng bản của lát 1.
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
        or new.github_username is distinct from old.github_username
        or new.so_dien_thoai is distinct from old.so_dien_thoai
        or new.chuc_danh is distinct from old.chuc_danh
        or new.phong_ban is distinct from old.phong_ban)
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

  -- Thông tin nhân sự: chuẩn hoá như luật thuần; ràng buộc của bảng kiểm dạng và độ dài sau bước này.
  new.so_dien_thoai := nullif(regexp_replace(new.so_dien_thoai, '[[:space:].-]', '', 'g'), '');
  new.chuc_danh := nullif(btrim(new.chuc_danh), '');
  new.phong_ban := nullif(btrim(new.phong_ban), '');

  new.sua_luc := now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------------------
-- 3. Quyền xem Thông tin nhân sự (duocXemThongTinNhanSu trong src/luat/thongTinNhanSu.ts): người gọi là chính
--    chủ, là PM, là Support, hoặc cùng ít nhất một Dự án (kể cả Dự án đã Lưu trữ) với người kia.
--
--    CÁCH ÉP (chọn theo cách các migration hiện có cho đọc hồ sơ): ba cột nằm ngay trong bảng ho_so và đi
--    theo phân quyền từng dòng ho_so_doc của lát 1, không thêm view hay quyền cột riêng. Lý do:
--      - ho_so_doc cho đọc một hồ sơ khi: là của mình, người gọi là PM, hoặc rieng.thay_ho_so(id), tức người
--        kia ở trong một Dự án mà người gọi thấy được. Người gọi không phải PM chỉ thấy Dự án mình ở trong (mọi
--        trạng thái), nên "thấy được" nghĩa là CÙNG Dự án (kể cả Lưu trữ). Vậy mọi dòng ho_so client đọc được
--        đều là dòng người gọi đủ quyền xem Thông tin nhân sự: tập dòng đọc được nằm trọn trong luật xem.
--        Support thấy hồ sơ của người cùng Dự án, đúng giả định của spec ("Support xem Thông tin nhân sự của mọi
--        tài khoản mà họ đã xem được tên và email theo quyền hiện có"); không lệnh đọc nào được mở thêm.
--      - Dòng không đủ quyền thì không đọc được cả dòng, nên không có ca nào "thấy tên mà ba trường phải trống"
--        qua bảng. Hàm security definer nào trả hồ sơ (bỏ qua phân quyền từng dòng) phải tự áp
--        rieng.duoc_xem_thong_tin_nhan_su dưới đây và trả null khi không đủ quyền (them_nguoi_vao_du_an ở phần
--        4). Các hàm chỉ trả tên (ten_nguoi_dau_vet, ten_nguoi_cua_task, lich_su_task) không trả ba trường.
--      - Thêm một lớp view hay quyền cột riêng sẽ phải viết lại mọi lần đọc và ghi hồ sơ của bản cài (kể cả
--        đọc lồng hồ sơ trong nguoi_trong_du_an và trả dòng sau khi sửa) mà không chặn thêm dòng nào.
--    NẾU SAU NÀY mở rộng ho_so_doc (cho ai đó đọc hồ sơ của người không cùng Dự án) thì phải đổi cách này: đọc
--    ba trường qua hàm áp rieng.duoc_xem_thong_tin_nhan_su, không đọc thẳng cột.
-- -------------------------------------------------------------------------------------------------

create function rieng.duoc_xem_thong_tin_nhan_su(p_nguoi_dung_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    p_nguoi_dung_id = auth.uid()
    or coalesce(rieng.vai_cua_toi() in ('PM', 'SUPPORT'), false)
    or exists (
      select 1
      from public.nguoi_trong_du_an cua_toi
      join public.nguoi_trong_du_an cua_nguoi_kia on cua_nguoi_kia.du_an_id = cua_toi.du_an_id
      where cua_toi.nguoi_dung_id = auth.uid() and cua_nguoi_kia.nguoi_dung_id = p_nguoi_dung_id
    )
  )
$$;

-- Quyền cột: chủ hồ sơ ghi được ba cột (trigger ho_so_truoc_khi_sua chặn người khác, kể cả PM). Đọc: quyền
-- select trên bảng ho_so của lát 1 và policy ho_so_doc.
grant update (so_dien_thoai, chuc_danh, phong_ban) on table public.ho_so to authenticated;

-- -------------------------------------------------------------------------------------------------
-- 4. Vai trò trong Dự án.
-- -------------------------------------------------------------------------------------------------

alter table public.nguoi_trong_du_an
  add column vai_tro text;

alter table public.nguoi_trong_du_an
  -- DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA trong src/luat/duAn.ts; trống là null.
  add constraint nguoi_trong_du_an_vai_tro_hop_le check (
    vai_tro is null or (vai_tro = btrim(vai_tro) and char_length(vai_tro) between 1 and 60)
  );

comment on column public.nguoi_trong_du_an.vai_tro is 'Vai trò trong Dự án: chữ tự do, tối đa 60 ký tự; không đổi quyền.';

-- Sửa Vai trò trong Dự án: chỉ PM hoặc Support của Dự án (KHONG_CO_QUYEN), Dự án chưa Lưu trữ
-- (DU_AN_DA_LUU_TRU); vai trò chuẩn hoá NFC, cắt khoảng trắng, trống thành null. Chỉ kiểm khi vai trò đổi:
-- khoá ngoại them_boi (on delete set null) cũng cập nhật bảng này khi xoá tài khoản, việc đó không vướng gì.
create function rieng.nguoi_trong_du_an_truoc_khi_sua() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.vai_tro is distinct from old.vai_tro then
    if auth.uid() is not null then
      if not rieng.duoc_quan_ly_du_an(old.du_an_id) then
        raise exception 'KHONG_CO_QUYEN' using detail = 'Chỉ PM hoặc Support của Dự án sửa được Vai trò trong Dự án.';
      end if;
      if not rieng.du_an_dang_hoat_dong(old.du_an_id) then
        raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên không sửa được Vai trò trong Dự án.';
      end if;
    end if;
    new.vai_tro := nullif(btrim(normalize(new.vai_tro, NFC)), '');
  end if;
  return new;
end;
$$;

create trigger nguoi_trong_du_an_truoc_khi_sua
  before update on public.nguoi_trong_du_an
  for each row execute function rieng.nguoi_trong_du_an_truoc_khi_sua();

-- Sửa: PM, hoặc Support của chính Dự án đó (Thành viên, Support ngoài Dự án không đổi được dòng nào).
create policy nguoi_trong_du_an_sua on public.nguoi_trong_du_an
  for update to authenticated
  using (rieng.duoc_quan_ly_du_an(du_an_id))
  with check (rieng.duoc_quan_ly_du_an(du_an_id));

-- Quyền cột: client chỉ ghi được cột vai_tro (không đổi được Dự án, tài khoản, người thêm, ngày thêm).
grant update (vai_tro) on table public.nguoi_trong_du_an to authenticated;

-- Thêm người kèm Vai trò trong Dự án trong MỘT lệnh: thay hàm của lát 1 (thêm tham số p_vai_tro, mặc định
-- null). Thứ tự kiểm như bản bộ nhớ: đăng nhập, quyền, Dự án tồn tại, Lưu trữ, dữ liệu (vai trò), tài khoản
-- đã đăng ký, đã ở trong Dự án. Trả id, email, tên hiển thị, vai, Thông tin nhân sự (đã áp quyền xem) và vai
-- trò của người được thêm. Bỏ bản hai tham số trước để PostgREST không gặp hai hàm cùng tên.
drop function public.them_nguoi_vao_du_an(uuid, text);

create function public.them_nguoi_vao_du_an(p_du_an_id uuid, p_email text, p_vai_tro text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_trang_thai text;
  v_dich public.ho_so;
  v_vai_tro text := nullif(btrim(normalize(coalesce(p_vai_tro, ''), NFC)), '');
  v_xem_nhan_su boolean;
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
  if char_length(v_vai_tro) > 60 then
    raise exception 'KHONG_HOP_LE' using detail = 'Vai trò trong Dự án tối đa 60 ký tự.';
  end if;
  select h.* into v_dich from public.ho_so h where h.email = lower(btrim(coalesce(p_email, '')));
  if not found then
    raise exception 'CHUA_DANG_KY';
  end if;
  insert into public.nguoi_trong_du_an (du_an_id, nguoi_dung_id, vai_tro)
  values (p_du_an_id, v_dich.id, v_vai_tro)
  on conflict do nothing;
  if not found then
    raise exception 'DA_TRONG_DU_AN';
  end if;
  v_xem_nhan_su := rieng.duoc_xem_thong_tin_nhan_su(v_dich.id);
  return jsonb_build_object(
    'id', v_dich.id,
    'email', v_dich.email,
    'ten_hien_thi', v_dich.ten_hien_thi,
    'vai', v_dich.vai,
    'so_dien_thoai', case when v_xem_nhan_su then v_dich.so_dien_thoai end,
    'chuc_danh', case when v_xem_nhan_su then v_dich.chuc_danh end,
    'phong_ban', case when v_xem_nhan_su then v_dich.phong_ban end,
    'vai_tro', v_vai_tro
  );
end;
$$;

-- -------------------------------------------------------------------------------------------------
-- 5. Quyền gọi hàm: hàm hỗ trợ và hàm trigger không ai gọi thẳng; hàm của client chỉ người đã đăng nhập (và
--    service_role).
-- -------------------------------------------------------------------------------------------------

revoke all on function
  rieng.task_sau_khi_doi_muc_uu_tien(),
  rieng.lich_su_muc_uu_tien_truoc_khi_sua(),
  rieng.duoc_xem_thong_tin_nhan_su(uuid),
  rieng.nguoi_trong_du_an_truoc_khi_sua()
  from public, anon, authenticated;

revoke all on function
  public.lich_su_task(uuid),
  public.them_nguoi_vao_du_an(uuid, text, text)
  from public, anon;
grant execute on function
  public.lich_su_task(uuid),
  public.them_nguoi_vao_du_an(uuid, text, text)
  to authenticated, service_role;
