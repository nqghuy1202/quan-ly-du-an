# 11: Tài liệu Supabase và danh sách kiểm tay cho trường mới

**What to build:** Tài liệu Supabase của repo có đủ hướng dẫn cho chủ dự án: thứ tự áp hai migration mới, cách quay lại bằng migration xuống, việc sửa mã tạm `DA-…` thành mã thật, và các mục mới trong Danh sách kiểm tay: quyền xem Thông tin nhân sự theo từng dòng (Thành viên không cùng Dự án không đọc được), trùng Mã Dự án khác hoa thường bị từ chối, Người phụ trách về trống khi bị gỡ, Thành viên không đổi được Mức ưu tiên của Task. `GLOSSARY.md` có đủ các từ mới của spec. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (mục Việc của chủ dự án).

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] Test tài liệu hiện có của repo được mở rộng để kiểm tài liệu Supabase nhắc đủ hai migration mới và bốn mục kiểm tay mới.
- [ ] `GLOSSARY.md` có đủ các từ: Mã Dự án, Khách hàng, Người phụ trách, Mức ưu tiên, Quá hạn dự kiến, Vai trò trong Dự án, Thông tin nhân sự, Tổng quan, Thanh bên, Ngăn trượt (có test kiểm).
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
