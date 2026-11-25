# Supabase cho lát 1, lát 2 và vòng duyệt (ticket 06, 10, 14)

Bản cài Supabase của Kho dữ liệu: `src/kho/khoSupabase.ts`. Ứng dụng chọn bản cài theo biến môi
trường (`src/kho/cauHinh.ts`, `src/kho/chonKho.ts`):

| Biến | Ý nghĩa |
|---|---|
| `VITE_SUPABASE_URL` | Địa chỉ project Supabase |
| `VITE_SUPABASE_ANON_KEY` | Khoá **công khai** (anon hoặc `sb_publishable_...`) |

- Bỏ trống cả hai khi chạy thử (`npm run dev`): bản bộ nhớ, chỉ để dev.
- Bản dựng production thiếu cấu hình: ứng dụng hiện lỗi, không lặng lẽ dùng bản bộ nhớ.
- Bất kỳ biến `VITE_*` nào chứa khoá service (`service_role`, `sb_secret_...`): ứng dụng từ chối
  chạy. Khoá service không bao giờ được xuống trình duyệt.

## Task trên Supabase (ticket 10)

Migration `migrations/20261125000200_lat_2_task.sql` (chạy SAU lát 1; bản xuống
`down/20261125000200_lat_2_task.down.sql`, chạy TRƯỚC bản xuống của lát 1) tạo bảng `task` và cài
phía cơ sở dữ liệu cùng bộ luật với `src/luat/task.ts`. Các lệnh Task của Kho dữ liệu cho bản
Supabase (`src/kho/khoSupabaseTask.ts`): `taoTask`, `danhSachTask`, `layTask`, `suaTask`,
`doiNguoiTask`, `danhSachTaskNguoiDangGiu`, `viecCuaToi`, `choToiDuyet`. Lệnh repo GitHub vẫn chưa có
(ticket 17).

Cơ sở dữ liệu ép (không tin trình duyệt):

- **Đọc**: ai thấy Dự án thì thấy mọi Task của nó (PM thấy mọi Dự án). Người ngoài Dự án không thấy dòng nào.
- **Ghi** (tạo, sửa, đổi người): chỉ PM hoặc Support của chính Dự án. Thành viên (kể cả Người thực
  hiện, Người kiểm tra) không ghi được. Không có quyền xoá Task.
- **Người**: Người thực hiện và Người kiểm tra bắt buộc, khác nhau, người được chọn phải đang ở
  trong Dự án (kiểm lúc tạo và lúc đổi người, chỉ với người mới được chọn; gỡ người khỏi Dự án
  không đổi Task, người cũ hiện "đã rời dự án" cho đến khi được giao lại).
- **Tiêu đề** 1 đến 200 ký tự, không chỉ khoảng trắng. **Hạn** kiểu `date` (một ngày, không giờ).
- **Dự án Lưu trữ**: không tạo, không sửa Task. **Task Hoàn thành hoặc Huỷ**: không sửa, không đổi người.
- **Dấu vết** do trigger đặt theo `auth.uid()` và `now()`: client không gửi được, cũng không có quyền cột.
- **Trạng thái và số lần bị Trả lại**: Task mới luôn là Mới, 0 lần Trả lại. Client không có quyền
  cột trên hai cột này và trigger chặn thêm một lớp; chúng chỉ đổi qua hàm chuyển trạng thái của
  **ticket 14**. Hợp đồng cho hàm đó (đã ghi ở đầu file migration): `security definer`, tự kiểm
  ma trận và quyền, rồi gọi `perform set_config('rieng.dang_chuyen_trang_thai', 'co', true)` trước khi
  update hai cột; trigger thấy cờ thì cho đổi, vẫn chặn Dự án Lưu trữ và Task đã chốt, vẫn đặt dấu vết.
- **Không có `auth.uid()`** (chủ dự án sửa tay trong SQL Editor, hoặc khoá service như bộ test dùng
  để dựng Task ở trạng thái bất kỳ): được đổi trạng thái thẳng, dấu vết giữ nguyên, không bị khoá
  Task đã chốt hay Dự án Lưu trữ; vẫn không đổi được mã, Dự án, người tạo, ngày tạo và vẫn phải
  qua kiểm tra người.
- Xoá tài khoản còn giữ Task bị chặn (khoá ngoại `on delete restrict`): giao lại Task trước.

Khác bản bộ nhớ (do Supabase quyết):

- Giờ do máy chủ đặt: `bayGio` bị bỏ qua (như phần Dự án). Mã Task là uuid.
- Tên hiển thị của người ghi trên Task đọc qua hàm `ten_nguoi_cua_task` (chỉ cho Task của Dự án người
  gọi thấy), vì người đã rời Dự án hay PM ngoài Dự án có thể không đọc thẳng được hồ sơ.
- Danh sách Task đọc từng trang 500 dòng: máy chủ PostgREST phải cho ít nhất 500 dòng một lần gọi
  (mặc định của Supabase là 1000; đừng hạ *Max rows* dưới 500).
- Hai người dùng sửa cùng lúc: bản cài đọc rồi mới ghi, nên nếu Task vừa bị chốt giữa hai bước thì
  trigger ném `TASK_DA_CHOT` (đã ánh xạ về mã của Kho); cửa sổ này rất nhỏ, không có khoá lạc quan.

## Vòng duyệt trên Supabase (ticket 14)

Migration `migrations/20261125000300_lat_3_vong_duyet.sql` (chạy SAU lát 2; bản xuống
`down/20261125000300_lat_3_vong_duyet.down.sql`, chạy TRƯỚC bản xuống của lát 2) tạo bảng
`lich_su_trang_thai_task`, hàm `public.doi_trang_thai_task` và `public.lich_su_task`, và cài phía cơ sở
dữ liệu cùng bộ luật với `src/luat/chuyenTrangThai.ts`. Lệnh của Kho cho bản Supabase:
`src/kho/khoSupabaseVongDuyet.ts` (`doiTrangThaiTask`, `lichSuTask`).

Cơ sở dữ liệu ép (không tin trình duyệt):

- **Đổi trạng thái chỉ qua `doi_trang_thai_task(p_task_id, p_sang, p_ly_do)`**: `security definer`, người
  gọi lấy từ `auth.uid()` (không có tham số người gọi). Hàm tự kiểm đúng thứ tự của luật thuần
  (`kiemChuyenTrangThai`): không giữ vai nào (`KHONG_CO_QUYEN`), Dự án Lưu trữ (`DU_AN_DA_LUU_TRU`), Task
  đã chốt (`TASK_DA_CHOT`), dữ liệu sai (`KHONG_HOP_LE`), bước ngoài ma trận (`BUOC_KHONG_HOP_LE`), vai
  không được làm bước (`KHONG_CO_QUYEN`), thiếu lý do (`LY_DO_BAT_BUOC`). Task không tồn tại: PM nhận
  `KHONG_TIM_THAY`, người khác `KHONG_CO_QUYEN`. Qua hết mới bật cờ giao dịch
  `rieng.dang_chuyen_trang_thai` (hợp đồng của ticket 10), đổi trạng thái, tăng bộ đếm Trả lại (đúng 1 khi
  sang Trả lại), tắt cờ, rồi ghi đúng một dòng lịch sử, tất cả một giao dịch; trigger của lát 2 đặt
  người và ngày chỉnh sửa gần nhất theo `auth.uid()` và `now()`. Khoá dòng Task (`for update`) nên hai lần
  đổi cùng lúc xếp hàng.
- **Ma trận** nằm trong SQL ở dạng dữ liệu (`rieng.ma_tran_chuyen_trang_thai()`, 12 bước), và bảng lịch
  sử có ràng buộc chỉ nhận bước nằm trong ma trận, Trả lại, Bị lỗi, Huỷ bắt buộc có lý do.
- **Lịch sử**: ai thấy Dự án của Task thì đọc được (RLS `lich_su_doc`; Kho đọc qua `lich_su_task`, hàm này
  còn trả tên hiển thị hiện tại của người đổi, kể cả người đã rời Dự án). Client không có policy ghi và
  không có quyền bảng; trigger chặn sửa. Xoá tài khoản đã từng đổi trạng thái bị chặn (khoá ngoại), như
  người tạo Task.
- **Tiến độ và Trễ hạn**: KHÔNG viết lại luật bằng SQL. Hai thứ này tính bằng hàm thuần của ticket 13 trên
  danh sách Task mà `danhSachTask` đọc (đủ trạng thái và hạn, đọc hết các trang). Migration chỉ thêm hai
  chỉ mục (`task_du_an_trang_thai_idx`, `task_han_chua_chot_idx`) cho các truy vấn đó.

Khác bản bộ nhớ (do Supabase quyết): thời điểm của dòng lịch sử và ngày chỉnh sửa là giờ máy chủ, `bayGio`
bị bỏ qua (bộ test chạy với `dongHoCuaKho`; ca "lịch sử xếp theo thời điểm truyền vào" bị bỏ qua). Giới hạn
lý do 1000 ký tự tính theo ký tự Unicode ở cơ sở dữ liệu, theo đơn vị UTF-16 ở luật thuần: chỉ khác nhau
với ký tự ngoài bảng chữ cơ bản (emoji), nên cơ sở dữ liệu có thể nhận lý do mà luật thuần đã từ chối, không
ngược lại.

Cổng **có kiểm** (`src/kho/khoSupabaseVongDuyet.test.ts`, không mạng, không DB): với một `fetch` giả trong bộ
nhớ, luật thuần từ chối trước khi gọi hàm (không ghi gì), lý do được cắt khoảng trắng, lỗi hàm ném được đổi
về đúng mã của Kho, lịch sử được xếp lại đúng; và cấu trúc file migration bằng cách đọc chữ: ma trận trong
SQL giống hệt `MA_TRAN_CHUYEN_TRANG_THAI`, mọi mã lỗi hàm ném là mã của Kho, hàm không nhận người gọi qua
tham số, cờ giao dịch chỉ bật sau mọi lệnh kiểm, bảng lịch sử không mở quyền ghi cho client, bản xuống bỏ
đủ đối tượng. `fetch` giả KHÔNG mô phỏng SQL, nên không thay cho việc chạy trên Supabase thật.

**Cổng không kiểm** (chủ dự án phải chạy tay): toàn bộ SQL của lát 3 (hàm, bảng, ràng buộc, trigger, RLS);
bộ test hợp đồng và bảng ca chuyển trạng thái (`src/kho/hopDongChuyenTrangThai.ts`, mọi dòng của
`BANG_CA_CHUYEN_TRANG_THAI`) trên Supabase thật; các mục kiểm tay dưới đây.

Việc chủ dự án làm tay: áp migration lát 3 (sau lát 2) trong SQL Editor hoặc `supabase db push`
(Table Editor có thêm bảng `lich_su_trang_thai_task`, hiện "RLS enabled"), rồi chạy
`npx vitest run --config vitest.supabase.config.ts` (phần "vòng duyệt" của lệnh này không còn bị bỏ qua) và
kiểm tay (giả người gọi như mục "Giả người gọi trong SQL Editor"):

- Gọi `select public.doi_trang_thai_task('<uuid Task>', 'DANG_LAM')` bằng phiên của: Người thực hiện (được),
  Người kiểm tra (`KHONG_CO_QUYEN`), Thành viên khác trong Dự án (`KHONG_CO_QUYEN`), người ngoài Dự án
  (`KHONG_CO_QUYEN`), PM ngoài Dự án (được). Task không tồn tại: PM `KHONG_TIM_THAY`, người khác `KHONG_CO_QUYEN`.
- Từ `CHO_DUYET`: sang `TRA_LAI` hay `BI_LOI` không lý do (hoặc chỉ khoảng trắng) lỗi `LY_DO_BAT_BUOC`; có lý
  do thì `trang_thai` đổi, `so_lan_tra_lai` tăng 1 chỉ ở `TRA_LAI`, `sua_boi` là người gọi, `sua_luc` là giờ
  máy chủ, và `lich_su_trang_thai_task` có đúng một dòng mới (người đổi, từ, sang, lý do đã cắt khoảng trắng).
- Một lần bị từ chối (mọi mã lỗi) không đổi gì: `trang_thai`, `so_lan_tra_lai`, `sua_boi`, `sua_luc` và số
  dòng lịch sử giữ nguyên.
- Task `HOAN_THANH` hoặc `HUY`: mọi bước `TASK_DA_CHOT`. Dự án Lưu trữ: `DU_AN_DA_LUU_TRU`. Trạng thái đích
  `'KHAC'`: `KHONG_HOP_LE`. Bước ngoài ma trận (vd. `MOI` sang `HOAN_THANH`): `BUOC_KHONG_HOP_LE`.
- Không ghi thẳng được: `update task set trang_thai = ...` bằng phiên PM lỗi quyền cột;
  `insert/update/delete` trên `lich_su_trang_thai_task` bằng phiên bất kỳ lỗi quyền (không có quyền bảng);
  `select * from lich_su_trang_thai_task` bằng phiên người ngoài Dự án không thấy dòng nào của Dự án đó.
- Gọi hàm khi chưa đăng nhập (khoá anon, không phiên): bị từ chối (không có quyền thực thi).
- Hai phiên cùng đổi một Task cùng lúc (vd. cùng bấm `DANG_LAM`): đúng một phiên thành công, phiên kia nhận
  `BUOC_KHONG_HOP_LE`; lịch sử có đúng một dòng.
- Thử chạy bản xuống lát 3 trên project thử: Task giữ nguyên, bảng lịch sử biến mất, hai chỉ mục biến mất.

## Cổng chưa kiểm (phải kiểm tay)

`npm test` không có mạng, không có DB, nên **không kiểm**:

- File migration `migrations/20261125000100_lat_1_ho_so_du_an.sql` và
  `migrations/20261125000200_lat_2_task.sql`, cùng hai bản xuống trong `down/`: bảng, ràng buộc,
  trigger, hàm. Cổng chỉ kiểm cấu trúc file lát 2 bằng cách đọc chữ (`src/kho/khoSupabaseTask.test.ts`:
  có bật RLS, không mở quyền cột trạng thái cho client, bản xuống bỏ đủ đối tượng), không chạy SQL.
- Phân quyền từng dòng (RLS) và quyền cột, kể cả của bảng `task`.
- Mọi lệnh Task của bản Supabase có gọi mạng (bộ test hợp đồng và bảng ca phần Task: chỉ chạy bằng
  lệnh riêng ở mục cuối; trong `npm test` mang tên "CHƯA KIỂM").
- Supabase Auth thật: đăng ký, xác nhận email, đăng nhập, đặt lại mật khẩu, thư gửi đi và mẫu thư.
- Mọi lệnh của bản Supabase có gọi mạng.

Cổng **có kiểm** (`src/kho/cauHinh.test.ts`, `src/kho/khoSupabaseTask.test.ts`): chọn bản cài theo
cấu hình, từ chối khoá service (bằng khoá giả), các lệnh của bản Supabase (kể cả mọi lệnh Task) bị
chặn ở ranh giới mà không gọi mạng, bộ test trên Supabase thật tự bỏ qua đúng (báo "CHƯA KIỂM",
không báo đạt), và cấu trúc file migration lát 2 như nói ở trên.

Người duyệt: đọc kỹ SQL, rồi chạy tay bộ test hợp đồng và bảng ca dùng chung trên Supabase thật
(mục cuối).

## Việc chủ dự án làm tay (theo thứ tự)

1. **Tạo project** Supabase (nên có thêm một project riêng cho test, hoặc dùng `supabase start`).
2. **Bật đăng ký email kèm xác nhận**: Authentication > Providers > Email: bật *Enable Email
   provider* và *Confirm email*. Đặt *Site URL* là địa chỉ của ứng dụng.
3. **Mẫu thư đặt lại mật khẩu có mã**: Authentication > Email Templates > *Reset Password*, dán nội
   dung `templates/dat-lai-mat-khau.html` (thư phải có `{{ .Token }}`; ứng dụng hỏi mã, không dùng
   đường dẫn). Thời hạn mã: Authentication > Providers > Email > *Email OTP Expiration* (mặc định
   3600 giây).
4. **Áp migration** `migrations/20261125000100_lat_1_ho_so_du_an.sql`: dán vào SQL Editor và chạy,
   hoặc `supabase db push` / `supabase migration up`. Kiểm: Table Editor có ba bảng `ho_so`,
   `du_an`, `nguoi_trong_du_an`, cả ba hiện "RLS enabled".
   Gỡ lại (xoá hết dữ liệu lát 1): chạy `down/20261125000100_lat_1_ho_so_du_an.down.sql`.
4b. **Áp migration lát 2** `migrations/20261125000200_lat_2_task.sql` (sau lát 1): dán vào SQL Editor
   và chạy, hoặc `supabase db push`. Kiểm: Table Editor có thêm bảng `task`, hiện "RLS enabled".
   Gỡ lại (xoá hết Task): `down/20261125000200_lat_2_task.down.sql`; nếu cần gỡ cả lát 1 thì chạy
   bản xuống lát 2 TRƯỚC.
5. **Đặt PM đầu tiên** (một lần, sau khi tự đăng ký và xác nhận email trên ứng dụng), trong SQL
   Editor:

   ```sql
   update public.ho_so set vai = 'PM' where email = lower('email-cua-ban@vi-du.vn');
   select email, vai from public.ho_so where vai = 'PM';
   ```

   Không có luật "người đầu tiên thành PM". Từ đó chỉ PM đổi được vai trên màn Người dùng, và cơ sở
   dữ liệu không cho hạ hay xoá PM cuối cùng (kể cả trong SQL Editor).
6. **Cấu hình ứng dụng**: chép `.env.example` thành `.env.local`, điền `VITE_SUPABASE_URL` và
   `VITE_SUPABASE_ANON_KEY` (Project Settings > API). Không bao giờ điền khoá service vào biến
   `VITE_*`.
7. **Chạy bộ test hợp đồng và bảng ca dùng chung trên Supabase thật** (mục dưới) và kiểm tay:
   - Người lạ vừa đăng ký không đọc được Dự án hay hồ sơ của ai ngoài hồ sơ của mình (thử
     `select * from ho_so` / `du_an` bằng khoá anon và phiên của người đó: chỉ thấy một dòng / không
     dòng nào).
   - Thành viên không sửa được Dự án, không tự nâng vai (`update ho_so set vai = 'PM' where id = auth.uid()`
     bằng phiên của họ phải lỗi `KHONG_CO_QUYEN`).
   - Không ghi thẳng được cột trạng thái của Dự án (`update du_an set trang_thai = ...` lỗi quyền
     cột); chỉ đổi qua `luu_tru_du_an` / `mo_lai_du_an`.
   - **Task** (lát 2), mỗi mục thử trực tiếp bằng REST/SQL (bỏ qua Kho) với phiên của đúng người đó
     (cách giả phiên trong SQL Editor: mục "Giả người gọi trong SQL Editor" bên dưới):
     - Người ngoài Dự án: `select * from task` không thấy dòng nào của Dự án đó; `insert` và `update`
       đều bị từ chối hoặc không đụng dòng nào.
     - Thành viên trong Dự án (kể cả Người thực hiện hay Người kiểm tra của Task): `insert` lỗi
       `KHONG_CO_QUYEN`, `update task set tieu_de = ...` không đổi dòng nào.
     - Support ở Dự án khác (hoặc không ở Dự án nào): không tạo, không sửa Task của Dự án này.
     - PM hoặc Support của Dự án đổi `trang_thai` hoặc `so_lan_tra_lai` trực tiếp: lỗi quyền cột
       (`permission denied`). Gửi kèm `tao_boi`, `tao_luc`, `sua_boi`, `sua_luc` hay `id` khi tạo: cũng
       lỗi quyền cột (client không có quyền cột này); dấu vết luôn là người gọi và giờ máy chủ.
     - Tạo Task với `nguoi_kiem_tra_id` = `nguoi_thuc_hien_id`: `TRUNG_NGUOI`. Chọn người không ở
       trong Dự án (hoặc không tồn tại ở bảng `ho_so`): `NGUOI_NGOAI_DU_AN`. Bỏ trống một người: `THIEU_NGUOI`.
     - Tiêu đề rỗng, chỉ khoảng trắng hay quá 200 ký tự: lỗi ràng buộc `task_tieu_de_hop_le`.
     - Task Hoàn thành hoặc Huỷ (dựng bằng SQL Editor: `update task set trang_thai = 'HOAN_THANH' where id = ...`):
       `update` bằng phiên PM lỗi `TASK_DA_CHOT`. Dự án Lưu trữ: tạo hay sửa Task lỗi `DU_AN_DA_LUU_TRU`.
     - Gỡ một Người thực hiện khỏi Dự án: Task của họ giữ nguyên (họ vẫn là Người thực hiện); giao lại
       cho người trong Dự án thì được, giao cho người đã gỡ thì `NGUOI_NGOAI_DU_AN`.
     - `delete from task` bằng phiên bất kỳ: bị từ chối (không có quyền xoá).
     - Không có đường nào để client tự bật cờ `rieng.dang_chuyen_trang_thai`: gọi
       `/rest/v1/rpc/set_config` phải ra 404, và hàm `rieng.*` không mở cho `authenticated`.

## Giả người gọi trong SQL Editor (để thử Task bằng tay)

SQL Editor chạy bằng vai `postgres` (bỏ qua phân quyền từng dòng). Muốn thử như một người dùng cụ
thể, trong MỘT lần chạy:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<uuid của người đó, lấy ở ho_so.id>","role":"authenticated"}', true);
-- Các lệnh thử, ví dụ:
select * from public.task;
update public.task set trang_thai = 'HOAN_THANH' where id = '<uuid Task>';  -- phải lỗi quyền cột
rollback;
```

## Lệnh chạy bộ test trên Supabase thật

```sh
npx vitest run --config vitest.supabase.config.ts
```

Lệnh này **không** nằm trong `npm test`. Nó đọc biến từ môi trường hoặc `.env.test.local`:

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `SUPABASE_TEST_URL` | có | Địa chỉ project test |
| `SUPABASE_TEST_ANON_KEY` | có | Khoá công khai của project test |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | có | Khoá service, chỉ để bộ test xác nhận email, lấy mã đặt lại và đặt PM thay chủ dự án; không có tiền tố `VITE_` nên không vào bản dựng |
| `SUPABASE_TEST_EMAIL_DOMAIN` | không | Tên miền email test, mặc định `example.com` |
| `SUPABASE_TEST_THOI_HAN_MA_GIAY` | không | Thời hạn mã đặt lại đã cấu hình, mặc định 3600 |

Thiếu hay sai cấu hình thì lệnh **thất bại** với lý do bắt đầu bằng "CHƯA KIỂM", không bao giờ
báo đạt. Trong `npm test`, bộ này luôn bị bỏ qua với cùng chữ "CHƯA KIỂM".

Chuẩn bị project test:

- Dùng project **riêng** cho test (hoặc `supabase start` trên máy): bộ test tạo vài trăm tài khoản
  và đặt vai PM cho nhiều tài khoản, không dọn đi được.
- Nâng giới hạn của Auth (Authentication > Rate Limits; với `supabase start` là mục
  `[auth.rate_limit]` trong `supabase/config.toml`): số thư gửi mỗi giờ và số lần đăng ký/đăng nhập
  phải đủ cho vài trăm lần; khoảng cách tối thiểu giữa hai thư cho cùng email nên để ngắn (1 giây).
  Thiếu thì các ca thất bại với `LOI_HE_THONG` ("quá nhiều yêu cầu").
- Thư thật được gửi tới `<tên>.<mã>-<số>@<SUPABASE_TEST_EMAIL_DOMAIN>`; dùng Supabase chạy trên máy
  (thư rơi vào hộp thư giả của CLI) để không gửi thư ra ngoài.

Bộ test chạy với các tuỳ chọn sau (`src/kho/hopDongSupabase.ts`), vì Supabase khác bản bộ nhớ ở
mấy chỗ đã biết:

- `dongHoCuaKho`: ngày tạo, ngày chỉnh sửa và hạn mã do máy chủ đặt, tham số `bayGio` bị bỏ qua.
  Ca "mã hết hạn theo đồng hồ truyền vào" bị bỏ qua; kiểm tay: đặt *Email OTP Expiration* ngắn
  (vd. 60 giây), chờ quá hạn rồi nhập mã, phải bị từ chối.
- `gopLoiMaDatLai`: Supabase Auth trả cùng một lỗi cho mã sai, đã dùng hay hết hạn, nên Kho trả
  `MA_KHONG_HOP_LE` với thông báo gộp cho cả ba.
- `coTask` và `coDatTrangThaiTask` bật: các ca Task và dòng Task của bảng ca chạy (Task ở trạng
  thái bất kỳ được dựng bằng khoá service đổi cột `trang_thai`, như chủ dự án sửa tay). Đây là phần
  quan trọng nhất của lát 2 phải chạy tay và đạt hết.
- `khoChuaCoPM: false`: Supabase thật đã có PM, nên hai ca "PM cuối cùng" bị bỏ qua; kiểm tay
  bằng SQL Editor trên project chỉ có một PM: `update ho_so set vai = 'SUPPORT' where vai = 'PM'`
  phải lỗi `PHAI_CON_PM`.
- Mã đặt lại trong bộ test lấy bằng API quản trị (`generateLink`), không đọc hộp thư; nội dung thư
  thật (có mã) phải kiểm tay bằng một lần "Quên mật khẩu?" trên ứng dụng.

Khác biệt còn lại, chưa kiểm được và không có trong bộ test: đăng ký lại một email đã đăng ký
nhưng **chưa xác nhận** thì Supabase gửi lại thư xác nhận thay vì báo "Email này đã được dùng".
Phiên đăng nhập chỉ giữ trong bộ nhớ của trang: tải lại trang thì phải đăng nhập lại.
