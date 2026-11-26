-- =================================================================================================
-- Trường mới của Dự án (ticket truong-moi 09): Mã Dự án, Khách hàng, Ngày bắt đầu, Ngày kết thúc dự
-- kiến, Mức ưu tiên, Người phụ trách.
-- Chạy SAU lát 1 (supabase/migrations/20261125000100_lat_1_ho_so_du_an.sql), lát 2, lát 3 và lát 4.
-- Migration xuống: supabase/down/20261126000500_truong_du_an.down.sql (chạy TRƯỚC bản xuống của lát 4).
--
-- Đây là bản sao phía cơ sở dữ liệu của luật thuần trong src/luat/duAn.ts và src/luat/mucUuTien.ts (Mã,
-- Khách hàng, ngày của Dự án, Mức ưu tiên, Người phụ trách); hai chỗ phải khớp nhau. Bộ test hợp đồng
-- (src/kho/hopDongMaDuAn.ts, src/kho/hopDongNgayDuAn.ts, src/kho/hopDongUuTienPhuTrach.ts) và bản bộ nhớ là
-- nguồn sự thật để đối chiếu.
--
-- CỔNG CHƯA KIỂM (npm test không chạy file này, không có DB, không có mạng):
--   - Toàn bộ SQL dưới đây: cột, gán mã tạm, ràng buộc, chỉ mục duy nhất, khoá ngoại, trigger, hàm, quyền cột.
--   - Bản cài src/kho/khoSupabase.ts với các trường mới chạy trên Supabase thật.
--   Cổng chỉ đọc chữ của file này (src/kho/khoSupabaseDuAn.test.ts). Người duyệt cần đọc kỹ SQL, rồi chạy
--   tay bộ test hợp đồng trên Supabase thật (supabase/README.md, `npx vitest run --config vitest.supabase.config.ts`).
--
-- VIỆC CHỦ DỰ ÁN LÀM TAY (AI không làm, không áp migration lên Supabase thật):
--   1. Kiểm phiên bản PostgreSQL của project là 15 trở lên (`select version();`): khoá ngoại dưới đây dùng
--      `on delete set null (nguoi_phu_trach_id)`, cú pháp có từ PostgreSQL 15.
--   2. Áp migration này SAU lát 4 (SQL Editor, hoặc `supabase db push`).
--   3. Xem lại mã tạm `DA-001`, `DA-002`… của các Dự án có sẵn và đổi sang mã thật trên ứng dụng.
--   4. Chạy các mục kiểm tay "Trường mới của Dự án" trong supabase/README.md.
--
-- Luật phía cơ sở dữ liệu (không tin trình duyệt):
--   - Dự án có sẵn nhận mã tạm `DA-001`, `DA-002`… theo thứ tự ngày tạo (cùng ngày tạo thì theo id) và Mức
--     ưu tiên Trung bình, TRƯỚC khi Mã thành bắt buộc và duy nhất.
--   - Mã bắt buộc, lưu dạng in hoa đã cắt khoảng trắng (trigger chuẩn hoá), đúng dạng 2 đến 12 ký tự
--     `[A-Z0-9-]`, duy nhất không phân biệt hoa thường (chỉ mục duy nhất trên upper(ma)) → MA_DU_AN_DA_DUNG.
--   - Khách hàng tối đa 120 ký tự, đã cắt khoảng trắng; trống là không có.
--   - Ngày bắt đầu, Ngày kết thúc dự kiến kiểu `date`; Ngày kết thúc dự kiến không trước Ngày bắt đầu khi cả
--     hai cùng có.
--   - Mức ưu tiên THAP, TRUNG_BINH, CAO; mặc định TRUNG_BINH.
--   - Người phụ trách phải là Người trong dự án: trigger ném NGUOI_NGOAI_DU_AN; khoá ngoại tới
--     nguoi_trong_du_an là hàng rào cuối (kể cả hai lệnh chạy cùng lúc) và đặt Người phụ trách về trống
--     trong CÙNG lệnh gỡ người đó khỏi Dự án (hoặc xoá tài khoản). Việc về trống đó không đổi dấu vết.
--   - Dự án mới chưa có ai trong dự án nên chưa có Người phụ trách (trigger đặt về trống).
--   - Chỉ PM và Support của Dự án ghi được các trường này (policy du_an_sua của lát 1 cộng quyền cột mở
--     dưới đây), Dự án chưa Lưu trữ (trigger du_an_truoc_khi_sua mở rộng cho các cột mới). Tạo Dự án: chỉ PM
--     (policy du_an_tao của lát 1). Người phụ trách không được thêm quyền nào.
--
-- Lỗi nghiệp vụ được ném bằng `raise exception '<MÃ>'` với MÃ là mã lỗi của Kho dữ liệu
-- (src/kho/ketQua.ts). Lỗi ràng buộc (23505, 23514, 23503) mang tên ràng buộc; bản cài Supabase đổi tên đó
-- về đúng mã lỗi và ô của biểu mẫu như bản bộ nhớ.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. Cột mới. Mã chưa bắt buộc để gán mã tạm cho Dự án có sẵn ở bước 2.
-- -------------------------------------------------------------------------------------------------

alter table public.du_an
  add column ma text,
  add column khach_hang text not null default '',
  add column ngay_bat_dau date,
  add column ngay_ket_thuc_du_kien date,
  add column muc_uu_tien text not null default 'TRUNG_BINH',
  add column nguoi_phu_trach_id uuid;

comment on column public.du_an.ma is 'Mã Dự án: in hoa, 2-12 ký tự [A-Z0-9-], duy nhất không phân biệt hoa thường.';
comment on column public.du_an.nguoi_phu_trach_id is 'Người phụ trách: phải là Người trong dự án; về trống khi người đó bị gỡ.';

-- -------------------------------------------------------------------------------------------------
-- 2. Gán mã tạm DA-001, DA-002… theo thứ tự ngày tạo và Mức ưu tiên Trung bình cho Dự án có sẵn.
--    Tắt trigger sửa trong lúc gán: Dự án đã Lưu trữ cũng phải nhận mã, và dấu vết chỉnh sửa giữ nguyên.
-- -------------------------------------------------------------------------------------------------

alter table public.du_an disable trigger du_an_truoc_khi_sua;

with thu_tu as (
  select d.id, row_number() over (order by d.tao_luc, d.id) as so
  from public.du_an d
)
update public.du_an d
set ma = 'DA-' || case when t.so < 1000 then lpad(t.so::text, 3, '0') else t.so::text end,
    muc_uu_tien = 'TRUNG_BINH'
from thu_tu t
where t.id = d.id;

alter table public.du_an enable trigger du_an_truoc_khi_sua;

-- -------------------------------------------------------------------------------------------------
-- 3. Ràng buộc. Tên ràng buộc là hợp đồng với src/kho/khoSupabase.ts (đổi lỗi về mã và ô của biểu mẫu).
-- -------------------------------------------------------------------------------------------------

alter table public.du_an
  alter column ma set not null,
  -- Cùng dạng với DANG_MA_DU_AN (sau khi đổi in hoa) trong src/luat/duAn.ts.
  add constraint du_an_ma_hop_le check (ma ~ '^[A-Z0-9-]{2,12}$'),
  -- Cùng giới hạn với DO_DAI_KHACH_HANG_TOI_DA trong src/luat/duAn.ts.
  add constraint du_an_khach_hang_hop_le check (khach_hang = btrim(khach_hang) and char_length(khach_hang) <= 120),
  -- kiemNgayDuAn: Ngày kết thúc dự kiến không trước Ngày bắt đầu khi cả hai cùng có.
  add constraint du_an_ngay_hop_le check (
    ngay_bat_dau is null or ngay_ket_thuc_du_kien is null or ngay_ket_thuc_du_kien >= ngay_bat_dau
  ),
  -- CAC_MUC_UU_TIEN trong src/luat/mucUuTien.ts.
  add constraint du_an_muc_uu_tien_hop_le check (muc_uu_tien in ('THAP', 'TRUNG_BINH', 'CAO')),
  -- Người phụ trách là một cặp (Dự án, tài khoản) có trong nguoi_trong_du_an. Gỡ cặp đó (hay xoá tài
  -- khoản, kéo theo cặp đó) thì chỉ cột Người phụ trách về trống, trong cùng lệnh. Cần PostgreSQL 15+.
  add constraint du_an_nguoi_phu_trach_fkey foreign key (id, nguoi_phu_trach_id)
    references public.nguoi_trong_du_an (du_an_id, nguoi_dung_id)
    on delete set null (nguoi_phu_trach_id);

-- Mã duy nhất không phân biệt hoa thường (kể cả Dự án đã Lưu trữ).
create unique index du_an_ma_key on public.du_an (upper(ma));

-- -------------------------------------------------------------------------------------------------
-- 4. Trigger: thay hai hàm trigger của Dự án ở lát 1 (giữ nguyên mọi luật cũ, thêm phần cho cột mới).
--    Bản xuống trả hai hàm về đúng bản của lát 1.
-- -------------------------------------------------------------------------------------------------

-- Tạo Dự án: người tạo là người gọi, ngày tạo là giờ máy chủ, chưa có phần chỉnh sửa, đang hoạt động.
-- Mã được cắt khoảng trắng và đổi in hoa; chưa có Người phụ trách (chưa có ai trong dự án).
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
  new.ma := upper(btrim(new.ma));
  new.khach_hang := btrim(coalesce(new.khach_hang, ''));
  new.nguoi_phu_trach_id := null;
  return new;
end;
$$;

-- Sửa Dự án: người tạo và ngày tạo giữ nguyên; người và ngày chỉnh sửa do máy chủ đặt.
-- Dự án đã Lưu trữ chỉ được đổi đúng một việc: mở lại (trạng thái sang HOAT_DONG, không đổi gì khác).
-- Người phụ trách mới phải là Người trong dự án (NGUOI_NGOAI_DU_AN).
create or replace function rieng.du_an_truoc_khi_sua() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.id := old.id;
  new.tao_boi := old.tao_boi;
  new.tao_luc := old.tao_luc;

  -- Khoá ngoại du_an_nguoi_phu_trach_fkey đặt Người phụ trách về trống vì người đó vừa bị gỡ khỏi Dự án
  -- (hoặc tài khoản bị xoá): không phải một lần sửa Dự án, nên không đổi dấu vết và không vướng Lưu trữ
  -- (như bản bộ nhớ: gỡ người không đổi dấu vết của Dự án).
  if old.nguoi_phu_trach_id is not null
     and new.nguoi_phu_trach_id is null
     and (new.ten, new.mo_ta, new.trang_thai, new.ma, new.khach_hang, new.ngay_bat_dau,
          new.ngay_ket_thuc_du_kien, new.muc_uu_tien)
         is not distinct from
         (old.ten, old.mo_ta, old.trang_thai, old.ma, old.khach_hang, old.ngay_bat_dau,
          old.ngay_ket_thuc_du_kien, old.muc_uu_tien)
     and not exists (
       select 1 from public.nguoi_trong_du_an n
       where n.du_an_id = old.id and n.nguoi_dung_id = old.nguoi_phu_trach_id
     ) then
    new.sua_boi := old.sua_boi;
    new.sua_luc := old.sua_luc;
    return new;
  end if;

  new.ma := upper(btrim(new.ma));
  new.khach_hang := btrim(coalesce(new.khach_hang, ''));

  if old.trang_thai = 'LUU_TRU'
     and (new.trang_thai = 'LUU_TRU'
          or (new.ten, new.mo_ta, new.ma, new.khach_hang, new.ngay_bat_dau, new.ngay_ket_thuc_du_kien,
              new.muc_uu_tien, new.nguoi_phu_trach_id)
             is distinct from
             (old.ten, old.mo_ta, old.ma, old.khach_hang, old.ngay_bat_dau, old.ngay_ket_thuc_du_kien,
              old.muc_uu_tien, old.nguoi_phu_trach_id)) then
    raise exception 'DU_AN_DA_LUU_TRU' using detail = 'Dự án đã Lưu trữ nên chỉ xem được.';
  end if;

  if new.nguoi_phu_trach_id is not null
     and new.nguoi_phu_trach_id is distinct from old.nguoi_phu_trach_id
     and not exists (
       select 1 from public.nguoi_trong_du_an n
       where n.du_an_id = old.id and n.nguoi_dung_id = new.nguoi_phu_trach_id
     ) then
    raise exception 'NGUOI_NGOAI_DU_AN' using detail = 'Người phụ trách phải là người đang ở trong Dự án.';
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

-- -------------------------------------------------------------------------------------------------
-- 5. Tên hiển thị trong Dự án: thêm Người phụ trách vào những người hàm này trả tên (lát 1 chỉ có người
--    tạo và người chỉnh sửa). Chỉ cho Dự án người gọi thấy được, như cũ.
-- -------------------------------------------------------------------------------------------------

create or replace function public.ten_nguoi_dau_vet(p_ids uuid[]) returns table (id uuid, ten_hien_thi text)
language sql stable security definer set search_path = ''
as $$
  select h.id, h.ten_hien_thi
  from public.ho_so h
  where h.id = any (p_ids)
    and exists (
      select 1 from public.du_an d
      where (d.tao_boi = h.id or d.sua_boi = h.id or d.nguoi_phu_trach_id = h.id)
        and rieng.duoc_xem_du_an(d.id)
    )
$$;

-- -------------------------------------------------------------------------------------------------
-- 6. Quyền cột: client được ghi đúng các cột mới (thêm vào ten, mo_ta của lát 1). Người phụ trách chỉ đặt
--    khi sửa. Trạng thái và dấu vết vẫn không có quyền cột. Hàng (ai, Dự án nào) do policy du_an_tao,
--    du_an_sua của lát 1 quyết: tạo chỉ PM; sửa chỉ PM, Support của Dự án.
-- -------------------------------------------------------------------------------------------------

grant insert (ma, khach_hang, ngay_bat_dau, ngay_ket_thuc_du_kien, muc_uu_tien) on table public.du_an to authenticated;
grant update (ma, khach_hang, ngay_bat_dau, ngay_ket_thuc_du_kien, muc_uu_tien, nguoi_phu_trach_id) on table public.du_an to authenticated;
