# 10: Bản Supabase cho Task

**What to build:** Bản cài Supabase của Kho dữ liệu cho mọi lệnh Task của ticket 07 đến 09: tạo, sửa, đổi người, xem danh sách và chi tiết. Ticket này chỉ **viết file migration** (bảng mới, kèm down), không áp lên Supabase thật. Phân quyền từng dòng và các ràng buộc của cơ sở dữ liệu phải ép cùng bộ luật với bản bộ nhớ, vì trình duyệt không đáng tin. **Cổng chưa kiểm được** SQL và phân quyền từng dòng; người duyệt cần đọc kỹ SQL và chạy tay bảng ca dùng chung trên Supabase thật.

**Blocked by:** 06, 07, 08

**Status:** ready-for-agent

- [ ] Migration tạo bảng Task kèm migration down; bật phân quyền từng dòng: người trong Dự án (và PM) đọc được Task của Dự án, người ngoài thì không; ghi chỉ cho PM hoặc Support của Dự án.
- [ ] Ràng buộc ở cơ sở dữ liệu: Người thực hiện và Người kiểm tra khác nhau; cả hai thuộc Dự án của Task; tiêu đề đúng giới hạn; Task ở trạng thái cuối không sửa được; dấu vết do cơ sở dữ liệu đặt, không lấy từ tham số của client.
- [ ] Không vai nào ghi thẳng được cột trạng thái và cột số lần bị Trả lại; chúng chỉ đổi qua hàm của ticket 14. Task mới luôn bắt đầu ở Mới với số lần Trả lại bằng 0.
- [ ] Bản cài Supabase của Kho dữ liệu cài đủ các lệnh Task của ticket 07, 08 và 09 (kể cả "Việc của tôi" và "Chờ tôi duyệt").
- [ ] Bộ test hợp đồng và bảng ca dùng chung (phần Task) chạy được với bản Supabase khi có cấu hình test; thiếu cấu hình thì tự bỏ qua và báo rõ là "chưa kiểm".
- [ ] Ghi rõ những gì cổng không kiểm và việc chủ dự án phải làm tay (áp migration, chạy bảng ca trên Supabase thật).
- [ ] Có test tự động cho mọi phần cổng kiểm được, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
