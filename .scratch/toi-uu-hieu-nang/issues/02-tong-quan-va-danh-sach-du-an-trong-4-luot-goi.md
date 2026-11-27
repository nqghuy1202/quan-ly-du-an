# 02: Tổng quan và danh sách Dự án trong 4 lượt gọi

**What to build:** Mở Tổng quan, Tất cả Dự án và Dự án của tôi hiện đọc Task riêng cho từng Dự án, nên số lượt gọi tăng theo số Dự án. Đọc theo lô: Task của mọi Dự án người gọi thấy được trong một lượt (phân quyền từng dòng đã lọc sẵn), tên người gom vào một lượt, rồi tính số liệu bằng luật thuần như hiện nay. Số liệu hiện ra (Tiến độ, Trễ hạn, tới hạn trong 7 ngày, phân bố theo trạng thái, số Task, Quá hạn dự kiến) không đổi. Spec: `.scratch/toi-uu-hieu-nang/spec.md` (story 1–7).

Cách đếm: một lượt gọi là một yêu cầu mạng tới Supabase (đọc bảng hoặc gọi hàm), đếm bằng `fetch` giả truyền vào bản Supabase của Kho dữ liệu như các test bản Supabase hiện có; chỉ đếm trên đường đi thành công, sau khi đã đăng nhập; không tính đăng nhập, làm mới phiên và Cổng GitHub. Chỉ sửa bản Supabase của Kho dữ liệu: không đổi giao diện của Kho (danh sách lệnh, kiểu trả về, mã lỗi), không đổi bản bộ nhớ, luật thuần, migration hay Edge Function. Mã lỗi và thứ tự từ chối giữ nguyên; chỗ nào bỏ lượt đọc mà làm đổi mã lỗi thì giữ lượt đọc đó. Nếu vì vậy không đạt trần: giữ hành vi, viết test với con số thấp nhất đạt được, và ghi con số cùng lý do dưới mục `## Comments` ở cuối ticket này để chủ dự án quyết.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Đọc dữ liệu Tổng quan tốn nhiều nhất 4 lượt gọi, với 1 Dự án và với ít nhất 8 Dự án có Task.
- [ ] Đọc danh sách Dự án kèm số liệu phạm vi tất cả (PM) tốn nhiều nhất 4 lượt gọi, với 1 Dự án và với ít nhất 8 Dự án.
- [ ] Đọc danh sách Dự án kèm số liệu phạm vi của tôi (Support, Thành viên) tốn nhiều nhất 4 lượt gọi ở cả hai cỡ dữ liệu.
- [ ] Người chưa ở Dự án nào: kết quả trống như trước và không có lượt gọi nào đọc Task.
- [ ] Với cùng dữ liệu, kết quả Tổng quan và danh sách Dự án kèm số liệu của bản Supabase trên `fetch` giả bằng đúng kết quả trước khi đổi (số Task, Tiến độ, Trễ hạn, Dự án Lưu trữ hiện hay ẩn theo từng màn).
- [ ] Support và Thành viên chỉ nhận Dự án mình ở trong và Task của các Dự án đó.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test` với `fetch` giả, không cần mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo. Bộ test hợp đồng và hai bảng ca không bị sửa và vẫn xanh; mọi test hiện có vẫn xanh. Không đổi `package.json` hay lockfile, không sửa hook của repo, không thêm migration. `npm run typecheck` và `npm run lint` sạch.

## Comments

- **Đạt trần, không đổi mã lỗi.** Lượt gọi tới PostgREST sau khi đăng nhập, đếm bằng `fetch` giả (`src/kho/khoSupabaseDocLo.test.ts`; con số "trước" đo bằng cách ghép cũ chạy trên cùng bản Supabase và cùng dữ liệu giả):

  | Việc | 1 Dự án: trước → sau | 10 Dự án (9 hoạt động, 1 Lưu trữ): trước → sau |
  |---|---|---|
  | Tổng quan (PM) | 8 → 4 | 48 → 4 |
  | Tất cả Dự án (PM) | 7 → 3 | 52 → 3 |
  | Dự án của tôi (Thành viên ở 6 Dự án) | 8 → 3 | 33 → 3 |
  | Người chưa ở Dự án nào (cả ba) | — | 1 lượt, không đọc Task |

- **Cách đọc:** `src/kho/khoSupabaseDocLo.ts`. Tổng quan: Dự án đang hoạt động kèm id Người trong dự án nhúng cùng lượt (1), rồi cùng lúc mọi Task người gọi thấy và tên cho Dự án (2), rồi tên cho Task (1). Dự án kèm số liệu: Dự án (1), rồi cùng lúc Task (chỉ `du_an_id, han, trang_thai`) và tên (2). Số liệu vẫn tính bằng `tinhTongQuan`, `tinhSoLieuDuAn`. `docTongQuan` (tongQuan.ts) dùng lối đọc theo lô khi Kho có `docDuLieuTongQuan` (chỉ bản Supabase có; không thuộc giao diện Kho), bản bộ nhớ đi lối cũ.
- **Chủ dự án nên biết:**
  1. Tên người cần hai lượt (`ten_nguoi_dau_vet` cho Dự án, `ten_nguoi_cua_task` cho Task): hai hàm có luật xem tên khác nhau, gộp một lượt thì cần migration (ngoài phạm vi). Vì vậy Tổng quan dùng vai theo hồ sơ đã nhớ của phiên thay vì đọc lại hồ sơ (cách cũ đọc mới mỗi lần); vai chỉ quyết dấu "chưa có Người phụ trách", nên người vừa bị đổi vai thấy dấu đó theo vai cũ đến lần đọc hồ sơ kế tiếp (như Thanh bên, story 21). Dữ liệu Dự án và Task vẫn do phân quyền từng dòng của máy chủ quyết theo vai mới.
  2. Task đọc từng trang 500 dòng: trên 500 Task người gọi thấy được thì thêm một lượt mỗi 500 Task. PM đọc cả Task của Dự án Lưu trữ (lọc phía client), đổi lại không phải gửi danh sách id Dự án trong địa chỉ.
  3. Lượt đọc `du_an` nhúng `nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(nguoi_dung_id)`: phải gọi tên khoá vì `du_an_nguoi_phu_trach_fkey` cũng nối hai bảng. Cổng chỉ kiểm trên `fetch` giả; đã ghi mục kiểm tay vào `supabase/README.md` (mục "Cổng chưa kiểm"). Bộ test hợp đồng Tổng quan không chạy trên Supabase thật (ca của nó đếm tuyệt đối mọi Dự án PM thấy, sẽ lệch trên cơ sở dữ liệu dùng chung); phần Dự án kèm số liệu thì có.
