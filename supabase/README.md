# Supabase cho lát 1, lát 2 và lát 4 (ticket 06, 10, 17)

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
`doiNguoiTask`, `danhSachTaskNguoiDangGiu`, `viecCuaToi`, `choToiDuyet`. Repo GitHub và link của Task
xem mục "GitHub trên Supabase" bên dưới (ticket 17).

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

## GitHub trên Supabase và Edge Function đọc GitHub (ticket 17)

Migration `migrations/20261125000400_lat_4_github.sql` (chạy SAU lát 1 và lát 2; bản xuống
`down/20261125000400_lat_4_github.down.sql`, chạy TRƯỚC bản xuống của lát 2) tạo bảng `repo_du_an` và
`lien_ket_task`. Các lệnh của Kho dữ liệu cho bản Supabase (`src/kho/khoSupabaseGitHub.ts`):
`ganRepoVaoDuAn`, `goRepoKhoiDuAn`, `danhSachRepoCuaDuAn`, `themLienKetVaoTask`, `goLienKetKhoiTask`,
`danhSachLienKetCuaTask`. Các lệnh này chỉ ghi và đọc tên repo và link; không gọi GitHub.

Cơ sở dữ liệu ép (không tin trình duyệt):

- **Repo của Dự án**: ai thấy Dự án thì đọc được danh sách (PM thấy mọi Dự án); người ngoài không thấy
  dòng nào. Gắn và gỡ: chỉ PM, hoặc Support của chính Dự án. Dự án Lưu trữ: không gắn, không gỡ. Tên
  `chu-so-huu/ten-repo` (ràng buộc và trigger, cùng định dạng với hàm thuần), không trùng trong Dự án
  không phân biệt hoa thường. Gỡ repo KHÔNG xoá link đã dán.
- **Link của Task**: ai thấy Task thì đọc được. Client không có quyền ghi thẳng bảng; thêm và gỡ chỉ
  qua `them_lien_ket_vao_task` và `go_lien_ket_khoi_task` (security definer): mọi người trong dự án (kể
  cả Thành viên, kể cả Task đã chốt) làm được, trừ Dự án Lưu trữ. Link phải thuộc repo đã gắn, không
  trùng trên Task. Thêm hoặc gỡ link cập nhật người và ngày chỉnh sửa gần nhất của Task trong cùng giao dịch.
- **LƯU Ý GỘP MIGRATION**: để cập nhật dấu vết Task cho cả Thành viên và Task đã chốt, migration lát 4
  `create or replace` lại hàm `rieng.task_truoc_khi_sua` (bản chép nguyên văn của lát 2 cộng đúng một
  nhánh cờ `rieng.dang_ghi_lien_ket`, chỉ đổi dấu vết, mọi cột khác bị đặt lại về giá trị cũ). Nếu một
  migration khác (ví dụ ticket 14) cũng sửa hàm này, phải mang nhánh đó sang bản mới, nếu không Thành
  viên thêm link sẽ nhận `KHONG_CO_QUYEN`. Bản xuống lát 4 trả hàm về bản của lát 2.

Khác bản bộ nhớ (do Supabase quyết): giờ do máy chủ đặt (`bayGio` bị bỏ qua, như Task); danh sách repo
và link đọc tối đa 1000 dòng.

### Edge Function `doc-github` (`functions/doc-github/`)

Đọc trạng thái issue hoặc PR trên GitHub cho người đã đăng nhập, thay cho bản giả của Cổng GitHub.

- `functions/_shared/github.ts`: phần thuần dùng chung (mã lỗi, kiểm tên repo, phân tích link, hàm
  chuyển phản hồi GitHub). **Chỉ một bản**: `src/luat/github.ts` import và export lại; hàm import thẳng.
  Không import gì (Deno không có zod, không tự thêm đuôi `.ts`).
- `functions/doc-github/xuLy.ts`: toàn bộ luật của hàm, không phụ thuộc Deno (cổng đã test bằng đầu vào giả).
- `functions/doc-github/index.ts`: nối với Deno, Supabase Auth, cơ sở dữ liệu và GitHub thật (cổng không kiểm).
- Cổng GitHub phía ứng dụng: `src/github/congGitHubEdge.ts` (gọi `POST {VITE_SUPABASE_URL}/functions/v1/doc-github`
  với mã truy cập của người dùng và khoá công khai; không có token GitHub). `chonKho` đưa cổng này vào
  `App` khi chạy bản Supabase; bản bộ nhớ dùng bản giả. Không có cổng nào được cấu hình thì `App` dùng
  `src/github/congKhongKhaDung.ts`, báo `GITHUB_KHONG_KHA_DUNG` thay vì chết.

Hàm:

- Từ chối người chưa đăng nhập (401). Chưa có secret token: 503 `GITHUB_KHONG_KHA_DUNG`.
- Chỉ đọc repo đã gắn vào một Dự án mà người gọi thấy được: hàm tra bảng `repo_du_an` bằng chính phiên
  của người gọi (không dùng khoá service), nên phân quyền từng dòng quyết định. Repo chưa gắn: `KHONG_TIM_THAY`,
  không gọi GitHub.
- Chỉ `GET https://api.github.com/repos/{chu}/{repo}/(issues|pulls)/{so}`, URL dựng từ (repo, loại, số)
  đã kiểm. Mỗi lần gọi tối đa 25 link, mỗi link một kết quả riêng.
- Trạng thái và mã lỗi (`KHONG_TIM_THAY`, `RIENG_TU`, `HET_LUOT_GOI`, `MAT_MANG`, `DU_LIEU_LA`) giống hệt bản
  giả, qua đúng hàm chuyển đổi chung. Phản hồi và lỗi không bao giờ chứa token hay nội dung lỗi của GitHub, mạng.

Việc chủ dự án làm tay cho phần GitHub (theo thứ tự):

1. **Áp migration lát 4** (sau lát 1, lát 2): SQL Editor hoặc `supabase db push`. Kiểm: Table Editor có
   `repo_du_an` và `lien_ket_task`, cả hai "RLS enabled".
2. **Tạo token GitHub chỉ đọc**: GitHub > Settings > Developer settings > Fine-grained personal access
   tokens. Chọn đúng các repo cần đọc; quyền repository: *Issues: Read-only* và *Pull requests: Read-only*
   (và *Metadata: Read-only*, tự có); không cấp quyền ghi nào. Repo riêng tư mà token không thấy sẽ hiện
   `RIENG_TU`/`KHONG_TIM_THAY`.
3. **Đặt secret** (không bao giờ vào mã, `.env.local` hay biến `VITE_*`):
   `supabase secrets set GITHUB_TOKEN_CHI_DOC=<token>` (kèm `--project-ref <ref>` nếu chưa liên kết).
4. **Triển khai hàm**: `supabase functions deploy doc-github --project-ref <ref>` (giữ kiểm JWT mặc định
   của Supabase; hàm còn tự kiểm đăng nhập lần nữa). Thư mục `functions/_shared/` được đóng gói cùng hàm.
   Hàm cần `SUPABASE_URL` và `SUPABASE_ANON_KEY`, Supabase tự cấp.
5. **Chạy bộ test hợp đồng** (mục "Lệnh chạy bộ test trên Supabase thật"): phần "Repo GitHub của Dự án"
   và "Link issue hoặc PR trên Task" của bản Supabase phải đạt hết.
6. **Kiểm tay** (cổng không kiểm được):
   - Người lạ (Thành viên ngoài Dự án): `select * from repo_du_an` và `lien_ket_task` không thấy dòng nào;
     `insert`/`delete` trên `repo_du_an` bị từ chối hoặc không đụng dòng nào; `insert`, `update`, `delete`
     trực tiếp trên `lien_ket_task` bị từ chối (quyền bảng).
   - Thành viên trong Dự án: không gắn, không gỡ được repo (`KHONG_CO_QUYEN`); gọi `them_lien_ket_vao_task`
     và `go_lien_ket_khoi_task` được, kể cả với Task Hoàn thành hoặc Huỷ; Task đổi `sua_boi`, `sua_luc`.
   - Dự án Lưu trữ: gắn, gỡ repo, thêm, gỡ link đều `DU_AN_DA_LUU_TRU`.
   - Gọi hàm không kèm `Authorization` (hoặc với khoá anon thay cho mã truy cập của người dùng): 401, và
     trong log của hàm không có yêu cầu nào tới GitHub.
   - Gọi hàm bằng phiên của một người, với link thuộc repo CHƯA gắn vào Dự án nào người đó thấy (kể cả
     repo gắn ở Dự án người đó không ở trong): kết quả `KHONG_TIM_THAY`, và GitHub không nhận yêu cầu.
   - Thử với issue và PR thật của một repo đã gắn: issue mở, đóng; PR mở, nháp, đã merge, đóng (kiểm trạng
     thái hiện đúng); số không tồn tại (`KHONG_TIM_THAY`); repo riêng tư token không thấy.
   - Mở trang Task có link trên ứng dụng chạy với Supabase: trạng thái hiện cạnh link, nút làm mới đọc lại;
     tắt secret (`supabase secrets unset GITHUB_TOKEN_CHI_DOC`, hoặc chưa triển khai hàm) thì thông báo
     "Chưa đọc được trạng thái GitHub", phần còn lại của Task vẫn dùng được.
   - Trong tab Network của trình duyệt và trong gói đã dựng (`npm run build`, tìm chuỗi `github_pat_`,
     `ghp_`): không có token GitHub ở đâu.
   - Gỡ secret rồi thử một yêu cầu cố tình gây lỗi: phản hồi không chứa chuỗi của token.

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

Phần GitHub (ticket 17) `npm test` cũng **không kiểm**: file migration `migrations/20261125000400_lat_4_github.sql`
và bản xuống (bảng, ràng buộc, trigger, hàm, phân quyền từng dòng, nhánh cờ mới của trigger Task), các
lệnh repo và link của bản Supabase có gọi mạng (hợp đồng chạy tay), việc Edge Function chạy thật trên Deno
(`functions/doc-github/index.ts`: xác thực bằng Supabase Auth, tra `repo_du_an`, gọi `api.github.com`), việc
đọc secret, và GitHub thật (giới hạn lượt gọi, repo riêng tư, lỗi mạng thật).

Cổng **có kiểm** phần GitHub (`src/github/docGitHubHam.test.ts`, `src/github/congGitHubEdge.test.ts`,
`src/kho/khoSupabaseGitHub.test.ts`): luật của hàm với đầu vào giả (từ chối chưa đăng nhập và repo chưa gắn,
chỉ GET tới `api.github.com`, mã lỗi và trạng thái giống hệt bản giả, không lộ token bằng token giả, thiếu
secret), một bản duy nhất của hàm chuyển đổi, Cổng gọi hàm bằng `fetch` giả, chọn cổng theo cấu hình, lệnh
repo và link chặn ở ranh giới khi chưa đăng nhập, và cấu trúc (đọc chữ) migration lát 4, bản xuống và mã hàm.

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
- Bộ hợp đồng repo (`chayHopDongRepo`) và link (`chayHopDongLienKet`) chạy cho bản Supabase; trong `npm test`
  chúng vẫn "CHƯA KIỂM" (cả file test Supabase bị bỏ qua).
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
