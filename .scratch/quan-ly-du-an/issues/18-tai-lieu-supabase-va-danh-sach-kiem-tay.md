# 18: Tài liệu: hướng dẫn Supabase và danh sách kiểm tay RLS

**What to build:** Chủ dự án đọc xong tài liệu là chạy thử được ứng dụng trên máy, dựng được Supabase từng bước, và biết chính xác phải kiểm gì bằng tay trước khi đưa ứng dụng lên mạng. Tài liệu gồm: README (mục đích, các màn, cách chạy thử với bản bộ nhớ, các lệnh của dự án, kiến trúc gồm Kho dữ liệu, Cổng GitHub và bảng ca dùng chung); hướng dẫn thiết lập Supabase theo thứ tự (tạo project, bật đăng ký email có xác nhận, áp các migration theo thứ tự, đặt vai PM đầu tiên, tạo token GitHub chỉ đọc, đặt secret, triển khai Edge Function); và **danh sách kiểm tay bắt buộc** vì đăng ký đang mở nên phân quyền từng dòng là hàng rào duy nhất. Tài liệu nói rõ phần nào cổng test không kiểm được. Từ vựng mới phát sinh được thêm vào bảng thuật ngữ của dự án.

**Blocked by:** 14, 17

**Status:** ready-for-agent

- [ ] README mô tả mục đích, ba vai, các màn chính, cách chạy thử bằng bản bộ nhớ và danh sách lệnh; mọi lệnh được nhắc đến đều có trong danh sách lệnh của dự án (test đối chiếu tài liệu với danh sách lệnh).
- [ ] Hướng dẫn Supabase đi đủ các bước theo thứ tự: tạo project, bật đăng ký email có xác nhận, áp các migration theo thứ tự, đặt vai PM đầu tiên, tạo token GitHub chỉ đọc, đặt secret, triển khai Edge Function; mỗi bước nói rõ ai làm và kiểm kết quả thế nào.
- [ ] Danh sách kiểm tay có đủ bảy mục: người lạ vừa đăng ký không đọc được gì của ai ngoài hồ sơ của mình; Thành viên không sửa được Dự án hay Task của người khác và không tự nâng vai; người ngoài Dự án không đọc và không ghi được Task của Dự án đó; không ghi thẳng được cột trạng thái và mọi lần đổi đi qua hàm kiểm luật; Người kiểm tra trùng Người thực hiện bị từ chối ở cơ sở dữ liệu; chạy toàn bộ bảng ca dùng chung trên Supabase thật và đạt; Edge Function từ chối người chưa đăng nhập và repo chưa gắn. Mỗi mục có cách kiểm cụ thể và kết quả mong đợi (test đếm đủ bảy mục).
- [ ] Tài liệu liệt kê rõ phần cổng test không kiểm được: bản Supabase, migration, phân quyền từng dòng, hàm cơ sở dữ liệu, Edge Function với GitHub thật, luồng email; và nói rằng chưa kiểm xong danh sách thì chưa đưa lên mạng.
- [ ] Bảng thuật ngữ của dự án có đủ các từ của spec (Dự án, Task, Người thực hiện, Người kiểm tra, Người trong dự án, PM, Support, Thành viên, Chờ duyệt, Hoàn thành, Trả lại, Bị lỗi, Huỷ, Lưu trữ, Dấu vết, Tiến độ, Trễ hạn) và các văn bản giao diện dùng đúng các từ này.
- [ ] Có test tự động cho từng tiêu chí kiểm được ở trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
