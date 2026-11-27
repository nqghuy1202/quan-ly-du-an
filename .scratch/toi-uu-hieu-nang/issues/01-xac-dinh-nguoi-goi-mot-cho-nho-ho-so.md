# 01: Xác định người gọi một chỗ, nhớ hồ sơ theo phiên

**What to build:** Bản Supabase của Kho dữ liệu hiện đọc lại hồ sơ người gọi ở đầu mọi lệnh. Gom việc xác định người gọi (hồ sơ, có ở trong Dự án không, đọc Dự án) về một chỗ duy nhất bên trong bản Supabase để các ticket sau dùng lại, và cho Kho nhớ hồ sơ của phiên đang mở: đọc một lần khi đăng nhập, làm mới khi gọi lệnh đọc hồ sơ của tôi hoặc sửa hồ sơ, xoá khi đăng xuất. Vai mới vẫn có hiệu lực ngay như hợp đồng hiện có: trước khi từ chối một lệnh vì vai theo bản nhớ, Kho đọc lại hồ sơ một lần rồi mới quyết; khi bản nhớ cho phép mà cơ sở dữ liệu từ chối thì Kho trả đúng mã lỗi mà luật thuần sẽ trả. Phiên đã hết hoặc tài khoản không còn vẫn trả lỗi chưa đăng nhập. Spec: `.scratch/toi-uu-hieu-nang/spec.md` (story 20–23, mục "Kho nhớ hồ sơ của phiên đang mở").

Cách đếm: một lượt gọi là một yêu cầu mạng tới Supabase (đọc bảng hoặc gọi hàm), đếm bằng `fetch` giả truyền vào bản Supabase của Kho dữ liệu như các test bản Supabase hiện có; chỉ đếm trên đường đi thành công, sau khi đã đăng nhập; không tính đăng nhập, làm mới phiên và Cổng GitHub. Chỉ sửa bản Supabase của Kho dữ liệu: không đổi giao diện của Kho (danh sách lệnh, kiểu trả về, mã lỗi), không đổi bản bộ nhớ, luật thuần, migration hay Edge Function. Mã lỗi và thứ tự từ chối giữ nguyên; chỗ nào bỏ lượt đọc mà làm đổi mã lỗi thì giữ lượt đọc đó. Nếu vì vậy không đạt trần: giữ hành vi, viết test với con số thấp nhất đạt được, và ghi con số cùng lý do dưới mục `## Comments` ở cuối ticket này để chủ dự án quyết.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Sau khi đăng nhập, mỗi lệnh đọc đơn (danh sách người dùng, Dự án của tôi, danh sách Dự án không kèm số liệu) không còn lượt đọc hồ sơ riêng: số lượt gọi của mỗi lệnh giảm ít nhất 1 so với trước và không lệnh nào quá 2 lượt.
- [ ] Gọi liên tiếp hai lệnh đọc thì lệnh thứ hai không đọc hồ sơ.
- [ ] Lệnh đọc hồ sơ của tôi luôn gọi mạng và trả hồ sơ mới nhất; sau khi sửa hồ sơ, lệnh kế tiếp thấy tên mới.
- [ ] Người vừa được nâng từ Thành viên lên Support (hồ sơ đổi ở Supabase giả giữa hai lệnh) thực hiện được ngay một lệnh quản lý Dự án mình ở trong.
- [ ] Người vừa bị hạ từ PM xuống Thành viên gọi một lệnh chỉ PM được làm thì nhận đúng mã lỗi không có quyền như trước.
- [ ] Phiên không còn hợp lệ hoặc hồ sơ không còn thì lệnh kế tiếp trả lỗi chưa đăng nhập; sau khi đăng xuất, phiên cũ không dùng lại được bản nhớ.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test` với `fetch` giả, không cần mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo. Bộ test hợp đồng và hai bảng ca không bị sửa và vẫn xanh; mọi test hiện có vẫn xanh. Không đổi `package.json` hay lockfile, không sửa hook của repo, không thêm migration. `npm run typecheck` và `npm run lint` sạch.

## Comments

- **Đạt trần, không đổi mã lỗi.** Lượt gọi tới PostgREST sau khi đăng nhập, đếm bằng `fetch` giả (`src/kho/khoSupabaseNguoiGoi.test.ts`; con số "trước" đo bằng chính các ca đó trên mã cũ): danh sách người dùng 2 → 1, Dự án của tôi 2 → 1, danh sách Dự án 3 → 2. Hồ sơ đọc một lần trong lệnh đăng nhập (thuộc lượt đăng nhập, không tính).
- **Chỗ gom:** `src/kho/khoSupabaseNguoiGoi.ts` (phiên đang mở, bản nhớ hồ sơ, `xacThuc`, `docLaiHoSo`, `laNguoiTrongDuAn`, `xemDuAn`, `quanLyDuAn`, `theoVaiMoiNhat`). Mọi lệnh nhận phiên được bọc bằng `theoVaiMoiNhat`: bị từ chối khi đang dùng hồ sơ đã nhớ thì đọc lại hồ sơ một lần; vai đổi thì chạy lại lệnh theo vai mới. Đường từ chối vì vậy có thể tốn thêm 1 lượt (spec không áp trần cho đường từ chối).
- **Hai chỗ khác trước, chủ dự án nên biết (không có ca hợp đồng nào chạm tới):**
  1. Người vừa bị hạ vai gọi một lệnh **đọc** mà cơ sở dữ liệu không từ chối thì vẫn theo vai cũ đến lần từ chối hay lần đọc hồ sơ kế tiếp. Ví dụ duy nhất tìm thấy: Support bị hạ xuống Thành viên nhưng vẫn ở trong Dự án gọi `danhSachTaskNguoiDangGiu` (phân quyền từng dòng vẫn cho đọc Task của Dự án mình). Danh sách người dùng (lệnh chỉ PM) đã xử lý riêng: hồ sơ của chính người gọi luôn có trong kết quả nên vai được kiểm lại không tốn thêm lượt.
  2. Tài khoản bị xoá mà mã truy cập (JWT) vẫn còn hạn: lệnh đọc mà phân quyền từng dòng trả rỗng (vd. Dự án của tôi) trả danh sách rỗng thay vì `CHUA_DANG_NHAP`; lệnh bị từ chối kế tiếp, hoặc lần làm mới phiên (mã hết hạn, tối đa 1 giờ), mới trả `CHUA_DANG_NHAP`. Phiên client không còn giữ (hết hạn, làm mới bị từ chối) thì vẫn trả `CHUA_DANG_NHAP` ngay như trước.
- **Kiểm tay:** nên chạy lại bộ test hợp đồng trên Supabase thật (`npx vitest run --config vitest.supabase.config.ts`) sau ticket này; cổng chỉ chạy bản bộ nhớ và `fetch` giả.
