# 06: Lệnh ghi Task trong 3 lượt gọi

**What to build:** Như ticket 05 nhưng cho Task: tạo Task, sửa Task, đổi người của Task, đổi trạng thái (kể cả khi kéo thả trên Kanban), thêm và gỡ link. Trạng thái vẫn chỉ đổi qua hàm đổi trạng thái của cơ sở dữ liệu. Ngoài ra thêm vào danh sách kiểm tay trong tài liệu Supabase một mục: sau lô tối ưu hiệu năng, chủ dự án chạy lại bộ test hợp đồng và bảng ca trên Supabase thật, và xem số yêu cầu mạng của từng màn trên mây. Spec: `.scratch/toi-uu-hieu-nang/spec.md` (story 16–19, mục Testing Decisions).

Cách đếm: một lượt gọi là một yêu cầu mạng tới Supabase (đọc bảng hoặc gọi hàm), đếm bằng `fetch` giả truyền vào bản Supabase của Kho dữ liệu như các test bản Supabase hiện có; chỉ đếm trên đường đi thành công, sau khi đã đăng nhập; không tính đăng nhập, làm mới phiên và Cổng GitHub. Chỉ sửa bản Supabase của Kho dữ liệu: không đổi giao diện của Kho (danh sách lệnh, kiểu trả về, mã lỗi), không đổi bản bộ nhớ, luật thuần, migration hay Edge Function. Mã lỗi và thứ tự từ chối giữ nguyên; chỗ nào bỏ lượt đọc mà làm đổi mã lỗi thì giữ lượt đọc đó. Nếu vì vậy không đạt trần: giữ hành vi, viết test với con số thấp nhất đạt được, và ghi con số cùng lý do dưới mục `## Comments` ở cuối ticket này để chủ dự án quyết.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Mỗi lệnh sau, trên đường thành công và kể cả đọc lại kết quả, tốn nhiều nhất 3 lượt gọi: tạo Task, sửa Task, đổi người của Task, đổi trạng thái Task, thêm link, gỡ link.
- [ ] Dữ liệu biểu mẫu sai trả lỗi theo từng ô như trước và không có lượt gọi nào ghi lên Supabase.
- [ ] Các ca từ chối hiện có vẫn trả đúng mã lỗi và đúng thứ tự: không có quyền, Dự án đã Lưu trữ, Task đã chốt, thiếu người, người ngoài Dự án, trùng người, bước chuyển không hợp lệ, thiếu lý do.
- [ ] Kết quả trả về sau khi ghi bằng đúng như trước; lịch sử trạng thái có thêm đúng một dòng sau mỗi lần đổi trạng thái thành công.
- [ ] Tài liệu Supabase có mục kiểm tay mới nêu trên, và test giữ tài liệu khớp cấu hình vẫn xanh.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test` với `fetch` giả, không cần mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo. Bộ test hợp đồng và hai bảng ca không bị sửa và vẫn xanh; mọi test hiện có vẫn xanh. Không đổi `package.json` hay lockfile, không sửa hook của repo, không thêm migration. `npm run typecheck` và `npm run lint` sạch.

## Comments

- **Đạt trần, không đổi mã lỗi.** Lượt gọi tới PostgREST sau khi đăng nhập, đếm bằng `fetch` giả (`src/kho/khoSupabaseLenhGhiTask.test.ts`; số "trước" đo bằng chính các ca đó trên mã trước ticket, tức sau ticket 05), như nhau ở Dự án 5 Task 4 người và 45 Task 9 người 13 link 32 dòng lịch sử, với PM (không ở trong Dự án), Support của Dự án, Người thực hiện, Người kiểm tra, Thành viên:

  | Lệnh | Trước → sau |
  |---|---|
  | tạo Task | 5 → 3 |
  | sửa Task | 5 → 3 |
  | đổi người của Task | 6 → 3 |
  | đổi trạng thái (kể cả kéo thả trên Kanban) | 6 → 3 |
  | thêm link, gỡ link | 4 → 2 |

- **Cách làm** (chỗ gom vẫn là `src/kho/khoSupabaseNguoiGoi.ts`):
  - `xemTaskDeGhi`: chính lượt đọc Task kèm Dự án và Người trong dự án của `xemTaskKemDuAn` (ticket 04), nhưng không dùng chung khi đang bay (lượt đọc trước khi ghi không được để lệnh đọc gọi cùng lúc dùng lại). `quanLyTask` thêm luật quản lý Dự án lên nó, cùng mã và thứ tự như "đọc dòng Task rồi `quanLyDuAn`" cũ. `quanLyDuAn` trả thêm id Người trong dự án (đã có trong lượt đọc của ticket 05).
  - Sửa Task, đổi người: một lượt đọc, ghi, tên người (dấu "đã rời dự án" lấy từ Người trong dự án đã đọc). Tạo Task: lượt kiểm quản lý Dự án (kèm Người trong dự án), ghi, tên người. Thêm, gỡ link: một lượt đọc, gọi hàm.
  - Đổi trạng thái gọi `doi_trang_thai_task` TRƯỚC, không đọc trước: hàm kiểm đủ bảy bước của `kiemChuyenTrangThai`, cùng thứ tự, cùng mã. Bị từ chối vì luật thì Kho mới đọc Task và chạy luật thuần để trả đúng mã, thông báo, lỗi theo ô như trước. Dữ liệu biểu mẫu chắc chắn sai (trạng thái đích hay lý do sai dạng, thiếu lý do khi mọi bước sang trạng thái đó đều cần lý do) thì đọc Task rồi để luật thuần từ chối, không gửi lệnh ghi nào.
- **Giữ lượt đọc trước khi ghi ở:** tạo, sửa Task, đổi người (quyền, Lưu trữ, Task đã chốt phải báo trước lỗi dữ liệu; cần Người trong dự án để báo thiếu người, người ngoài Dự án, trùng người theo ô); thêm, gỡ link (Task không thấy, Lưu trữ phải báo trước `LINK_KHONG_HOP_LE`).
- **Chủ dự án nên biết:**
  1. Đổi trạng thái giờ dựa vào hàm SQL làm hàng rào đầu tiên: nếu hàm trên mây lệch luật thuần thì có thể ghi một bước mà luật thuần lẽ ra chặn. Bảng ca chuyển trạng thái chạy trên Supabase thật là lưới an toàn (đã đưa vào mục kiểm tay). Test mới so mọi người gọi × mọi trạng thái × mọi trạng thái đích (có, không có lý do) với luật thuần trên `fetch` giả bắt chước bảy bước.
  2. Đường bị từ chối của đổi trạng thái (trừ lỗi dữ liệu) giờ là: gọi hàm (bị từ chối, không ghi gì), đọc Task; đang dùng hồ sơ đã nhớ thì thêm một lượt đọc lại hồ sơ, vai đổi thì chạy lại lệnh. Đường từ chối không có trần.
  3. `src/kho/khoSupabaseVongDuyet.test.ts`: `fetch` giả của `doi_trang_thai_task` nay bắt chước bảy bước kiểm của SQL (trước đây luôn cho qua); khẳng định "không gọi hàm" của các ca từ chối không phải lỗi dữ liệu đổi thành "gọi nhiều nhất một lần, không ghi gì" (lỗi dữ liệu vẫn "không gọi hàm"); ca Task không tồn tại với id đúng dạng giờ có một lần gọi hàm bị từ chối.
  4. Kết quả trả về sau khi ghi Task dùng danh sách Người trong dự án đọc ngay trước khi ghi; chỉ khác lần đọc kế tiếp nếu có người bị gỡ khỏi Dự án đúng lúc đó.
  5. `supabase/README.md`: thêm mục "Sau lô tối ưu hiệu năng" ở Phần A (chạy lại bộ test hợp đồng và bảng ca trên Supabase thật; đếm yêu cầu `/rest/v1/` từng màn và từng lệnh trên mây theo bảng trần; thử vài đường từ chối), Bước 12 trỏ tới mục này. Không làm thành "Mục kiểm 8" vì `src/taiLieu.test.ts` ép Phần B đúng bảy mục. Bốn đoạn "Kiểm tay: ..." của ticket 02–05 trong mục "Cổng chưa kiểm" gộp thành một danh sách những gì cổng không kiểm, trỏ về mục mới; đoạn cổng kiểm của Vòng duyệt sửa cho khớp cách làm mới.
