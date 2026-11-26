# 02: Trang Tổng quan mới

**What to build:** Trang Tổng quan thành chỗ nắm tổng thể, chỉ tính trong các Dự án người gọi được xem. Ba tầng: (1) hàng ô số Dự án đang hoạt động, Task đang mở, Task Trễ hạn, Chờ tôi duyệt, Việc của tôi; bấm ô Chờ tôi duyệt hoặc Việc của tôi tới đúng trang đó. (2) Hai cột: bảng Dự án đang hoạt động kèm Tiến độ và số Task Trễ hạn (bấm dòng mở Dự án) · danh sách Task Trễ hạn (trễ lâu nhất trước) và Task tới hạn trong 7 ngày, mỗi dòng có tên Dự án, Người thực hiện, hạn. (3) Phân bố Task theo trạng thái: mỗi trạng thái một dòng có số và thanh tiến độ của Astryx, không thư viện biểu đồ. "Task đang mở" là Task chưa Hoàn thành, chưa Huỷ, thuộc Dự án đang hoạt động; Task của Dự án đã Lưu trữ không tính ở đâu trên trang. "Tới hạn trong 7 ngày" là Task đang mở có hạn từ hôm nay đến hết ngày thứ bảy kể từ hôm nay theo giờ Việt Nam, không gồm Task đã Trễ hạn. Bảng Dự án đã Lưu trữ rời khỏi Tổng quan (vẫn xem ở Tất cả Dự án). Mọi số liệu tính bởi một hàm thuần nhận dữ liệu và ngày hôm nay; Kho dữ liệu cung cấp dữ liệu qua lệnh tổng quan hiện có (mở rộng, không thêm lệnh song song). Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 9–18, mục Trang Tổng quan).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Hàm thuần trả đúng năm ô số với dữ liệu dựng sẵn gồm Dự án hoạt động và Lưu trữ, Task ở mọi trạng thái; Task của Dự án Lưu trữ không được tính.
- [ ] Danh sách Task Trễ hạn xếp trễ lâu nhất trước; danh sách tới hạn trong 7 ngày gồm Task hạn hôm nay và hạn ngày thứ bảy, không gồm Task hạn ngày thứ tám, Task đã Trễ hạn, Task Hoàn thành hoặc Huỷ (ngày hôm nay truyền vào, mốc theo giờ Việt Nam).
- [ ] Phân bố theo trạng thái đếm đúng từng trạng thái của Task thuộc Dự án đang hoạt động.
- [ ] Kho dữ liệu trả dữ liệu Tổng quan đã áp quyền xem: PM thấy mọi Dự án; Support và Thành viên chỉ thấy Dự án mình ở trong (thêm vào bộ test hợp đồng).
- [ ] Màn Tổng quan hiện năm ô số, bảng Dự án đang hoạt động kèm Tiến độ và số Trễ hạn, hai danh sách Task, phân bố theo trạng thái; không còn bảng Dự án đã Lưu trữ.
- [ ] Bấm ô Chờ tôi duyệt hoặc Việc của tôi mở đúng trang tương ứng; bấm dòng Dự án mở Dự án đó.
- [ ] Màn có trạng thái trống (chưa ở Dự án nào, PM và Support thấy nút tạo Dự án), đang tải, lỗi có nút Thử lại.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
