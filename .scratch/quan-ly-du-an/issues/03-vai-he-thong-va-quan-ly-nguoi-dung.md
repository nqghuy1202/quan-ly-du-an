# 03: Vai hệ thống và màn quản lý người dùng của PM

**What to build:** PM mở màn Người dùng thấy mọi tài khoản (tên, email, vai) và đổi vai giữa PM, Support và Thành viên. Support và Thành viên không thấy màn này và không đổi được vai của ai, kể cả của chính mình. Hệ thống luôn giữ ít nhất một PM. Bản cài bộ nhớ có cách tạo sẵn một PM ban đầu cho dev và test; ngoài đời thật PM đầu tiên do chủ dự án tự đặt trên Supabase, nên cách tạo sẵn này không phải đường dùng thật.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] PM liệt kê được mọi tài khoản với tên, email và vai; Support và Thành viên gọi lệnh này trả lỗi `KHONG_CO_QUYEN`.
- [ ] PM đổi vai của một tài khoản sang PM, Support hoặc Thành viên và vai mới có hiệu lực ngay ở lần đọc sau.
- [ ] Support hoặc Thành viên đổi vai bất kỳ ai, kể cả tự nâng vai mình, trả lỗi `KHONG_CO_QUYEN` và vai không đổi.
- [ ] Hạ PM cuối cùng (kể cả PM tự hạ mình) trả lỗi `PHAI_CON_PM` và vai không đổi; khi còn PM khác thì hạ được.
- [ ] Giao diện ẩn mục Người dùng với người không phải PM; khi bị từ chối thì hiện lý do bằng tiếng Việt.
- [ ] Màn Người dùng dựng từ Astryx, đủ trạng thái trống, đang tải và lỗi.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
