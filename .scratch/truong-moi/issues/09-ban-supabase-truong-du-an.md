# 09: Bản Supabase: trường mới của Dự án

**What to build:** Bản Supabase của Kho dữ liệu đọc và ghi Mã Dự án, Khách hàng, Ngày bắt đầu, Ngày kết thúc dự kiến, Mức ưu tiên, Người phụ trách, khớp với bản bộ nhớ. Thêm migration lên và migration xuống tương ứng: thêm cột; gán cho Dự án có sẵn mã tạm `DA-001`, `DA-002`… theo thứ tự ngày tạo và Mức ưu tiên Trung bình; ràng buộc Mã duy nhất không phân biệt hoa thường; ràng buộc Ngày kết thúc dự kiến không trước Ngày bắt đầu; Người phụ trách phải là Người trong dự án và về trống khi người đó bị gỡ; chỉ PM và Support của Dự án ghi được các trường này (phân quyền từng dòng hoặc hàm cơ sở dữ liệu). Phần cổng không kiểm được (migration, phân quyền từng dòng, chạy trên Supabase thật) chủ dự án áp và kiểm tay, ghi rõ trong tài liệu Supabase. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (mục Bản Supabase).

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Test của bản Supabase (dùng client giả như các test bản Supabase hiện có) cho thấy tạo, sửa, đọc Dự án gửi và nhận đủ sáu trường mới, và đổi lỗi trùng Mã, lỗi sai thứ tự ngày, lỗi Người phụ trách ngoài Dự án của cơ sở dữ liệu thành đúng lỗi có mã như bản bộ nhớ.
- [ ] Có migration lên và migration xuống cùng tên cho nhóm trường này; tài liệu Supabase ghi rằng migration gán mã tạm `DA-…` và ghi các mục chủ dự án phải kiểm tay.
- [ ] Không có test nào gọi Supabase thật trong lệnh test của repo; bộ test hợp đồng trên Supabase thật (chạy tay) có ca cho các trường mới.
- [ ] Có test tự động cho từng tiêu chí kiểm được ở trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
