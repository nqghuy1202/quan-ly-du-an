# 01: Theme SDVICO sáng và tối, mặc định sáng

**What to build:** Ứng dụng đổi sang theme màu của SDVICO: nền sáng, nút chính xanh navy xấp xỉ `#0B3865`, điểm nhấn xanh ngọc xấp xỉ `#0FAEBD`, nền sáng xấp xỉ `#F5F7F9`, chữ chính xấp xỉ `#0D1A26`, theo spec của tính năng này (thư mục `.scratch` của repo). Có sẵn chế độ tối theo bảng màu tối của website (nền navy rất đậm, chữ xám nhạt, màu chính chuyển sang xanh ngọc). Ứng dụng mở ra ở chế độ sáng. Dựng bằng trình soạn theme của Astryx (một theme mới tên `sdvico` kế thừa theme trung tính) rồi nối vào ứng dụng bằng lệnh nạp theme của Astryx, không viết đè màu rải rác. Không đổi bố cục, chữ, luồng hay luật nghiệp vụ. Màu trạng thái (thành công, cảnh báo, lỗi, thông tin) giữ riêng, không trùng màu chính. Xanh ngọc gốc trên nền trắng chỉ đạt tương phản khoảng 2,7 trên 1 nên chỉ dùng để trang trí; viền focus ở chế độ sáng và mọi chữ phải dùng sắc đủ đậm để đạt ngưỡng tương phản. Phần kiểm tay (cổng không kiểm được, chủ dự án làm sau khi ticket xong, không thuộc việc của agent): mở ứng dụng ở cả hai chế độ, so với sdvico.vn, xem các màn đăng nhập, Dự án của tôi, Kanban, Tổng quan, chi tiết Task, hộp nhập lý do.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Có theme tên `sdvico` với chế độ sáng và chế độ tối; màu chính, màu nhấn, nền và chữ của từng chế độ nằm trong sai số quanh bảng màu của spec (mỗi kênh đỏ, lục, lam lệch tối đa 12 so với giá trị đề xuất khi giá trị đó là màu gốc đã đặt, và cùng họ màu khi là sắc do trình soạn theme sinh ra), kiểm bằng cách đọc giá trị màu từ theme đã dựng.
- [ ] Ứng dụng mặc định dùng theme `sdvico` ở chế độ sáng: hiển thị ứng dụng không truyền tuỳ chọn nào thì theme đang dùng là `sdvico` và chế độ là sáng.
- [ ] Chuyển sang chế độ tối dùng bảng màu tối của theme `sdvico` (không rơi về màu của theme trung tính).
- [ ] Tương phản ở cả hai chế độ, tính bằng hàm thuần trong test: chữ chính trên nền, chữ phụ trên nền, chữ trên nút chính đạt ít nhất 4,5 trên 1; viền focus so với nền kề, viền ô nhập và biểu tượng đạt ít nhất 3 trên 1.
- [ ] Màu chính khác rõ rệt các màu trạng thái cảnh báo và lỗi (khoảng cách màu đủ lớn để cờ Trễ hạn và trạng thái Bị lỗi không bị lẫn với nút chính), kiểm bằng cách so các giá trị màu của theme.
- [ ] Không có mã màu hex, giá trị `px` rời hay `outline: none` trong mã giao diện của ứng dụng (test quét mã bổ sung cho ESLint), và `npm run lint` sạch.
- [ ] Mọi test hiện có của ứng dụng vẫn xanh sau khi đổi theme (không phải sửa luật hay hành vi để chúng qua; chỉ được sửa những chỗ test ghim cứng theme cũ).
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc (`package.json`, lockfile), không sửa hook của repo.
