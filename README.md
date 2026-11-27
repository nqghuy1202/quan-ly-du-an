# Quản lý dự án

Web nhiều người dùng, hoàn toàn bằng tiếng Việt, để **PM** và **Support** quản lý Dự án, Task và vòng
duyệt. Ai cũng có tài khoản. PM tạo Dự án và thêm người vào. PM hoặc Support chia Task cho một Người
thực hiện và một Người kiểm tra. Task đi qua một vòng trạng thái rõ ràng, và mọi lần đổi trạng thái đều
lưu lại ai, lúc nào, vì sao. Mỗi Dự án gắn được repo GitHub, mỗi Task dán được link issue hoặc PR để hiện
trạng thái hiện tại; phần GitHub **chỉ đọc**, hệ thống không bao giờ ghi lên GitHub.

Từ vựng dùng xuyên suốt nằm ở [`GLOSSARY.md`](GLOSSARY.md) (bảng rút gọn ở cuối tài liệu này). Hành vi
chuẩn nằm ở `.scratch/quan-ly-du-an/spec.md`, cùng phần mở rộng về bố cục và trường mới ở
`.scratch/bo-cuc-va-truong-moi/spec.md`; spec là nguồn sự thật khi tài liệu và mã lệch nhau.

## Ba vai

Mỗi tài khoản có đúng một vai hệ thống. Người mới tự đăng ký luôn là **Thành viên**.

| Vai | Làm được |
|---|---|
| **PM** | Tạo Dự án; thấy mọi Dự án; nâng một tài khoản lên Support hoặc PM, hoặc hạ về Thành viên (hệ thống luôn giữ ít nhất một PM); làm mọi bước hợp lệ ở mọi Dự án |
| **Support** | Quản lý các Dự án mình được thêm vào: sửa Dự án (kể cả Mã Dự án, Người phụ trách, Mức ưu tiên), thêm và gỡ người, sửa Vai trò trong Dự án, tạo và sửa Task (kể cả Mức ưu tiên), đổi Người thực hiện hoặc Người kiểm tra, gắn repo GitHub, Lưu trữ; làm mọi bước chuyển trạng thái hợp lệ thay người khác. Không đổi vai hệ thống của ai, không sửa hộ Thông tin nhân sự |
| **Thành viên** | Chỉ thấy các Dự án mình được thêm vào và mọi Task của các Dự án đó. Làm theo vai trên từng Task: Người thực hiện chuyển Task sang Đang làm và Chờ duyệt; Người kiểm tra quyết định Hoàn thành, Trả lại hoặc Bị lỗi. Không đổi Mức ưu tiên hay Vai trò trong Dự án; được ghi là Người phụ trách cũng không có thêm quyền |

Người vừa đăng ký chưa ở trong Dự án nào thấy một màn trống nói rõ việc cần làm tiếp: nhờ PM hoặc
Support thêm mình vào.

## Các màn chính

Điều hướng chính là **Thanh bên** bên trái (màn hẹp thu thành nút mở trình đơn), chia nhóm Tổng quan, Công việc, Dự án, Quản trị; tên, vai, Hồ sơ và Đăng xuất gom ở chân Thanh bên. Đăng nhập xong vào thẳng Tổng quan. Xem Task, tạo Task, tạo và sửa Dự án đều mở trong **Ngăn trượt** bên phải; đóng ngăn (nút đóng hoặc Esc) là về đúng trang, đúng tab, đúng bộ lọc cũ.

| Màn | Ai thấy | Nội dung |
|---|---|---|
| Đăng ký, Đăng nhập, Quên mật khẩu | Mọi người | Đăng ký bằng email, mật khẩu và tên hiển thị; xác nhận email; đặt lại mật khẩu bằng mã gửi qua email |
| Tổng quan | Mọi người đã đăng nhập | Trang tổng quan mở đầu: ô số (Dự án đang hoạt động, Dự án Quá hạn dự kiến, Task đang mở, Task Trễ hạn, Chờ tôi duyệt, Việc của tôi), bảng Dự án đang hoạt động kèm **Tiến độ** và số Task **Trễ hạn**, danh sách Task Trễ hạn và Task tới hạn trong 7 ngày, phân bố Task theo trạng thái. Chỉ tính Dự án mình được xem; Dự án Lưu trữ không tính. Dự án chưa có Task nào đáng tính hiện "chưa có task" thay vì 0% |
| Dự án của tôi | Mọi người đã đăng nhập | Các Dự án mình ở trong, cột Mã, Tên, Khách hàng, Người phụ trách, Mức ưu tiên, Ngày kết thúc dự kiến, Tiến độ, Trễ hạn; tìm theo tên hoặc Mã Dự án, lọc theo Mức ưu tiên, Người phụ trách, tình trạng; màn trống khi chưa ở Dự án nào |
| Tất cả Dự án | PM | Như Dự án của tôi nhưng gồm mọi Dự án, kể cả Dự án đã Lưu trữ |
| Chi tiết Dự án | Người trong dự án | Dải tóm tắt (Mã Dự án, tên, trạng thái, Khách hàng, Người phụ trách, Mức ưu tiên, hai ngày, Tiến độ, Trễ hạn, nhãn Quá hạn dự kiến) và bốn tab: **Task** (bảng Kanban lọc theo Người thực hiện, Người kiểm tra, trạng thái, Mức ưu tiên; kéo thẻ sang cột khác để đổi trạng thái, bị từ chối rõ ràng nếu bước không được phép), **Người trong dự án** (Vai trò trong Dự án, Chức danh, Số điện thoại, số Task đang giữ; thêm, gỡ người), **Thông tin** (mô tả, Dấu vết, sửa Dự án, Lưu trữ và mở lại), **GitHub** (repo đã gắn) |
| Chi tiết Task | Người trong dự án | Mở trong Ngăn trượt từ Kanban, Tổng quan, Việc của tôi, Chờ tôi duyệt: thông tin, Mức ưu tiên, Dấu vết, chuyển trạng thái (lý do bắt buộc ở Trả lại, Bị lỗi, Huỷ), số lần bị Trả lại; tab Lịch sử (trạng thái và đổi Mức ưu tiên), Link GitHub (trạng thái đọc từ GitHub), Sửa (chỉ người được sửa thấy) |
| Việc của tôi | Mọi người đã đăng nhập | Task chưa chốt mà mình là Người thực hiện, ở mọi Dự án, có cột Mức ưu tiên |
| Chờ tôi duyệt | Mọi người đã đăng nhập | Task đang Chờ duyệt giao cho mình làm Người kiểm tra, có cột Mức ưu tiên |
| Hồ sơ | Mọi người đã đăng nhập | Sửa tên hiển thị, GitHub username và Thông tin nhân sự của mình (Số điện thoại, Chức danh, Phòng ban) |
| Người dùng | PM | Danh sách tài khoản kèm Chức danh, Phòng ban; đổi vai hệ thống |

## Chạy thử trên máy (bản bộ nhớ)

Chỉ cần Node 22 trở lên. Không cần Supabase, mạng hay cơ sở dữ liệu.

```sh
npm install
npm run dev
```

Mở địa chỉ Vite in ra. Khi **không** có biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`, ứng dụng dùng
bản bộ nhớ của Kho dữ liệu, chỉ để chạy thử:

- Có sẵn một PM chạy thử: email `pm@vi-du.vn`, mật khẩu `matkhau-pm`. Đăng nhập rồi tạo Dự án.
- Tự đăng ký thêm tài khoản được; thư xác nhận và mã đặt lại mật khẩu là **mô phỏng** ngay trên màn hình
  (không có thư thật).
- Dữ liệu nằm trong bộ nhớ của trang: tải lại trang là mất hết. Cổng GitHub là bản giả, mọi link báo
  "Không đọc được trạng thái".
- Bản dựng production thiếu cấu hình Supabase thì ứng dụng hiện lỗi, không lặng lẽ dùng bản bộ nhớ.

Muốn chạy với Supabase thật, làm theo [`supabase/README.md`](supabase/README.md).

## Các lệnh của dự án

| Việc | Lệnh |
|---|---|
| Chạy thử trên máy | `npm run dev` |
| Test (cổng kiểm, không cần mạng, DB hay file ngoài repo) | `npm test` |
| Test chạy lại mỗi khi sửa | `npm run test:watch` |
| Kiểm kiểu | `npm run typecheck` |
| Lint | `npm run lint` |
| Dựng bản chạy | `npm run build` |
| Xem bản đã dựng | `npm run preview` |
| Tra Astryx | `npm run astryx -- component <Tên>` (hoặc `npx astryx ...`) |
| Bộ test hợp đồng và bảng ca trên Supabase thật (chủ dự án chạy tay, cần mạng; không thuộc cổng) | `npx vitest run --config vitest.supabase.config.ts` |

Cổng của Bảng ticket AI chạy `npm test`; phải xanh trước khi đáp ticket, nên chạy thêm `npm run typecheck`
và `npm run lint`. Dự án có luật cứng (không đổi danh sách phụ thuộc trong một ticket, không `div` hay
`className` thô, khoá `service role` không xuống trình duyệt...): xem [`AGENTS.md`](AGENTS.md).

## Kiến trúc

```
src/
  luat/       luật nghiệp vụ thuần, không I/O: chuyển trạng thái, quyền, Tiến độ, Trễ hạn, dấu vết
  kho/        Kho dữ liệu: giao diện, bản bộ nhớ, bản Supabase, bộ test hợp đồng, bảng ca dùng chung
  github/     Cổng GitHub: giao diện, bản giả, bản gọi Edge Function
  giaoDien/   các màn (Astryx), lấy Kho qua KhoContext và Cổng qua CongGitHubContext
supabase/
  migrations/ migration lên (chủ dự án tự áp)     down/       migration xuống (chạy tay)
  functions/  Edge Function doc-github              templates/  mẫu thư đặt lại mật khẩu
  README.md   hướng dẫn thiết lập và danh sách kiểm tay
```

**Luật nghiệp vụ nằm ở một chỗ thuần** (`src/luat/`): không đọc mạng, DB hay đồng hồ thật (ngày hôm nay
được truyền vào hàm). Giao diện dùng chính chỗ đó để ẩn nút và giải thích vì sao bị từ chối. Dữ liệu từ
biểu mẫu được kiểm bằng zod ở ranh giới.

**Kho dữ liệu** (`src/kho/khoDuLieu.ts`) là giao diện lưu trữ duy nhất mà phần còn lại của ứng dụng dùng.
Mọi lệnh nhận danh tính người gọi và trả kết quả đã áp luật và quyền, hoặc một lỗi có mã (không tìm thấy,
không có quyền, không hợp lệ, cần lý do...). Có hai bản cài: **bản bộ nhớ** (`khoBoNho.ts`, dùng cho test
và chạy thử) và **bản Supabase** (`khoSupabase.ts`). Ứng dụng chọn bản cài theo biến môi trường
`VITE_SUPABASE_*` (`cauHinh.ts`, `chonKho.ts`) và từ chối chạy nếu bất kỳ biến `VITE_*` nào chứa khoá service.

**Cổng GitHub** (`src/github/congGitHub.ts`) là giao diện thứ hai: nhận danh sách repo và link, trả trạng
thái đã chuẩn hoá (issue mở hoặc đóng; PR mở, đã merge hoặc đóng; PR nháp tính là mở) hoặc một lỗi có mã
(`KHONG_TIM_THAY`, `RIENG_TU`, `HET_LUOT_GOI`, `MAT_MANG`, `DU_LIEU_LA`). Chỉ đọc. Có bản giả để test và bản
gọi Edge Function `doc-github` của Supabase bằng chính phiên đăng nhập của người dùng; token GitHub chỉ
đọc nằm trong secret của Supabase, không bao giờ xuống trình duyệt. Một lỗi GitHub chỉ hiện thành thông
báo cạnh link, phần còn lại của Task vẫn dùng bình thường.

**Phân quyền ở hai chỗ.** Trình duyệt không đáng tin, nên bản Supabase ép cùng bộ luật ở phía cơ sở dữ
liệu: phân quyền từng dòng (RLS) chặn người ngoài Dự án, và trạng thái Task chỉ đổi qua hàm
`doi_trang_thai_task` chứ không ghi thẳng cột. Đây là bản sao của luật thuần, nên hai chỗ phải **khớp**.

**Bảng ca dùng chung** giữ hai chỗ khớp nhau: một bảng dữ liệu (vai, trạng thái, người gọi, bước muốn làm,
kết quả mong đợi) là nguồn sự thật của ma trận chuyển trạng thái (`src/kho/bangCaChuyenTrangThai.ts`) và
quyền xem, sửa (`src/kho/bangCaQuyen.ts`). Bản bộ nhớ chạy hết các dòng của bảng ngay trong `npm test`.
Bản Supabase chạy cùng bảng đó trên Supabase thật khi chủ dự án chạy tay lệnh
`npx vitest run --config vitest.supabase.config.ts`. Một **bộ test hợp đồng** chạy lại cho mọi bản cài của
Kho dữ liệu, chỉ kiểm hành vi nhìn thấy từ bên ngoài.

## Supabase và điều kiện trước khi đưa lên mạng

[`supabase/README.md`](supabase/README.md) đi theo thứ tự: tạo project, bật đăng ký email có xác nhận, áp
các migration trong `supabase/migrations/` đúng thứ tự, đặt vai PM đầu tiên, tạo token GitHub chỉ đọc, đặt
secret, triển khai Edge Function `doc-github`; mỗi bước nói rõ ai làm và kiểm kết quả thế nào.

Đăng ký đang mở cho mọi người nên **phân quyền từng dòng là hàng rào duy nhất** giữa người lạ và dữ liệu
của PM. Cổng test (`npm test`) không có mạng và không có cơ sở dữ liệu, nên **không kiểm được**: bản
Supabase, file migration, phân quyền từng dòng, hàm cơ sở dữ liệu, Edge Function với GitHub thật, luồng
email. Phần đó chỉ kiểm tay, theo **danh sách kiểm tay bảy mục** trong `supabase/README.md`. Trường mới
(Mã Dự án, Mức ưu tiên, Thông tin nhân sự, Vai trò trong Dự án) có thêm hai migration, bốn mục kiểm tay và
bước sửa mã tạm `DA-…` thành mã thật: mục "Nâng cấp lên trường mới" của hướng dẫn đó.

> **Chưa kiểm xong danh sách kiểm tay thì chưa đưa lên mạng.** Đưa ứng dụng lên mạng là việc riêng của chủ
> dự án, nằm ngoài các ticket.

## Thuật ngữ

Dùng đúng các từ này trong mã, test, giao diện và ticket. Bản đầy đủ (kèm cột "Đừng viết" và các từ kỹ
thuật) ở [`GLOSSARY.md`](GLOSSARY.md).

| Từ | Nghĩa |
|---|---|
| **Dự án** | Một đầu việc lớn có nhiều Task, nhiều người cùng làm, gắn 0 đến nhiều repo GitHub |
| **Task** | Một việc cụ thể trong một Dự án. Luôn viết "Task" |
| **Người thực hiện** | Người được giao làm Task. Mỗi Task có đúng một |
| **Người kiểm tra** | Người đánh giá kết quả Task. Mỗi Task có đúng một, khác Người thực hiện |
| **Người trong dự án** | Tài khoản đã được thêm vào một Dự án (khác với vai hệ thống **Thành viên**) |
| **PM / Support / Thành viên** | Ba vai hệ thống của một tài khoản |
| **Chờ duyệt** | Người thực hiện báo đã làm xong, đang đợi Người kiểm tra |
| **Hoàn thành** | Người kiểm tra chấp nhận kết quả. Trạng thái cuối |
| **Trả lại** | Kết quả chưa đạt, phải làm tiếp, giữ nguyên Task, có lý do |
| **Bị lỗi** | Kết quả hỏng hẳn, cần PM hoặc Support quyết định tiếp, có lý do |
| **Huỷ** | Task không làm nữa. Trạng thái cuối, có lý do |
| **Lưu trữ** | Dự án ngừng hoạt động, chỉ xem |
| **Dấu vết** | Người tạo, ngày tạo, người chỉnh sửa gần nhất, ngày chỉnh sửa gần nhất |
| **Tiến độ** | Phần trăm Task Hoàn thành của một Dự án (Huỷ không tính vào mẫu số) |
| **Trễ hạn** | Task có hạn đã qua mà chưa Hoàn thành và chưa Huỷ |

Các từ của bố cục và trường mới (Mã Dự án, Khách hàng, Người phụ trách, Mức ưu tiên, Quá hạn dự kiến, Vai trò
trong Dự án, Thông tin nhân sự, Tổng quan, Thanh bên, Ngăn trượt) có nghĩa đầy đủ trong `GLOSSARY.md`.

## Bản đồ tài liệu

| Tài liệu | Dùng để |
|---|---|
| [`GLOSSARY.md`](GLOSSARY.md) | Từ vựng của dự án |
| [`AGENTS.md`](AGENTS.md) | Luật cứng và cấu trúc mã cho AI và người làm |
| [`supabase/README.md`](supabase/README.md) | Dựng Supabase theo thứ tự, danh sách kiểm tay RLS, phần cổng không kiểm |
| `.scratch/quan-ly-du-an/spec.md` | Spec: hành vi chuẩn |
| `.scratch/bo-cuc-va-truong-moi/spec.md` | Spec mở rộng: Thanh bên, Tổng quan, tab Dự án, Ngăn trượt, trường mới |
| `.scratch/quan-ly-du-an/issues/` | Các ticket theo từng lát |
| `.env.example` | Mẫu cấu hình `.env.local` |
