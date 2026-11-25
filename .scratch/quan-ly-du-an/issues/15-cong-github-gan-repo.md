# 15: Cổng GitHub, hàm chuyển đổi và gắn repo vào Dự án

**What to build:** PM hoặc Support của Dự án gắn một hay nhiều repo GitHub vào Dự án bằng tên dạng chủ-sở-hữu/tên-repo, và gỡ ra. Mọi người trong dự án xem được danh sách repo. Ticket này dựng **Cổng GitHub**: giao diện thứ hai của hệ thống, chỉ có thao tác đọc, không có thao tác ghi nào. Cổng có một bản giả chạy theo kịch bản để test (thành công, không tìm thấy, repo riêng tư mà token không thấy, hết lượt gọi, mất mạng). Cũng có hai hàm thuần: một hàm chuyển phản hồi thô của GitHub cho issue và PR thành trạng thái hiển thị (issue mở hoặc đóng; PR mở, đã merge hoặc đóng; PR nháp coi là mở), và một hàm phân tích đường dẫn issue hoặc PR thành (repo, loại, số). Hệ thống không bao giờ ghi lên GitHub.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] PM hoặc Support của Dự án gắn repo đúng định dạng chủ-sở-hữu/tên-repo; định dạng sai trả lỗi `REPO_KHONG_HOP_LE`; gắn trùng (không phân biệt hoa thường) trả lỗi `REPO_DA_GAN`; gỡ repo chưa gắn trả lỗi không tìm thấy.
- [ ] Thành viên và Support ngoài Dự án gắn hoặc gỡ repo trả lỗi `KHONG_CO_QUYEN`; Dự án đã Lưu trữ trả lỗi `DU_AN_DA_LUU_TRU`; mọi người trong dự án xem được danh sách repo.
- [ ] Hàm chuyển đổi trả đúng trạng thái cho issue mở, issue đóng, PR mở, PR nháp (hiện là mở), PR đã merge và PR đóng chưa merge, kiểm bằng mẫu phản hồi cố định có dạng như phản hồi thật của GitHub; dữ liệu lạ hoặc thiếu trường trả lỗi có mã `DU_LIEU_LA`, không ném lỗi trần.
- [ ] Hàm phân tích đường dẫn nhận đúng dạng issue và PR của github.com ra (repo, loại, số); host khác, đường dẫn khác dạng, số không phải số nguyên dương hoặc thiếu repo trả lỗi `LINK_KHONG_HOP_LE`.
- [ ] Cổng GitHub chỉ có các thao tác đọc; test khẳng định giao diện của cổng không có thao tác ghi nào.
- [ ] Bản giả của Cổng GitHub trả được từng kịch bản lỗi với mã riêng (không tìm thấy, không đọc được vì riêng tư, hết lượt gọi, mất mạng).
- [ ] Mục "Repo GitHub" trên trang Dự án dựng từ Astryx, đủ trạng thái trống, đang tải và lỗi; nút gắn và gỡ bị ẩn hoặc vô hiệu kèm lý do khi không có quyền.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.

## Ghi chú triển khai

- Luật thuần: `src/luat/github.ts` (tên repo, `phanTichLienKet`, `chuyenPhanHoiGitHub`, lý do không gắn repo, mã lỗi `MaLoiGitHub`). Cổng GitHub (chỉ đọc): `src/github/congGitHub.ts`, bản giả theo kịch bản `src/github/congGiaGitHub.ts`.
- Kho dữ liệu thêm `ganRepoVaoDuAn`, `goRepoKhoiDuAn`, `danhSachRepoCuaDuAn` (mã lỗi mới `REPO_KHONG_HOP_LE`, `REPO_DA_GAN`); bộ test hợp đồng riêng `src/kho/hopDongRepo.ts` (`chayHopDongRepo`). Giao diện: `src/giaoDien/PhanRepoGitHub.tsx`.
- Bản Supabase chưa có lệnh repo (trả `LOI_HE_THONG`, chưa đăng nhập thì `CHUA_DANG_NHAP`); ticket 17 cài và chạy `chayHopDongRepo` trên Supabase thật. Cổng không kiểm: bản Supabase của repo.
- Quyết định: quyền gắn/gỡ repo như quyền quản lý Dự án (không thêm dòng vào bảng ca dùng chung, quyền được kiểm trong `hopDongRepo.ts`); gắn/gỡ repo không đổi dấu vết Dự án; link PR kèm trang con (`/files`) bị từ chối.
