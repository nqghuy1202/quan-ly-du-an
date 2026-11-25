# 07: Tạo Task và giao việc

**What to build:** PM hoặc Support của Dự án tạo Task trong Dự án: tiêu đề, mô tả, hạn tuỳ chọn (một ngày, không có giờ), một Người thực hiện và một Người kiểm tra. Cả hai bắt buộc, phải đang ở trong Dự án và phải là hai người khác nhau. Task mới có trạng thái Mới và số lần bị Trả lại bằng 0. Mọi người trong dự án xem được danh sách Task và chi tiết Task kèm dấu vết (người tạo, ngày tạo, người chỉnh sửa gần nhất, ngày chỉnh sửa gần nhất). Người ngoài Dự án không thấy Task của Dự án đó. Danh sách ở ticket này là bảng đơn giản; bảng Kanban làm ở ticket 09.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] PM hoặc Support của Dự án tạo Task với tiêu đề bắt buộc (không rỗng, không chỉ khoảng trắng, tối đa 200 ký tự), mô tả tuỳ chọn, hạn tuỳ chọn là một ngày hợp lệ (ngày đã qua vẫn cho tạo); Task mới ở trạng thái Mới, số lần bị Trả lại là 0.
- [ ] Thiếu Người thực hiện hoặc Người kiểm tra trả lỗi có mã `THIEU_NGUOI`; người được chọn không ở trong Dự án trả lỗi `NGUOI_NGOAI_DU_AN`; cùng một người ở cả hai vai trả lỗi `TRUNG_NGUOI`. Không tạo gì khi có lỗi.
- [ ] Thành viên (kể cả khi sẽ là Người thực hiện), Support không ở trong Dự án và người ngoài Dự án tạo Task trả lỗi `KHONG_CO_QUYEN`; Dự án đã Lưu trữ trả lỗi `DU_AN_DA_LUU_TRU`.
- [ ] Mọi người trong dự án xem được danh sách và chi tiết Task của Dự án, kèm dấu vết; người ngoài Dự án nhận lỗi không tìm thấy; Task của Dự án này không xuất hiện trong Dự án khác.
- [ ] Có form tạo Task trong trang Dự án và màn chi tiết Task, dựng từ Astryx, đủ trạng thái trống, đang tải và lỗi; người dùng không có quyền không thấy nút tạo, kèm lý do.
- [ ] Bộ test hợp đồng của Kho dữ liệu được mở rộng cho Task và bảng ca dùng chung của ticket 05 thêm các dòng quyền của Task.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
