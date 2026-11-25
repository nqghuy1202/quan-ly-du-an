# 16: Link issue hoặc PR trên Task và trạng thái GitHub

**What to build:** Người trong dự án dán link issue hoặc PR của GitHub vào một Task và gỡ link ra; một Task có nhiều link. Link phải thuộc một repo đã gắn vào Dự án. Task hiện trạng thái hiện tại của từng link (issue mở hoặc đóng, PR mở, đã merge hoặc đóng) đọc qua Cổng GitHub của ticket 15; trạng thái được đọc mỗi lần mở Task và khi bấm nút làm mới, chưa có bộ nhớ đệm. Khi không đọc được (repo riêng tư mà token không thấy, hết lượt gọi, sai link, mất mạng) thì hiện thông báo cạnh link và phần còn lại của Task dùng bình thường. Thêm hoặc gỡ link cũng được tính là chỉnh sửa Task nên cập nhật dấu vết chỉnh sửa. Hệ thống không bao giờ ghi lên GitHub.

**Blocked by:** 07, 15

**Status:** ready-for-agent

- [ ] Người trong dự án dán link hợp lệ thuộc repo đã gắn thì link được lưu vào Task; link không hợp lệ trả lỗi `LINK_KHONG_HOP_LE`; link thuộc repo chưa gắn vào Dự án trả lỗi `LINK_REPO_CHUA_GAN`; link đã có trên Task trả lỗi `LINK_TRUNG`.
- [ ] Một Task giữ được nhiều link; gỡ một link không ảnh hưởng link khác; người ngoài Dự án thêm hoặc gỡ link trả lỗi không tìm thấy; Dự án đã Lưu trữ trả lỗi `DU_AN_DA_LUU_TRU`.
- [ ] Thêm hoặc gỡ link cập nhật người chỉnh sửa gần nhất và ngày chỉnh sửa gần nhất của Task.
- [ ] Mỗi link hiện đúng trạng thái đọc từ Cổng GitHub (kiểm bằng bản giả: issue mở, issue đóng, PR mở, PR đã merge, PR đóng).
- [ ] Mỗi kịch bản lỗi của cổng (không tìm thấy, riêng tư không đọc được, hết lượt gọi, mất mạng, dữ liệu lạ) hiện một thông báo tiếng Việt riêng cạnh link, còn tiêu đề, người, trạng thái và các link khác của Task vẫn hiện và dùng được.
- [ ] Có trạng thái đang tải trong lúc đọc GitHub và nút làm mới đọc lại; Task không đọc GitHub khi không có link nào.
- [ ] Không có đường nào trong ứng dụng ghi lên GitHub (test khẳng định Cổng GitHub chỉ được gọi bằng các thao tác đọc).
- [ ] Phần link trên chi tiết Task dựng từ Astryx, đủ trạng thái trống, đang tải và lỗi.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
