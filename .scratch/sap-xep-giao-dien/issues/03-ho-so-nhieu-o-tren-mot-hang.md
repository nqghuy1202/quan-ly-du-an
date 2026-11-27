# 03: Hồ sơ nhiều ô trên một hàng

**What to build:** Trang Hồ sơ xếp bảy ô thành ba hàng: Email và Vai; Tên hiển thị và GitHub username; Số điện thoại, Chức danh và Phòng ban. Nút Lưu hồ sơ ngay dưới ba hàng. Màn hẹp thì về một cột, mỗi ô chiếm hết chiều ngang. Dùng bố cục biểu mẫu của Astryx (đọc `astryx component FormLayout` và `astryx docs layout` trước; lồng bố cục theo hàng nếu component hỗ trợ), không thẻ thô, không `className` hay `style`, không `px` rời. Nhãn, mô tả, kiểm lỗi zod cạnh ô, thông báo đã lưu, lệnh lưu và thứ tự Tab giữa các ô giữ nguyên. Chỉ đổi giao diện: không đổi Kho dữ liệu, không migration. Spec: `.scratch/sap-xep-giao-dien/spec.md` (story 41–46).

Việc 2–3 ô trên một hàng không có tiêu chí tự động (spec cấm kiểm bố cục theo điểm ảnh); chủ dự án xem tận mắt sau khi đáp.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Trang Hồ sơ có đủ bảy ô với đúng nhãn: Email, Vai, Tên hiển thị, GitHub username, Số điện thoại, Chức danh, Phòng ban; Email và Vai chỉ đọc.
- [ ] Thứ tự các ô trong tài liệu (cũng là thứ tự Tab) đúng như trên.
- [ ] Sửa Tên hiển thị, Số điện thoại, Chức danh, Phòng ban rồi bấm Lưu hồ sơ thì thấy "Đã lưu hồ sơ." và giá trị mới còn sau khi mở lại trang; số điện thoại sai vẫn báo lỗi cạnh ô.
- [ ] Mọi test Hồ sơ hiện có vẫn xanh.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test`, không cần mạng (kể cả localhost), DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không kiểm bố cục theo điểm ảnh; không đổi `package.json` hay lockfile, không sửa hook của repo. `npm run typecheck` và `npm run lint` sạch.
