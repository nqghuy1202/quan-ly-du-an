# 03: Chi tiết Dự án trong 5 lượt gọi

**What to build:** Màn Chi tiết Dự án gọi cùng lúc ba lệnh (đọc Dự án, Người trong dự án, Task của Dự án), mỗi lệnh tự kiểm lại người gọi và Dự án. Cho các lệnh gọi cùng lúc trên cùng một Dự án dùng chung kết quả kiểm người gọi và kiểm Dự án, và gom lượt đọc tên người. Lý do từ chối khi Dự án không tồn tại hoặc không được xem, và bộ đếm số Task đang giữ của từng Người trong dự án, giữ nguyên. Spec: `.scratch/toi-uu-hieu-nang/spec.md` (story 8–11).

Cách đếm: một lượt gọi là một yêu cầu mạng tới Supabase (đọc bảng hoặc gọi hàm), đếm bằng `fetch` giả truyền vào bản Supabase của Kho dữ liệu như các test bản Supabase hiện có; chỉ đếm trên đường đi thành công, sau khi đã đăng nhập; không tính đăng nhập, làm mới phiên và Cổng GitHub. Chỉ sửa bản Supabase của Kho dữ liệu: không đổi giao diện của Kho (danh sách lệnh, kiểu trả về, mã lỗi), không đổi bản bộ nhớ, luật thuần, migration hay Edge Function. Mã lỗi và thứ tự từ chối giữ nguyên; chỗ nào bỏ lượt đọc mà làm đổi mã lỗi thì giữ lượt đọc đó. Nếu vì vậy không đạt trần: giữ hành vi, viết test với con số thấp nhất đạt được, và ghi con số cùng lý do dưới mục `## Comments` ở cuối ticket này để chủ dự án quyết.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Gọi cùng lúc ba lệnh mà màn Chi tiết Dự án gọi khi mở (đọc Dự án, danh sách Người trong dự án, danh sách Task) tốn tổng cộng nhiều nhất 5 lượt gọi, với Dự án có 1 Task và với Dự án có nhiều Task, nhiều người.
- [ ] Kết quả ba lệnh bằng đúng kết quả khi gọi lần lượt từng lệnh, kể cả bộ đếm Task đang giữ và Dấu vết kèm tên.
- [ ] Dự án không tồn tại, và Dự án người gọi không được xem, vẫn trả đúng mã lỗi như trước ở cả ba lệnh.
- [ ] Kết quả dùng chung không sống qua lệnh ghi: sau khi thêm hoặc gỡ một Người trong dự án, lần đọc kế tiếp thấy danh sách mới và quyền mới.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test` với `fetch` giả, không cần mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo. Bộ test hợp đồng và hai bảng ca không bị sửa và vẫn xanh; mọi test hiện có vẫn xanh. Không đổi `package.json` hay lockfile, không sửa hook của repo, không thêm migration. `npm run typecheck` và `npm run lint` sạch.

## Comments

- **Đạt trần, không đổi mã lỗi.** Lượt gọi tới PostgREST sau khi đăng nhập, đếm bằng `fetch` giả (`src/kho/khoSupabaseChiTietDuAn.test.ts`; con số "trước" đo bằng chính các ca đó trên mã trước ticket): ba lệnh gọi cùng lúc 12 → 5, ở cả Dự án 1 Task 2 người và Dự án 40 Task 3 người (PM, Support, Thành viên). Gọi lần lượt: 12 → 10.
- **Cách làm:** `xemDuAnKemNguoiTrong` (`src/kho/khoSupabaseNguoiGoi.ts`) đọc cùng lúc dòng Dự án và mọi Người trong dự án (kèm hồ sơ, Vai trò trong Dự án), rồi biết người gọi có ở trong Dự án từ chính danh sách đó; luật xem dùng chung với `xemDuAn`. `layDuAn`, `danhSachNguoiTrongDuAn`, `danhSachTask` dùng nó; danh sách đó phục vụ luôn tab Người trong dự án và dấu "đã rời dự án" của Task. Lượt đọc Task dùng chung giữa `danhSachTask` và bộ đếm Task đang giữ. Năm lượt: Dự án, Người trong dự án, tên cho Dấu vết Dự án, Task, tên cho Task.
- **Dùng chung chỉ khi đang bay:** `dungChungKhiDangBay` giữ lời hứa theo phiên và khoá (khoá kiểm xem có id và vai người gọi, nên lệnh chạy lại theo vai mới không dùng kết quả theo vai cũ), bỏ ngay khi xong. Mọi lệnh ngoài danh sách chỉ đọc `LENH_CHI_DOC` (`khoSupabase.ts`) bỏ mọi lời hứa đang bay lúc bắt đầu và lúc xong; lệnh mới chưa ghi vào danh sách mặc định là lệnh ghi. Đăng xuất bỏ lời hứa của phiên. Không có hạn thời gian, không đọc đồng hồ.
- **Chủ dự án nên biết:**
  1. Số "cách ghép cũ" trong `khoSupabaseDocLo.test.ts` (ticket 02) giảm theo (`danhSachTask` rẻ hơn 1 lượt): 8, 7, 8 → 7, 6, 7 và 48, 52, 33 → 39, 42, 27; đã sửa số trong test, kèm ghi chú.
  2. `danhSachNguoiTrongDuAn` giờ đếm Task đang giữ trên lượt đọc Task có phân trang (trước là một lượt không phân trang), nên trên 500 Task thêm một lượt mỗi 500 Task, đổi lại không bị cắt ở giới hạn số dòng của máy chủ.
  3. `fetch` giả của `khoSupabaseTaskHoSoNguoi.test.ts` bỏ mất cột thường khi có hồ sơ nhúng; đã sửa cho trả như PostgREST (giữ `nguoi_dung_id`).
  4. Chỉ kiểm trên `fetch` giả; đã ghi mục kiểm tay vào `supabase/README.md`.
