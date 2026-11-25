# 06: Bản Supabase cho lát 1 (hồ sơ, vai, dự án, người trong dự án)

**What to build:** Bản cài Supabase của Kho dữ liệu cho mọi lệnh của lát 1: đăng ký, đăng nhập, xác nhận email, đặt lại mật khẩu (qua Supabase Auth), hồ sơ, vai hệ thống, Dự án và người trong dự án. Ứng dụng chọn bản cài theo cấu hình môi trường; không có cấu hình Supabase thì dùng bản bộ nhớ và chỉ để dev. Ticket này chỉ **viết file migration** (bảng mới, kèm down), không áp migration lên Supabase thật: việc đó và việc đặt PM đầu tiên là của chủ dự án. **Cổng chưa kiểm được** phần SQL, phân quyền từng dòng và Auth thật; người duyệt cần đọc kỹ SQL và chạy tay bảng ca dùng chung trên Supabase thật.

**Blocked by:** 02, 05

**Status:** ready-for-agent

- [ ] Migration tạo bảng cho hồ sơ, Dự án và người trong dự án, kèm migration down; bật phân quyền từng dòng cho cả ba bảng, mặc định không ai đọc được gì ngoài những gì policy cho phép.
- [ ] Phía cơ sở dữ liệu có sẵn các luật không thể tin client: hồ sơ tự tạo khi đăng ký với vai Thành viên; không ai tự đổi vai ngoài PM; luôn còn ít nhất một PM; người tạo, ngày tạo, người chỉnh sửa và ngày chỉnh sửa do cơ sở dữ liệu đặt, không lấy từ tham số của client.
- [ ] Bản cài Supabase của Kho dữ liệu cài đủ mọi lệnh của ticket 01 đến 05 và dùng Supabase Auth cho đăng ký, đăng nhập, xác nhận email và đặt lại mật khẩu.
- [ ] Ứng dụng chọn bản cài theo cấu hình môi trường; mã chạy trong trình duyệt chỉ nhận địa chỉ và khoá công khai, và cấu hình từ chối khoá có vai service (test bằng khoá giả).
- [ ] Bộ test hợp đồng và bảng ca dùng chung của ticket 01 và 05 chạy được với bản Supabase khi có cấu hình test; thiếu cấu hình thì tự bỏ qua và báo rõ là "chưa kiểm", không báo là đạt.
- [ ] Có một lệnh riêng (không nằm trong lệnh test mặc định) để chủ dự án chạy bộ test hợp đồng và bảng ca trên Supabase thật.
- [ ] Ghi trong tài liệu của ticket hoặc trong nội dung migration những gì cổng không kiểm và việc chủ dự án phải làm tay (áp migration, đặt PM đầu tiên).
- [ ] Có test tự động cho mọi phần cổng kiểm được (chọn bản cài theo cấu hình, từ chối khoá service, bản Supabase tự bỏ qua đúng), chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
