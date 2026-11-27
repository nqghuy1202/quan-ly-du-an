# 02: Tìm và lọc ở Việc của tôi và Chờ tôi duyệt

**What to build:** Trang Việc của tôi và Chờ tôi duyệt có thanh tìm và lọc phía trên bảng, dùng chung một phần giao diện.
- Ô tìm khớp tiêu đề Task, Mã Dự án hoặc tên Dự án, bỏ qua hoa thường, dấu tiếng Việt và khoảng trắng hai đầu (dùng lại cách chuẩn hoá của luật tìm Dự án).
- Chip lọc bật tắt được: nhóm Trạng thái (Mới, Đang làm, Chờ duyệt, Trả lại, Bị lỗi; chỉ ở Việc của tôi), nhóm Mức ưu tiên (Thấp, Trung bình, Cao), và chip Trễ hạn (dùng luật Trễ hạn hiện có, thời điểm truyền vào). Mỗi chip kèm số Task khớp, ví dụ "Mới (23)", đếm trên toàn danh sách đã đọc nên không đổi khi bật chip khác hay gõ tìm. Chip số 0 vẫn hiện (ví dụ "Bị lỗi (0)") và bấm được như chip khác, không làm mờ, không vô hiệu. Chip báo trạng thái bật tắt cho công nghệ hỗ trợ và có focus ring.
- Trong một nhóm là "hoặc", giữa các nhóm và với ô tìm là "và". Thứ tự Task giữ như hiện nay.
- Đang lọc thì hiện dòng "Hiện X trên Y Task"; không lọc thì không hiện. Lọc ra rỗng thì hiện "Không có Task khớp bộ lọc" kèm nút "Xoá bộ lọc", bấm thì ô tìm trống, mọi chip tắt.
- Mở rồi đóng Ngăn trượt giữ bộ lọc; Task đổi trong Ngăn trượt thì danh sách đọc lại, số trên chip cập nhật, bộ lọc giữ. Rời trang rồi quay lại thì bộ lọc về trống.
- Trang đang tải, lỗi, hoặc chưa có Task nào thì không hiện thanh tìm và lọc; báo trống như trước.

Luật tìm và lọc việc cá nhân là hàm thuần ở tầng luật nghiệp vụ, không I/O: kiểu bộ lọc và hằng bộ lọc trống, hàm lọc (nhận danh sách, bộ lọc, thời điểm), hàm đếm cho từng chip, hàm đang lọc. Không đổi Kho dữ liệu: hai lệnh đọc hiện có giữ nguyên, lọc chạy trên danh sách đã đọc. Chip dựng từ component Astryx có trạng thái bật tắt (đọc `astryx component <Tên>` trước khi chọn). Spec: `.scratch/sap-xep-giao-dien/spec.md` (story 13–40).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Hàm lọc: "khop ma" khớp Task tiêu đề "[Khớp mã trạng thái DVC] 01"; "ams" khớp theo Mã Dự án `AMS`; khoảng trắng hai đầu bị bỏ qua; từ khoá không khớp gì trả danh sách rỗng.
- [ ] Hàm lọc: chọn Mới và Trả lại trả Task ở một trong hai trạng thái; thêm Mức ưu tiên Cao chỉ còn Task thoả cả hai nhóm; thêm từ khoá thì phải khớp cả từ khoá.
- [ ] Hàm lọc: chip Trễ hạn đúng biên nửa đêm giờ Việt Nam (Task hạn hôm nay chưa trễ, hạn hôm qua đã trễ; Task không có hạn không bao giờ trễ), thời điểm truyền vào.
- [ ] Hàm lọc với bộ lọc trống trả đủ danh sách, đúng thứ tự đầu vào; kết quả lọc luôn giữ thứ tự đầu vào.
- [ ] Hàm đếm trả đúng số cho từng chip, kể cả chip số 0, và không phụ thuộc chip khác hay từ khoá; hàm đang lọc đúng với từ khoá chỉ có khoảng trắng (không lọc) và với một chip bật (đang lọc).
- [ ] Màn Việc của tôi: có ô tìm có nhãn và ba nhóm chip kèm số; gõ tìm hoặc bật chip thì bảng chỉ còn Task khớp; chip đang bật báo trạng thái bật cho công nghệ hỗ trợ.
- [ ] Màn Việc của tôi: chip có số 0 vẫn hiện kèm "(0)", không bị vô hiệu, bấm vào thì bật và bảng báo "Không có Task khớp bộ lọc".
- [ ] Màn Việc của tôi: dòng "Hiện X trên Y Task" chỉ hiện khi đang lọc; lọc ra rỗng thì có "Không có Task khớp bộ lọc", bấm "Xoá bộ lọc" hiện lại đủ Task và ô tìm trống.
- [ ] Màn Chờ tôi duyệt: có ô tìm, nhóm chip Mức ưu tiên và chip Trễ hạn, không có chip trạng thái nào (Mới, Đang làm...); tìm và lọc hoạt động như Việc của tôi.
- [ ] Mở một Task trong Ngăn trượt rồi đóng thì ô tìm và chip vẫn giữ; chuyển trạng thái Task trong ngăn thì danh sách và số trên chip cập nhật mà bộ lọc vẫn giữ.
- [ ] Người chưa có Task thấy trạng thái trống như trước và không có ô tìm; đang tải và lỗi cũng không có ô tìm.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test`, không cần mạng (kể cả localhost), DB hay file ngoài repo, không đọc đồng hồ thật (thời điểm truyền vào); luật có test theo bảng ca; test giao diện dùng bản bộ nhớ của Kho dữ liệu, khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi `package.json` hay lockfile, không sửa hook của repo. `npm run typecheck` và `npm run lint` sạch.
