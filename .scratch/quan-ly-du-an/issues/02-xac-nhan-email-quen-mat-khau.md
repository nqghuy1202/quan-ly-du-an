# 02: Xác nhận email và quên mật khẩu

**What to build:** Tài khoản mới đăng ký phải xác nhận email trước khi đăng nhập được; chưa xác nhận thì đăng nhập bị từ chối và có cách gửi lại thư xác nhận. Người quên mật khẩu yêu cầu đặt lại bằng email, nhận mã dùng một lần có thời hạn, rồi đặt mật khẩu mới. Bản cài bộ nhớ không gửi thư thật: nó có một bước xác nhận mô phỏng thay cho việc bấm đường dẫn trong thư. Ticket này sửa hành vi "đăng ký xong đăng nhập được ngay" của ticket 01, nên các test cũ của ticket 01 được cập nhật theo.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Đăng ký xong tài khoản ở trạng thái chưa xác nhận; đăng nhập trả lỗi có mã `EMAIL_CHUA_XAC_NHAN` và hiện cách gửi lại thư xác nhận.
- [ ] Sau khi xác nhận (qua bước mô phỏng của bản cài bộ nhớ) đăng nhập được; xác nhận lần hai hoặc xác nhận email không tồn tại không gây lỗi lộ thông tin và không đổi gì.
- [ ] Yêu cầu đặt lại mật khẩu luôn trả cùng một thông báo dù email có tài khoản hay không.
- [ ] Mã đặt lại chỉ dùng được một lần và hết hạn theo thời hạn cấu hình tính bằng đồng hồ truyền vào; mã đã dùng hoặc hết hạn trả lỗi có mã.
- [ ] Mã hợp lệ cùng mật khẩu mới (ít nhất 8 ký tự) thì đăng nhập được bằng mật khẩu mới và mật khẩu cũ không còn dùng được.
- [ ] Có màn chờ xác nhận, màn gửi lại, màn quên mật khẩu và màn đặt lại, mỗi màn đủ trạng thái trống, đang tải và lỗi, dựng từ Astryx theo luật của dự án.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
