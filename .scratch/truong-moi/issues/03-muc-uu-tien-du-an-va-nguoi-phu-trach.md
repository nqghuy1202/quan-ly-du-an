# 03: Mức ưu tiên của Dự án và Người phụ trách

**What to build:** Dự án có **Mức ưu tiên** (Thấp, Trung bình, Cao; mặc định Trung bình) và **Người phụ trách** (tuỳ chọn). PM hoặc Support của Dự án chọn Người phụ trách từ danh sách Người trong dự án, hoặc để trống; không chọn được người ngoài Dự án. Người phụ trách chỉ để hiển thị và lọc, không có thêm quyền. Gỡ người đó khỏi Dự án thì Người phụ trách về trống trong cùng lệnh gỡ. Mức ưu tiên hiển thị bằng chữ kèm màu, không dùng riêng màu. Cả hai hiện ở dải tóm tắt; sửa cập nhật Dấu vết; Dự án đã Lưu trữ không sửa được. Dữ liệu mẫu có cả hai trường. Chỉ luật, bản bộ nhớ, bộ test hợp đồng, bảng ca quyền, giao diện. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 45–48, 52). Thêm từ Mức ưu tiên, Người phụ trách vào `GLOSSARY.md`.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Dự án tạo không chọn Mức ưu tiên có mức Trung bình; mức ngoài ba giá trị bị từ chối.
- [ ] Đặt Người phụ trách là người ngoài Dự án bị từ chối với lỗi có mã; đặt là Người trong dự án thì thành công (bộ test hợp đồng).
- [ ] Gỡ Người phụ trách khỏi Dự án làm Người phụ trách về trống.
- [ ] Bảng ca quyền thêm ca đặt Người phụ trách: PM được, Support của Dự án được, Support ngoài Dự án và Thành viên bị từ chối; Dự án đã Lưu trữ bị từ chối.
- [ ] Thành viên là Người phụ trách không làm thêm được việc gì mà trước đó bị từ chối (vd sửa Dự án, tạo Task).
- [ ] Biểu mẫu Dự án có ô chọn Mức ưu tiên và ô chọn Người phụ trách chỉ liệt kê Người trong dự án; dải tóm tắt hiện cả hai.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
