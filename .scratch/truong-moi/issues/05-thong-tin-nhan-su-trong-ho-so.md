# 05: Thông tin nhân sự trong Hồ sơ

**What to build:** Hồ sơ có **Số điện thoại**, **Chức danh**, **Phòng ban**, đều tuỳ chọn. Mỗi người tự sửa của mình ở trang Hồ sơ; PM không sửa hộ. Số điện thoại: bỏ khoảng trắng, dấu chấm, gạch nối; hợp lệ khi là 10 chữ số bắt đầu bằng 0, hoặc `+84` theo sau 9 chữ số; lưu dạng đã chuẩn hoá. Chức danh và Phòng ban tối đa 60 ký tự. Quyền xem ba trường: chính chủ, PM, Support, hoặc người cùng ít nhất một Dự án (kể cả Dự án đã Lưu trữ); không đủ quyền thì ba trường trả về trống, các trường khác không đổi. Trang Người dùng của PM thêm cột Chức danh và Phòng ban. Dữ liệu mẫu có Thông tin nhân sự. Chỉ luật, bản bộ nhớ, bộ test hợp đồng, bảng ca quyền, giao diện. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 64–68, 73). Thêm từ Thông tin nhân sự vào `GLOSSARY.md`.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Luật nhận `0901 234 567`, `0901.234.567`, `+84901234567` (lưu dạng chuẩn hoá) và từ chối 9 chữ số, 11 chữ số bắt đầu bằng 0, chữ cái, với thông báo tiếng Việt.
- [ ] Người dùng sửa được ba trường của chính mình; sửa hồ sơ người khác bị từ chối, kể cả PM (bộ test hợp đồng).
- [ ] Chức danh hoặc Phòng ban dài hơn 60 ký tự bị từ chối.
- [ ] Bảng ca quyền xem: chính chủ, PM, Support, người cùng Dự án hoạt động, người cùng Dự án đã Lưu trữ thấy ba trường; Thành viên không cùng Dự án nào thấy ba trường trống.
- [ ] Trang Hồ sơ có ba ô mới, lỗi hiện cạnh ô, lưu xong hiện giá trị mới.
- [ ] Trang Người dùng của PM có cột Chức danh và Phòng ban.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
