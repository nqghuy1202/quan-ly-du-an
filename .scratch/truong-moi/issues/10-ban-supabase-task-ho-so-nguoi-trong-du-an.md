# 10: Bản Supabase: Task, hồ sơ và Người trong dự án

**What to build:** Bản Supabase của Kho dữ liệu đọc và ghi Mức ưu tiên của Task (kèm dòng lịch sử đổi mức, ghi ở phía cơ sở dữ liệu), Thông tin nhân sự của hồ sơ (Số điện thoại, Chức danh, Phòng ban), Vai trò trong Dự án và số Task đang giữ của Người trong dự án, khớp với bản bộ nhớ. Thêm migration lên và xuống tương ứng: Task có sẵn nhận Mức ưu tiên Trung bình; quyền xem Thông tin nhân sự ép ở phía cơ sở dữ liệu (chính chủ, PM, Support, người cùng ít nhất một Dự án); chỉ chính chủ sửa Thông tin nhân sự; chỉ PM và Support của Dự án sửa Vai trò trong Dự án và Mức ưu tiên của Task. Phần cổng không kiểm được chủ dự án áp và kiểm tay. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (mục Bản Supabase).

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] Test của bản Supabase (client giả) cho thấy tạo Task, đổi Mức ưu tiên, sửa hồ sơ, thêm người kèm vai trò, sửa vai trò, đọc Người trong dự án gửi và nhận đủ trường mới và đổi lỗi của cơ sở dữ liệu thành đúng lỗi có mã như bản bộ nhớ.
- [ ] Ba trường Thông tin nhân sự không đủ quyền xem thì bản Supabase trả về trống, giống bản bộ nhớ.
- [ ] Có migration lên và migration xuống cùng tên; bộ test hợp đồng và bảng ca trên Supabase thật (chạy tay) có ca cho các trường và quyền mới.
- [ ] Có test tự động cho từng tiêu chí kiểm được ở trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
