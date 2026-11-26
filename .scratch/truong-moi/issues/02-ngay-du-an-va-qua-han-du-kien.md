# 02: Ngày của Dự án và Quá hạn dự kiến

**What to build:** Dự án có **Ngày bắt đầu** và **Ngày kết thúc dự kiến** (tuỳ chọn, chỉ ngày, không giờ). Khi có cả hai, Ngày kết thúc dự kiến không được trước Ngày bắt đầu. Dự án **Quá hạn dự kiến** khi: đang hoạt động, có Ngày kết thúc dự kiến, ngày đó trước ngày hôm nay theo giờ Việt Nam (truyền vào), và Tiến độ chưa đủ 100% (Dự án "chưa có task" cũng tính là chưa đủ). Nhãn Quá hạn dự kiến hiện ở dải tóm tắt của chi tiết Dự án. Ngày hiển thị dạng ngày/tháng/năm. Sửa ngày cập nhật Dấu vết. Chỉ luật, bản bộ nhớ, bộ test hợp đồng, giao diện. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 49–51). Thêm từ Quá hạn dự kiến vào `GLOSSARY.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Ngày kết thúc dự kiến trước Ngày bắt đầu bị từ chối với thông báo tiếng Việt; bằng nhau thì hợp lệ; chỉ có một trong hai ngày thì hợp lệ.
- [ ] Luật Quá hạn dự kiến đúng với các ca: kết thúc hôm qua và Tiến độ 50% là quá hạn; kết thúc hôm nay là chưa; Tiến độ 100% là không; Dự án Lưu trữ là không; không có Ngày kết thúc là không; "chưa có task" mà đã qua ngày là có.
- [ ] Mốc theo giờ Việt Nam: Dự án kết thúc 25/11, thời điểm 23:59 ngày 25/11 giờ Việt Nam chưa quá hạn, 00:00 ngày 26/11 thì đã quá hạn.
- [ ] Tạo và sửa Dự án lưu được hai ngày; Dấu vết cập nhật (bộ test hợp đồng).
- [ ] Dải tóm tắt hiện hai ngày dạng ngày/tháng/năm và nhãn Quá hạn dự kiến khi đúng điều kiện.
- [ ] Có test tự động cho từng tiêu chí trên với ngày hôm nay truyền vào, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
