# 01: Tổng quan xếp dọc một cột

**What to build:** Trang Tổng quan bỏ lưới hai cột. Các vùng xếp trong một cột, mỗi bảng chiếm hết chiều ngang vùng nội dung, theo thứ tự: hàng ô số, Task Trễ hạn, Task tới hạn trong 7 ngày, Dự án đang hoạt động, Phân bố Task theo trạng thái. Vùng Task Trễ hạn hoặc tới hạn không có Task thì giữ tiêu đề và mô tả, bên dưới chỉ một dòng chữ báo trống (giữ chữ hiện nay), không dựng bảng rỗng có đầu cột. Mỗi vùng Task hiện tối đa 5 dòng đầu theo thứ tự hiện có; nhiều hơn thì dưới bảng có nút "Xem tất cả (N)" (N là tổng số Task của vùng), bấm thì vùng đó hiện đủ ngay tại chỗ và nút biến mất, vùng kia không đổi; rời trang rồi quay lại thì về 5 dòng; không có nút thu gọn. Lệnh đọc Tổng quan, hàng ô số, bấm ô số, bấm dòng Dự án, mở Task trong Ngăn trượt, nút Tạo Dự án, trạng thái đang tải, lỗi và trống giữ nguyên. Chỉ đổi giao diện: không đổi Kho dữ liệu, không migration. Dựng bằng component Astryx (đọc `astryx docs layout` trước khi đổi khung). Spec: `.scratch/sap-xep-giao-dien/spec.md` (story 1–12d).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Khi có đủ dữ liệu, các tiêu đề vùng xuất hiện trong tài liệu theo đúng thứ tự: Task Trễ hạn, Task tới hạn trong 7 ngày, Dự án đang hoạt động, Phân bố Task theo trạng thái; hàng ô số đứng trước cả bốn.
- [ ] Không có Task Trễ hạn thì vùng Task Trễ hạn có tiêu đề và dòng "Không có Task Trễ hạn.", và trong vùng đó không có bảng.
- [ ] Không có Task tới hạn trong 7 ngày thì vùng đó có tiêu đề và dòng báo trống tương ứng, và trong vùng đó không có bảng.
- [ ] Có Task Trễ hạn thì vùng đó vẫn hiện bảng như trước (Task, Dự án, Người thực hiện, hạn) và bấm Task vẫn mở Ngăn trượt.
- [ ] Vùng Task Trễ hạn có 7 Task thì chỉ hiện 5 Task đầu và nút "Xem tất cả (7)"; bấm nút thì hiện đủ 7 Task và nút biến mất, vùng Task tới hạn không đổi.
- [ ] Vùng có đúng 5 Task hoặc ít hơn thì hiện đủ và không có nút "Xem tất cả"; vùng Task tới hạn trong 7 ngày cũng theo đúng luật 5 dòng này.
- [ ] Mọi test Tổng quan hiện có vẫn xanh (ô số, quyền xem theo vai, Dự án Lưu trữ không tính, đang tải, lỗi kèm Thử lại, trống, bấm ô số và dòng Dự án).
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test`, không cần mạng (kể cả localhost), DB hay file ngoài repo, không đọc đồng hồ thật; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không kiểm bố cục theo điểm ảnh; không đổi `package.json` hay lockfile, không sửa hook của repo. `npm run typecheck` và `npm run lint` sạch.
