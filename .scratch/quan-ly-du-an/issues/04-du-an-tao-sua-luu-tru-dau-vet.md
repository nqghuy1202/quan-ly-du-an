# 04: Dự án: tạo, sửa, Lưu trữ, danh sách và dấu vết

**What to build:** PM tạo Dự án với tên và mô tả, xem danh sách Dự án, sửa tên và mô tả, Lưu trữ và mở lại. Mỗi Dự án hiện dấu vết: người tạo, ngày tạo, người chỉnh sửa gần nhất và ngày chỉnh sửa gần nhất (dự án chưa sửa lần nào thì không có phần "chỉnh sửa"). Dự án đã Lưu trữ chỉ xem được. Ngày giờ lấy từ đồng hồ truyền vào và hiển thị theo múi giờ Việt Nam. Ở ticket này chỉ PM thấy và sửa được Dự án; quyền xem và quyền sửa của Support và Thành viên đi theo "người trong dự án" ở ticket 05.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] PM tạo Dự án với tên bắt buộc (không rỗng, không chỉ khoảng trắng, tối đa 120 ký tự) và mô tả tuỳ chọn; Support hoặc Thành viên tạo Dự án trả lỗi `KHONG_CO_QUYEN`.
- [ ] Dự án mới có người tạo và ngày tạo đúng theo người gọi và đồng hồ truyền vào, và chưa có người chỉnh sửa hay ngày chỉnh sửa.
- [ ] PM sửa tên hoặc mô tả thì người chỉnh sửa gần nhất và ngày chỉnh sửa gần nhất được cập nhật; người tạo và ngày tạo không đổi.
- [ ] PM Lưu trữ một Dự án thì mọi lệnh ghi lên Dự án đó trả lỗi `DU_AN_DA_LUU_TRU` nhưng vẫn đọc được; mở lại thì sửa được trở lại; cả hai bước đều cập nhật dấu vết chỉnh sửa.
- [ ] PM thấy danh sách mọi Dự án và lọc được giữa đang hoạt động và Lưu trữ; ngày giờ hiển thị theo múi giờ Việt Nam.
- [ ] Có màn danh sách, màn tạo và màn chi tiết kèm sửa, đủ trạng thái trống, đang tải và lỗi; nút ghi bị ẩn hoặc vô hiệu khi người dùng không có quyền hoặc Dự án đã Lưu trữ, kèm lý do.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
