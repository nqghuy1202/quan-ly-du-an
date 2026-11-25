# AGENTS.md

Project-specific guidance for AI coding agents.

## Dự án này

Web nhiều người dùng bằng tiếng Việt để PM và Support quản lý Dự án, Task và vòng duyệt. Đọc `GLOSSARY.md` trước (từ vựng: Dự án, Task, Người thực hiện, Người kiểm tra, Chờ duyệt, Trả lại, Bị lỗi, Huỷ, Lưu trữ, Dấu vết). Spec và ticket nằm ở `.scratch/quan-ly-du-an/` (`spec.md`, `issues/NN-*.md`); spec là nguồn sự thật về hành vi.

### Lệnh

| Việc | Lệnh |
|---|---|
| Chạy thử trên máy | `npm run dev` |
| Test (cổng kiểm, không cần mạng/DB/file ngoài repo) | `npm test` |
| Kiểm kiểu | `npm run typecheck` |
| Lint | `npm run lint` |
| Dựng bản chạy | `npm run build` |
| Tra Astryx | `npm run astryx -- component <Tên>` (hoặc `npx astryx ...`) |

Cổng của Bảng ticket AI chạy `npm test`. Phải xanh trước khi đáp ticket; nên chạy thêm `npm run typecheck` và `npm run lint`.

### Luật cứng

- **Không đổi danh sách phụ thuộc** (`package.json`, `package-lock.json`) trong một ticket. Thiếu gói thì dừng và báo; chủ dự án thêm ở lát 0.
- **Không sửa hook**, không bỏ qua hook của repo, không ghi đè lịch sử trên remote.
- **Test không dùng mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo.** Ngày hôm nay truyền vào hàm, không đọc `Date.now()` trong luật.
- Một test chỉ kiểm hành vi nhìn thấy từ bên ngoài, đi qua seam **Kho dữ liệu** (giao diện lưu trữ duy nhất; mọi lệnh nhận danh tính người gọi, trả kết quả hoặc lỗi có mã). Không kiểm cách cài bên trong.
- Luật nghiệp vụ nằm ở một chỗ thuần, không I/O (chuyển trạng thái, quyền, Tiến độ, Trễ hạn, dấu vết). Giao diện dùng chính chỗ đó để ẩn nút và giải thích từ chối.
- Dữ liệu từ biểu mẫu kiểm bằng zod ở ranh giới. Giao diện và thông báo hoàn toàn tiếng Việt; ngày giờ theo múi giờ Việt Nam.
- Không bao giờ ghi lên GitHub (chỉ đọc). Khoá `service role` của Supabase không bao giờ xuống trình duyệt.

### Giao diện (Astryx, theme `neutral`)

- Mọi màn dựng từ template hoặc component Astryx, đọc `astryx component <Tên>` trước khi dùng. Không `div`/`span` thô, không `className`, không `style` nội tuyến, không màu hex hay `px` rời (ESLint chặn `div`, `span`, `className`, `style` trong `src/**/*.tsx`).
- Mỗi màn có đủ trạng thái trống, đang tải, lỗi; mọi điều khiển có focus ring nhìn thấy được.
- Theme nạp ở `src/astryx-themes.ts` (do `astryx theme add` sinh, không sửa tay). StyleX được biên dịch bởi `@stylexjs/unplugin` trong `vite.config.ts` (chỉ mã của repo, không biên dịch `node_modules/@astryxdesign`).
- Kanban: dùng template `kanban-board` (`astryx template kanban-board --type page <đường dẫn>`), đã có sẵn kéo thả bằng pointer events, không cần thư viện thêm.

### Cấu trúc

```
src/
  main.tsx, App.tsx      lối vào, nạp Theme
  astryx-themes.ts       sinh bởi astryx theme add
  globals.css            reset + astryx.css
  test/setup.ts          jest-dom + dọn sau mỗi test
```

Test cạnh mã (`*.test.ts[x]` trong `src/`), chạy bằng Vitest và Testing Library. Môi trường test mặc định là `node`; **test giao diện bắt buộc khai `// @vitest-environment jsdom` ở dòng đầu file**. Không đổi mặc định sang `jsdom` trong `vite.config.ts`: cổng kiểm chạy trong sandbox và sẽ báo `EPERM`.

<!-- ASTRYX:START -->
Astryx v0.7.17 · 174 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx component <Name>` to read props before using one; `astryx template <Block>` prints a block example to read for a part it lacks. Astryx names differ from other libraries: buttons, badges, tokens and tabs take their text in `label` (Text, Heading and Link take children), booleans start with `is` or `has` (`isOpen`, `isDisabled`), and every input takes `value` and `onChange`.
Changing an existing page? Keep it: skip step 2 and add components inside its sections; read a block example when it helps.
Before you deliver a build, run `astryx doctor --built <dir>`; don't deliver it if it fails.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then the xstyle prop / StyleX tokens. No raw hex/px.
- THEMES: palettes and custom colors go through the theme, never :root overrides; so does a denser or roomier app (`editor set <name> spacing tight`), never gap and padding changes page by page. A change to one kind of part (the sidebar, its selected item, the gaps in a form) is a theme change too, not props on one page: `editor how "<ask>"` names the `set … --on <part>` line. No app yet: `astryx experimental theme preview app <dir>` makes a starter app that shows the theme. To make or change a theme (colors, fonts, corners, spacing, a look from a picture), prefer the experimental theme editor over hand-written theme files: `astryx experimental theme editor new <name> --like neutral`, then `editor set <name> <thing> <value>` or `editor how "<what you want>"`; wire it with `astryx theme add <name>`; after each change look at it with `astryx experimental theme editor show <name> --png` (takes pictures of real components) and open the PNGs it writes; a theme change is not done until you have looked at the pictures. In code, extend an imported theme to customize it; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any className=, style={{…}}, raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or the xstyle prop + a token.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands and API reference
  docs authoring     build an integration package, and every field it holds
  upgrade --from <old version> --apply   run after a dependency bump
To remove this block, run `astryx init --remove-agents`, which removes it from the agent files at the project root and in the folder you run it in; from any other file it leaves, delete everything from ASTRYX:START to ASTRYX:END.
<!-- ASTRYX:END -->
