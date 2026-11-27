# 05: Lệnh ghi Dự án và Người trong dự án trong 3 lượt gọi

**What to build:** Các lệnh ghi lên Dự án hiện tốn 4 đến 6 lượt gọi vì kiểm trước nhiều bước rồi mới ghi và đọc lại. Dựa vào cơ sở dữ liệu để ép luật, chỉ giữ lượt đọc trước khi ghi ở chỗ cần để trả đúng mã lỗi và đúng thứ tự từ chối. Áp cho: tạo, sửa, Lưu trữ, mở lại Dự án; thêm người, gỡ người, sửa Vai trò trong Dự án; gắn và gỡ repo. Dữ liệu biểu mẫu sai vẫn bị từ chối theo từng ô trước khi gọi mạng để ghi. Spec: `.scratch/toi-uu-hieu-nang/spec.md` (story 16, 18, 19).

Cách đếm: một lượt gọi là một yêu cầu mạng tới Supabase (đọc bảng hoặc gọi hàm), đếm bằng `fetch` giả truyền vào bản Supabase của Kho dữ liệu như các test bản Supabase hiện có; chỉ đếm trên đường đi thành công, sau khi đã đăng nhập; không tính đăng nhập, làm mới phiên và Cổng GitHub. Chỉ sửa bản Supabase của Kho dữ liệu: không đổi giao diện của Kho (danh sách lệnh, kiểu trả về, mã lỗi), không đổi bản bộ nhớ, luật thuần, migration hay Edge Function. Mã lỗi và thứ tự từ chối giữ nguyên; chỗ nào bỏ lượt đọc mà làm đổi mã lỗi thì giữ lượt đọc đó. Nếu vì vậy không đạt trần: giữ hành vi, viết test với con số thấp nhất đạt được, và ghi con số cùng lý do dưới mục `## Comments` ở cuối ticket này để chủ dự án quyết.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Mỗi lệnh sau, trên đường thành công và kể cả đọc lại kết quả, tốn nhiều nhất 3 lượt gọi: tạo Dự án, sửa Dự án, Lưu trữ, mở lại, thêm người, gỡ người, sửa Vai trò trong Dự án, gắn repo, gỡ repo.
- [ ] Dữ liệu biểu mẫu sai trả lỗi theo từng ô như trước và không có lượt gọi nào ghi lên Supabase.
- [ ] Các ca từ chối hiện có vẫn trả đúng mã lỗi và đúng thứ tự: không có quyền trước không tìm thấy, Dự án đã Lưu trữ, Mã Dự án trùng, ngày không hợp lệ, Người phụ trách ngoài Dự án, gỡ người đang giữ Task.
- [ ] Kết quả trả về sau khi ghi (kể cả Dấu vết kèm tên) bằng đúng như trước.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test` với `fetch` giả, không cần mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo. Bộ test hợp đồng và hai bảng ca không bị sửa và vẫn xanh; mọi test hiện có vẫn xanh. Không đổi `package.json` hay lockfile, không sửa hook của repo, không thêm migration. `npm run typecheck` và `npm run lint` sạch.

## Comments

- **Đạt trần, không đổi mã lỗi.** Lượt gọi tới PostgREST sau khi đăng nhập, đếm bằng `fetch` giả (`src/kho/khoSupabaseLenhGhiDuAn.test.ts`; số "trước" đo bằng chính các ca đó trên mã trước ticket), như nhau ở Dự án 3 Task 2 người và 40 Task 7 người, với PM (không ở trong Dự án) và Support của Dự án:

  | Lệnh | Trước → sau |
  |---|---|
  | tạo Dự án | 2 → 2 |
  | sửa Dự án | 4 → 3 |
  | Lưu trữ, mở lại | 5 → 3 |
  | thêm người | 4 → 3 |
  | sửa Vai trò trong Dự án | 4 → 3 |
  | gỡ người | 3 → 2 |
  | gắn repo, gỡ repo | 3 → 2 |

- **Cách làm:** `quanLyDuAn` (`src/kho/khoSupabaseNguoiGoi.ts`) đọc dòng Dự án kèm id Người trong dự án nhúng trong MỘT lượt (trước: hai lượt, "có ở trong không" rồi dòng Dự án). Dự án không thấy được thì người gọi chắc chắn không ở trong (phân quyền nguoi_trong_du_an theo cùng luật xem với du_an), nên vẫn `KHONG_CO_QUYEN` trước `KHONG_TIM_THAY`. Lưu trữ, mở lại không đọc trước: hàm `luu_tru_du_an`, `mo_lai_du_an` tự kiểm quyền, tồn tại, trạng thái đúng thứ tự của luật thuần và ném đúng mã; id sai dạng trả mã ngay không gọi mạng. Ba lượt còn lại: gọi hàm, đọc lại dòng Dự án, tên cho Dấu vết.
- **Giữ lượt đọc trước khi ghi ở:** sửa Dự án (cần ngày đang lưu để kiểm ngày, tên cũ để ghi dấu vết, và để báo quyền, Lưu trữ trước lỗi biểu mẫu); thêm người, sửa vai trò, gắn repo (quyền và Lưu trữ phải báo trước lỗi biểu mẫu); gỡ người (policy `nguoi_trong_du_an_go` giấu dòng của Dự án Lưu trữ, bỏ lượt đọc thì thành `KHONG_TIM_THAY` thay vì `DU_AN_DA_LUU_TRU`).
- **Chủ dự án nên biết:**
  1. Lệnh ghi Task dùng `quanLyDuAn` (tạo Task, sửa Task, đổi người) cũng rẻ đi một lượt; ticket 06 tính từ số mới.
  2. Lưu trữ, mở lại bị từ chối giờ có một lượt gọi hàm (cơ sở dữ liệu từ chối, không ghi gì), và nếu đang dùng hồ sơ đã nhớ thì thêm một lượt đọc lại hồ sơ (`theoVaiMoiNhat`); đường từ chối không có trần.
  3. `fetch` giả của `khoSupabaseDuAn.test.ts`, `khoSupabaseNguoiGoi.test.ts`, `khoSupabaseChiTietDuAn.test.ts`, `khoSupabaseTaskHoSoNguoi.test.ts` thêm phần nhúng id Người trong dự án vào lượt đọc `du_an`. Chỉ kiểm trên `fetch` giả; đã ghi mục kiểm tay vào `supabase/README.md`.
