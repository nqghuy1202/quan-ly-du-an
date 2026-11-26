# 08: Tổng quan thêm số liệu Dự án

**What to build:** Trang Tổng quan thêm một ô số "Dự án Quá hạn dự kiến" (chỉ đếm Dự án đang hoạt động người gọi được xem). Bảng Dự án đang hoạt động ở Tổng quan hiện Mã, nhãn Quá hạn dự kiến trên dòng tương ứng, và với PM hoặc Support thêm dấu "chưa có Người phụ trách" trên Dự án đang hoạt động chưa có Người phụ trách. Số liệu tính trong hàm thuần của Tổng quan, ngày hôm nay truyền vào. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 19–20).

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Hàm Tổng quan đếm đúng Dự án Quá hạn dự kiến; Dự án Lưu trữ không được đếm.
- [ ] Màn Tổng quan có ô số Dự án Quá hạn dự kiến và nhãn trên đúng dòng Dự án.
- [ ] PM và Support thấy dấu "chưa có Người phụ trách" trên Dự án chưa có Người phụ trách; Thành viên không thấy dấu này.
- [ ] Có test tự động cho từng tiêu chí trên với ngày hôm nay truyền vào, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
