# 17: Bản Supabase cho GitHub và Edge Function đọc GitHub

**What to build:** Bản cài Supabase cho repo của Dự án và link của Task, cùng một Edge Function đọc GitHub thay cho bản giả của Cổng GitHub. Hàm chỉ phục vụ người đã đăng nhập, chỉ đọc repo đã gắn vào một Dự án mà người đó thấy được, dùng token GitHub chỉ đọc đặt trong secret của Supabase, chỉ gửi yêu cầu đọc, và trả trạng thái đã chuẩn hoá bằng đúng hàm chuyển đổi thuần của ticket 15. Token không bao giờ nằm trong mã nguồn, cơ sở dữ liệu, gói gửi trình duyệt hay nội dung lỗi. Ticket này chỉ **viết file migration và mã của hàm**, không triển khai và không đặt secret: đó là việc của chủ dự án. **Cổng chưa kiểm được** việc hàm chạy thật và GitHub thật. Hàm chạy trên môi trường khác với ứng dụng: hàm chuyển đổi dùng chung phải chỉ có một bản; nếu không chia sẻ được giữa hai môi trường thì dừng và báo, không sao chép tay.

**Blocked by:** 10, 15, 16

**Status:** ready-for-agent

- [ ] Migration tạo bảng repo của Dự án và bảng link của Task kèm migration down; phân quyền từng dòng theo cùng luật với bản bộ nhớ: người trong dự án đọc, PM hoặc Support của Dự án gắn và gỡ repo, người trong dự án thêm và gỡ link, người ngoài không thấy gì.
- [ ] Bản cài Supabase của Kho dữ liệu cài đủ các lệnh repo của ticket 15 và link của ticket 16.
- [ ] Edge Function từ chối người chưa đăng nhập và từ chối repo chưa gắn vào Dự án nào mà người gọi thấy được; không có đường nào trong hàm gửi yêu cầu ghi lên GitHub.
- [ ] Hàm trả trạng thái và mã lỗi giống hệt bản giả của Cổng GitHub (không tìm thấy, không đọc được vì riêng tư, hết lượt gọi, mất mạng, dữ liệu lạ), qua đúng hàm chuyển đổi thuần của ticket 15.
- [ ] Phản hồi và thông báo lỗi của hàm không bao giờ chứa token (test với token giả), và token chỉ được đọc từ secret của môi trường hàm, không có trong mã, trong cấu hình gửi trình duyệt hay trong cơ sở dữ liệu.
- [ ] Bản cài Cổng GitHub gọi hàm; ứng dụng chọn bản gọi hàm hoặc bản giả theo cấu hình môi trường; chưa cấu hình thì cổng trả lỗi `GITHUB_KHONG_KHA_DUNG` thay vì chết.
- [ ] Bộ test hợp đồng của repo và link chạy được với bản Supabase khi có cấu hình test; thiếu cấu hình thì tự bỏ qua và báo rõ là "chưa kiểm".
- [ ] Ghi rõ những gì cổng không kiểm và việc chủ dự án phải làm tay (tạo token chỉ đọc, đặt secret, triển khai hàm, áp migration).
- [ ] Có test tự động cho mọi phần cổng kiểm được (lôgic của hàm với đầu vào giả, không lộ token, chọn bản cài theo cấu hình), chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
