# 07: Tìm và lọc Dự án

**What to build:** Trang Dự án của tôi và Tất cả Dự án hiện bảng với các cột: Mã, Tên, Khách hàng, Người phụ trách, Mức ưu tiên, Ngày kết thúc dự kiến, Tiến độ, Trễ hạn (số Task Trễ hạn). Có ô tìm theo tên hoặc Mã Dự án, bỏ qua hoa thường và dấu tiếng Việt. Có bộ lọc theo Mức ưu tiên, Người phụ trách, tình trạng (đang hoạt động, Lưu trữ, Quá hạn dự kiến); các bộ lọc kết hợp được. Không Dự án nào khớp thì hiện trạng thái trống có nút bỏ lọc. Tìm và lọc là hàm thuần chạy trên danh sách đã đọc. Kho dữ liệu trả danh sách Dự án kèm đủ trường mới, Tiến độ, số Trễ hạn và cờ Quá hạn dự kiến trong một lần đọc. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 74–77).

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Hàm tìm khớp "ha noi" với Dự án tên "Hà Nội", khớp "sdv" với Mã `SDV-012`.
- [ ] Lọc Mức ưu tiên Cao, lọc theo một Người phụ trách, lọc tình trạng Quá hạn dự kiến đều đúng; kết hợp tìm với hai bộ lọc cho giao đúng.
- [ ] Danh sách Dự án từ Kho dữ liệu có Tiến độ, số Trễ hạn, cờ Quá hạn dự kiến đúng với ngày hôm nay truyền vào (bộ test hợp đồng).
- [ ] Bảng Dự án hiện đủ tám cột; gõ ô tìm và chọn bộ lọc làm bảng chỉ còn Dự án khớp.
- [ ] Không có Dự án khớp thì hiện trạng thái trống và nút bỏ lọc; bấm nút hiện lại toàn bộ.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
