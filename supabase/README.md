# Supabase cho lát 1 (ticket 06)

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

## Cổng chưa kiểm (phải kiểm tay)

`npm test` không có mạng, không có DB, nên **không kiểm**:

- File migration `migrations/20261125000100_lat_1_ho_so_du_an.sql` và bản xuống
  `down/20261125000100_lat_1_ho_so_du_an.down.sql`: bảng, ràng buộc, trigger, hàm.
- Phân quyền từng dòng (RLS) và quyền cột.
- Supabase Auth thật: đăng ký, xác nhận email, đăng nhập, đặt lại mật khẩu, thư gửi đi và mẫu thư.
- Mọi lệnh của bản Supabase có gọi mạng.

Cổng **có kiểm** (`src/kho/cauHinh.test.ts`): chọn bản cài theo cấu hình, từ chối khoá service
(bằng khoá giả), các lệnh của bản Supabase bị chặn ở ranh giới mà không gọi mạng, và bộ test trên
Supabase thật tự bỏ qua đúng (báo "CHƯA KIỂM", không báo đạt).

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
- `khoChuaCoPM: false`: Supabase thật đã có PM, nên hai ca "PM cuối cùng" bị bỏ qua; kiểm tay
  bằng SQL Editor trên project chỉ có một PM: `update ho_so set vai = 'SUPPORT' where vai = 'PM'`
  phải lỗi `PHAI_CON_PM`.
- Mã đặt lại trong bộ test lấy bằng API quản trị (`generateLink`), không đọc hộp thư; nội dung thư
  thật (có mã) phải kiểm tay bằng một lần "Quên mật khẩu?" trên ứng dụng.

Khác biệt còn lại, chưa kiểm được và không có trong bộ test: đăng ký lại một email đã đăng ký
nhưng **chưa xác nhận** thì Supabase gửi lại thư xác nhận thay vì báo "Email này đã được dùng".
Phiên đăng nhập chỉ giữ trong bộ nhớ của trang: tải lại trang thì phải đăng nhập lại.
