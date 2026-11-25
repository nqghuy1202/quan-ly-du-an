# 13: Tiến độ, Trễ hạn và trang tổng quan

**What to build:** Trang tổng quan liệt kê các Dự án mà người dùng được thấy, mỗi Dự án hiện Tiến độ, số Task theo từng trạng thái và cờ Trễ hạn. Tiến độ bằng số Task Hoàn thành chia (tổng Task trừ Task Huỷ), hiển thị là số nguyên phần trăm làm tròn xuống để 100% chỉ xuất hiện khi thật sự xong hết. Dự án không có Task nào đáng tính (chưa có Task, hoặc toàn Huỷ) hiện "chưa có task" thay vì 0%. Task Trễ hạn là Task có hạn, hạn đã qua so với ngày hôm nay theo giờ Việt Nam, và chưa Hoàn thành, chưa Huỷ; Task đang Chờ duyệt vẫn tính là chưa hoàn thành. Dự án có cờ Trễ hạn khi có ít nhất một Task Trễ hạn, và trang Dự án liệt kê các Task Trễ hạn đó. Tổng quan theo vai: PM thấy mọi Dự án; Support và Thành viên chỉ thấy Dự án mình ở trong, kèm số Task chưa chốt của riêng mình ở mỗi Dự án. Dự án Lưu trữ nằm ở nhóm riêng. Ngày hôm nay luôn được truyền vào, không đọc đồng hồ thật trong luật.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] Tiến độ của Dự án có Task Hoàn thành, Huỷ và còn lại được tính đúng (Task Huỷ không nằm trong mẫu số) và làm tròn xuống thành số nguyên phần trăm; khi còn một Task chưa Hoàn thành thì không bao giờ hiện 100%.
- [ ] Dự án chưa có Task hoặc chỉ có Task Huỷ hiện "chưa có task", không hiện 0%.
- [ ] Task Trễ hạn đúng định nghĩa: hạn trước ngày hôm nay (theo giờ Việt Nam) và trạng thái không phải Hoàn thành hay Huỷ; hạn bằng hôm nay thì chưa trễ; Task đang Chờ duyệt quá hạn vẫn trễ; Task không có hạn không bao giờ trễ.
- [ ] Mốc giờ đúng múi giờ Việt Nam: với một Task hạn 25/11, thời điểm 23:59 ngày 25/11 giờ Việt Nam chưa trễ và thời điểm 00:00 ngày 26/11 giờ Việt Nam đã trễ.
- [ ] Dự án có ít nhất một Task Trễ hạn hiện cờ Trễ hạn trên tổng quan; trang Dự án liệt kê các Task Trễ hạn đó.
- [ ] Mỗi dòng của tổng quan hiện tên Dự án, Tiến độ, số Task theo từng trạng thái và cờ; PM thấy mọi Dự án; Support và Thành viên chỉ thấy Dự án mình ở trong cùng số Task chưa chốt của riêng mình; Dự án Lưu trữ ở nhóm riêng.
- [ ] Tổng quan có đủ trạng thái trống (chưa ở Dự án nào), đang tải và lỗi; dựng từ component hoặc template Astryx theo luật của dự án.
- [ ] Có test tự động cho từng tiêu chí trên với ngày hôm nay truyền vào, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
