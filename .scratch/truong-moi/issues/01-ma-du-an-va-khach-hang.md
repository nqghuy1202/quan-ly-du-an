# 01: Mã Dự án và Khách hàng

**What to build:** Dự án có **Mã Dự án** bắt buộc và **Khách hàng** tuỳ chọn. PM hoặc Support nhập Mã khi tạo Dự án và sửa được sau (Dự án đã Lưu trữ thì không). Mã: cắt khoảng trắng, đổi sang in hoa, rồi phải dài 2 đến 12 ký tự chỉ gồm chữ Latin in hoa không dấu, chữ số, gạch nối; trùng với Mã của Dự án khác (không phân biệt hoa thường) là lỗi có mã riêng, khác lỗi sai dạng. Khách hàng là chữ tự do tối đa 120 ký tự. Mã hiện cạnh tên Dự án ở mọi nơi tên xuất hiện (danh sách, Tổng quan, dải tóm tắt, Việc của tôi, Chờ tôi duyệt). Sửa Mã hoặc Khách hàng cập nhật Dấu vết. Dữ liệu mẫu của bản chạy thử có Mã và Khách hàng. Lát này chỉ làm luật, bản bộ nhớ, bộ test hợp đồng, giao diện; bản Supabase ở ticket sau. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 40–44, 53–55). Thêm từ Mã Dự án, Khách hàng vào `GLOSSARY.md`.

**Blocked by:** lô `bo-cuc` đã đáp xong và chủ dự án đã xem bố cục

**Status:** ready-for-agent

- [ ] Luật nhận `sdv-012` (chuẩn hoá thành `SDV-012`) và từ chối Mã 1 ký tự, 13 ký tự, có dấu cách giữa, có chữ có dấu, với thông báo tiếng Việt nêu dạng đúng.
- [ ] Tạo Dự án thiếu Mã bị từ chối; tạo Dự án với Mã trùng (khác hoa thường) bị từ chối với lỗi có mã trùng, khác lỗi sai dạng (thêm vào bộ test hợp đồng).
- [ ] PM hoặc Support sửa Mã và Khách hàng; Dấu vết ghi người sửa và thời điểm; sửa sang Mã của chính Dự án đó không bị coi là trùng; Thành viên và Dự án đã Lưu trữ bị từ chối.
- [ ] Khách hàng dài hơn 120 ký tự bị từ chối.
- [ ] Biểu mẫu tạo và sửa Dự án có ô Mã và Khách hàng, lỗi hiện cạnh ô.
- [ ] Mã hiện cạnh tên Dự án ở danh sách Dự án, Tổng quan, dải tóm tắt và trang việc cá nhân.
- [ ] Dữ liệu mẫu có Mã duy nhất cho mọi Dự án; các test dữ liệu mẫu vẫn xanh.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
