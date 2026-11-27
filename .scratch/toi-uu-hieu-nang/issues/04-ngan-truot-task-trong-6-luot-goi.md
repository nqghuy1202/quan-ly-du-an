# 04: Ngăn trượt Task trong 6 lượt gọi

**What to build:** Mở một Task trong Ngăn trượt gọi nhiều lệnh cùng lúc (đọc Task, đọc Dự án, Người trong dự án, lịch sử, link, Dự án của tôi), mỗi lệnh tự kiểm lại. Cho các lệnh này dùng chung kết quả kiểm người gọi, kiểm Dự án và kiểm Task. Nội dung Ngăn trượt, các bước chuyển trạng thái được phép và lời giải thích từ chối giữ nguyên; lỗi của Cổng GitHub vẫn chỉ hiện cạnh link. Spec: `.scratch/toi-uu-hieu-nang/spec.md` (story 12–15).

Cách đếm: một lượt gọi là một yêu cầu mạng tới Supabase (đọc bảng hoặc gọi hàm), đếm bằng `fetch` giả truyền vào bản Supabase của Kho dữ liệu như các test bản Supabase hiện có; chỉ đếm trên đường đi thành công, sau khi đã đăng nhập; không tính đăng nhập, làm mới phiên và Cổng GitHub. Chỉ sửa bản Supabase của Kho dữ liệu: không đổi giao diện của Kho (danh sách lệnh, kiểu trả về, mã lỗi), không đổi bản bộ nhớ, luật thuần, migration hay Edge Function. Mã lỗi và thứ tự từ chối giữ nguyên; chỗ nào bỏ lượt đọc mà làm đổi mã lỗi thì giữ lượt đọc đó. Nếu vì vậy không đạt trần: giữ hành vi, viết test với con số thấp nhất đạt được, và ghi con số cùng lý do dưới mục `## Comments` ở cuối ticket này để chủ dự án quyết.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Gọi cùng lúc các lệnh mà Ngăn trượt Task gọi khi mở tốn tổng cộng nhiều nhất 6 lượt gọi tới Supabase, không tính lượt gọi Cổng GitHub, với Task có lịch sử ngắn và Task có lịch sử dài, nhiều link.
- [ ] Kết quả từng lệnh bằng đúng kết quả khi gọi lần lượt: nội dung Task, lịch sử trạng thái và Mức ưu tiên, link, Người trong dự án.
- [ ] Task không tồn tại, và Task thuộc Dự án người gọi không được xem, vẫn trả đúng mã lỗi như trước.
- [ ] Sau một lệnh đổi trạng thái, lần đọc Task và lịch sử kế tiếp thấy trạng thái mới.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test` với `fetch` giả, không cần mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo. Bộ test hợp đồng và hai bảng ca không bị sửa và vẫn xanh; mọi test hiện có vẫn xanh. Không đổi `package.json` hay lockfile, không sửa hook của repo, không thêm migration. `npm run typecheck` và `npm run lint` sạch.

## Comments

- **Đạt trần, không đổi mã lỗi.** Sáu lệnh gọi cùng lúc (`layTask`, `layDuAn`, `danhSachNguoiTrongDuAn`, `lichSuTask`, `danhSachLienKetCuaTask`, `danhSachDuAnCuaToi`), đếm bằng `fetch` giả (`src/kho/khoSupabaseNganTruotTask.test.ts`; số "trước" đo bằng chính các ca đó trên mã trước ticket): 14 → 6, ở cả Task 1 dòng lịch sử 1 link và Task 30 dòng lịch sử 12 link (PM, Support, Thành viên). Sáu lượt: Task, tên cho Task, tên cho Dấu vết Dự án, Task của Dự án (bộ đếm Task đang giữ), lịch sử, Dự án của tôi.
- **Cách làm:** `xemTaskKemDuAn` (`src/kho/khoSupabaseNguoiGoi.ts`) đọc Task theo id kèm link, Dự án và Người trong dự án nhúng trong một lượt, cùng luật xem với `xemDuAn`; `layTask` và `danhSachLienKetCuaTask` dùng chung qua `dungChungKhiDangBay`. `xemDuAnKemNguoiTrong` gọi khi có lượt đọc Task đang bay thì chờ lượt đó, Task thuộc đúng Dự án (cùng người gọi, cùng vai) thì dùng luôn phần nhúng.
- **Chủ dự án nên biết:**
  1. `layDuAn`, `danhSachNguoiTrongDuAn` gọi cùng lúc với lượt đọc một Task của Dự án KHÁC thì chờ lượt đó xong rồi mới tự đọc: thêm độ trễ một lượt, không thêm lượt gọi.
  2. Lệnh dùng `layTask` rẻ hơn theo: `layTask` một mình 4 → 2, `danhSachLienKetCuaTask` một mình 4 → 1, `doiTrangThaiTask` 8 → 6 (đọc lại Task cuối lệnh). Thêm, gỡ link vẫn đi lối cũ (ticket 06).
  3. Trên giao diện, tab Link GitHub mở sau nên tốn thêm 1 lượt khi bấm vào; lúc mở ngăn là 6.
  4. `fetch` giả của `khoSupabaseVongDuyet.test.ts` và `khoSupabaseTaskHoSoNguoi.test.ts` thêm phần nhúng Dự án vào lượt đọc Task. Chỉ kiểm trên `fetch` giả; đã ghi mục kiểm tay (nhúng lồng, tên khoá ngoại) vào `supabase/README.md`.
