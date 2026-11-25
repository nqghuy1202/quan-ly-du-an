# 14: Bản Supabase cho vòng duyệt (hàm chuyển trạng thái, lịch sử)

**What to build:** Bản cài Supabase của lệnh chuyển trạng thái, lịch sử trạng thái và các truy vấn cho Tiến độ và Trễ hạn. Việc đổi trạng thái đi qua một hàm duy nhất ở cơ sở dữ liệu: nó lấy người gọi từ phiên đăng nhập (không tin tham số do client gửi), áp ma trận của spec y như luật thuần, ghi lịch sử và tăng bộ đếm Trả lại trong cùng một giao dịch. Ticket này chỉ **viết file migration** (kèm down), không áp lên Supabase thật. **Cổng chưa kiểm được** hàm này; bảng ca dùng chung là cầu nối giữ luật thuần và hàm cơ sở dữ liệu khớp nhau, và chủ dự án chạy nó tay trên Supabase thật. Người duyệt cần đọc kỹ SQL.

**Blocked by:** 10, 11

**Status:** ready-for-agent

- [ ] Migration tạo bảng lịch sử trạng thái và hàm chuyển trạng thái, kèm migration down; bảng lịch sử đọc được theo quyền của Dự án và chỉ ghi được qua hàm, không ghi trực tiếp.
- [ ] Hàm lấy người gọi từ phiên, áp đúng ma trận, đúng yêu cầu lý do, đúng luật trạng thái cuối và Người kiểm tra khác Người thực hiện, ghi lịch sử và tăng bộ đếm Trả lại trong cùng giao dịch; lỗi trả về cùng bộ mã lỗi với bản bộ nhớ.
- [ ] Bản cài Supabase của Kho dữ liệu cài lệnh chuyển trạng thái, đọc lịch sử và các truy vấn cần cho Tiến độ và Trễ hạn; hàm tính Tiến độ và Trễ hạn dùng đúng hàm thuần của ticket 13, không viết lại luật.
- [ ] Bảng ca dùng chung của ticket 05 và 11 chạy được với bản Supabase khi có cấu hình test; thiếu cấu hình thì tự bỏ qua và báo rõ là "chưa kiểm".
- [ ] Có lệnh riêng (không nằm trong lệnh test mặc định) để chủ dự án chạy toàn bộ bảng ca trên Supabase thật.
- [ ] Ghi rõ những gì cổng không kiểm và việc chủ dự án phải làm tay.
- [ ] Có test tự động cho mọi phần cổng kiểm được (bản Supabase tự bỏ qua đúng, mã lỗi khớp với bản bộ nhớ), chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
