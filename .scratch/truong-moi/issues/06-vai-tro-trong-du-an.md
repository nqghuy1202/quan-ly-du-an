# 06: Vai trò trong Dự án và bảng Người trong dự án

**What to build:** Mỗi Người trong dự án có **Vai trò trong Dự án**: chữ tự do tối đa 60 ký tự, không đổi quyền. PM hoặc Support của Dự án nhập khi thêm người (tuỳ chọn) và sửa sau; Thành viên không sửa được; Dự án đã Lưu trữ thì từ chối. Tab Người trong dự án hiện bảng: tên, Vai trò trong Dự án, Chức danh, Số điện thoại (đã áp quyền xem Thông tin nhân sự), số Task đang giữ (Task chưa Hoàn thành, chưa Huỷ mà người đó là Người thực hiện). Kho dữ liệu trả các thông tin này trong danh sách Người trong dự án. Chỉ luật, bản bộ nhớ, bộ test hợp đồng, bảng ca quyền, giao diện. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 69–72). Thêm từ Vai trò trong Dự án vào `GLOSSARY.md`.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Thêm người kèm Vai trò trong Dự án lưu đúng; thêm không kèm vai trò vẫn được.
- [ ] PM và Support của Dự án sửa được Vai trò trong Dự án; Thành viên, Support ngoài Dự án, Dự án đã Lưu trữ bị từ chối (bảng ca quyền và bộ test hợp đồng); vai trò dài hơn 60 ký tự bị từ chối.
- [ ] Danh sách Người trong dự án trả số Task đang giữ đúng: không tính Task Hoàn thành, Huỷ, hay Task người đó chỉ là Người kiểm tra.
- [ ] Danh sách Người trong dự án trả Thông tin nhân sự đã áp quyền xem.
- [ ] Bảng ở tab Người trong dự án có đủ năm cột; PM hoặc Support sửa được vai trò ngay trên tab; Thành viên không thấy chỗ sửa.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
