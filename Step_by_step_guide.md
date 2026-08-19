# Lộ trình triển khai — Hệ thống theo dõi và đánh giá nhiệm vụ

_Rà soát lần 2 — đã điều chỉnh thứ tự phụ thuộc so với bản đầu._

Tài liệu này chia việc xây dựng hệ thống (theo Technical Design v1.1) thành các bước nhỏ, mỗi bước đủ nhỏ để giao cho 1 coding agent làm trong 1 lượt, có thể test và commit ngay sau khi xong. Thứ tự các giai đoạn được sắp để **có bộ khung chạy được (end-to-end) càng sớm càng tốt**, sau đó mỗi module nghiệp vụ được xây theo đúng thứ tự phụ thuộc kỹ thuật của nó — không chỉ theo độ "quan trọng" cảm tính.

## Đã điều chỉnh ở lần rà soát này

| # | Vấn đề phát hiện ở bản trước | Điều chỉnh |
|---|---|---|
| 1 | Không có bước nào xử lý quyết định về RLS (mục 6.6.4 thiết kế) — một rủi ro bảo mật đã được nêu rõ trong Technical Design nhưng bị bỏ sót hoàn toàn khỏi lộ trình. | Thêm bước **2.5**: ghi nhận rõ quyết định dùng NestJS/Prisma làm lớp phân quyền chính cho MVP. |
| 2 | Index của bảng (mục 6.15 thiết kế) không xuất hiện ở bước nào — dễ bị quên tới khi dữ liệu đã lớn mới thêm, gây downtime lúc migrate. | Khai báo index ngay khi tạo bảng `tasks` (**6.1**) và `audit_logs` (**8.1**). |
| 3 | "Hủy nhiệm vụ" bị dồn xuống hardening cuối cùng (giai đoạn 12 cũ), trong khi Dashboard (giai đoạn 11 cũ) đã cần lọc theo `is_cancelled` — tính năng phụ thuộc được test trước tính năng nó phụ thuộc vào. | Tách "Hủy nhiệm vụ" thành **giai đoạn 9** riêng, đặt trước Dashboard. |
| 4 | Audit Log (giai đoạn 9 cũ) nằm sau RBAC phòng ban (giai đoạn 8 cũ) — khi cần audit-hoá hành động Hủy/Chốt lại phải quay lại chỉnh thứ tự. | Đổi chỗ: Audit Log lên **giai đoạn 8** (trước RBAC), thiết lập pattern transaction một lần, tái dùng cho Cancel và Finalize. |
| 5 | Quyền xem Audit Log ghi "Admin/Secretary" — thiết kế gốc (mục 2.2) chỉ liệt kê quyền này cho Admin. | Sửa lại đúng **Admin**, ghi chú có thể mở cho Thư ký sau nếu phát sinh nhu cầu thực tế. |
| 6 | Quyền Finalize chưa phân biệt rõ Secretary (bất kỳ nhiệm vụ) và Department Editor (chỉ nhiệm vụ phòng mình sở hữu). | Viết rõ điều kiện ở bước **11.3**. |

Nếu coding agent đã bắt đầu code theo bản lộ trình trước, đối chiếu lại số thứ tự giai đoạn ở bảng trên trước khi giao việc tiếp — đặc biệt thứ tự Audit Log / Hủy / RBAC đã đổi.

## Cách dùng tài liệu này với coding agent

- Giao **từng bước một**, không giao cả giai đoạn cùng lúc — agent dễ lạc hướng và khó review diff khi phạm vi quá rộng.
- Sau mỗi bước: yêu cầu agent chạy thử (build/start/test), bạn review, rồi mới `git commit` trước khi sang bước kế tiếp.
- Với các bước có đánh dấu 🧪, luôn yêu cầu agent viết kèm test (unit hoặc curl/e2e script) trong cùng bước — đừng để dồn lại cuối.
- Nếu agent đề xuất thay đổi kiến trúc so với tài liệu Technical Design, dừng lại và quyết định thủ công trước khi để agent tiếp tục — tránh việc kiến trúc trôi dần qua nhiều lượt agent tự quyết.

---

## Giai đoạn 0 — Chuẩn bị workspace

**0.1** Tạo git repo, `README.md` mô tả ngắn gọn hệ thống, `.gitignore` (Node, Next.js, NestJS, `.env`).

**0.2** Tạo cấu trúc thư mục:
```
/apps
  /web       (Next.js frontend)
  /api       (NestJS backend)
/docs
  technical-design.md   (copy nội dung từ tài liệu thiết kế v1.1)
```

**0.3** Tạo project Supabase (cloud, free tier đủ cho MVP). Lấy: Project URL, anon key, service role key, connection string Postgres.

**0.4** Tạo `.env.example` ở cả `/apps/web` và `/apps/api` liệt kê các biến cần thiết (chưa cần điền giá trị thật vào git).

> Kết thúc giai đoạn 0: có repo rỗng, có Supabase project, chưa có code.

---

## Giai đoạn 1 — Backend skeleton (chạy được, chưa có nghiệp vụ)

**1.1** `nest new apps/api` (TypeScript). Xóa các file mẫu (`app.controller.spec.ts` demo) không cần.

**1.2** Cài Prisma, `prisma init`, trỏ `DATABASE_URL` vào Supabase Postgres.

**1.3** Viết `schema.prisma` **chỉ với 3 bảng nền tảng**: `Department`, `Role`, `User` (chưa có Task, Audit Log, Period Lock — thêm sau ở giai đoạn 6+).

**1.4** 🧪 Chạy `prisma migrate dev`, viết seed script tạo: 4 role (ADMIN, SECRETARY, DEPARTMENT_EDITOR, VIEWER), 3 phòng ban mẫu (chưa cần đủ 22), 1 user admin. Xác nhận `prisma studio` thấy dữ liệu.

**1.5** Tạo các module NestJS **rỗng** (chỉ controller trả `{status: "ok"}`, chưa có logic): `auth`, `users`, `departments`, `tasks`, `audit-log`, `period-lock`, `dashboard`. Mục đích: định hình cấu trúc thư mục trước khi đổ logic vào.

**1.6** Cấu hình global: `ValidationPipe`, CORS cho phép origin của frontend, endpoint `GET /health` trả 200.

**1.7** 🧪 `npm run start:dev`, gọi `curl localhost:3000/health` xác nhận chạy được. Commit: "Backend skeleton chạy được, chưa có nghiệp vụ".

---

## Giai đoạn 2 — Auth skeleton

**2.1** Cài `@supabase/supabase-js` ở backend, tạo `SupabaseService` wrap client (dùng service role key).

**2.2** Viết `AuthGuard`: đọc `Authorization: Bearer <token>`, verify qua Supabase, gắn `req.user = { authUserId, email }`. Nếu invalid → 401.

**2.3** Viết middleware/interceptor: sau khi có `authUserId`, tra bảng `User` lấy `role` + `department_id`, gắn vào `req.currentUser`. Nếu không tìm thấy user nghiệp vụ tương ứng → 403 ("tài khoản chưa được cấp quyền").

**2.4** 🧪 Tạo 1 user test qua Supabase Auth dashboard, lấy access token, gọi thử 1 endpoint có `@UseGuards(AuthGuard)` để xác nhận luồng chạy đúng.

**2.5** Quyết định & ghi nhận (trong `docs/security.md`): MVP dùng NestJS + Prisma (kết nối bằng service-role/privileged DB user) làm lớp phân quyền chính, **không** triển khai truyền JWT context qua Prisma để kích hoạt RLS ở giai đoạn này (mục 6.6.4 Technical Design). Lý do chấp nhận được: kiến trúc hiện tại không có truy vấn nào đi thẳng từ frontend vào Supabase DB — frontend chỉ gọi qua NestJS API. Nếu sau này bổ sung tính năng cho frontend truy vấn Supabase trực tiếp (ví dụ realtime subscription), phải quay lại triển khai đầy đủ theo mục 6.6.4 **trước khi** bật tính năng đó.

> Kết thúc giai đoạn 2: backend biết "ai đang gọi API" và có quyết định rõ ràng (đã ghi lại, không phải bỏ sót) về việc RLS chưa được kích hoạt ở tầng DB.

---

## Giai đoạn 3 — Frontend skeleton

**3.1** `create-next-app apps/web` (TypeScript, Tailwind, App Router).

**3.2** Cài `shadcn/ui`, khởi tạo theme mặc định (chưa cần tùy biến sâu).

**3.3** Cài `@supabase/supabase-js` + `@supabase/ssr`, tạo Supabase client cho frontend (anon key).

**3.4** Trang `/login`: form email/password gọi `supabase.auth.signInWithPassword`. Chưa cần đẹp — chỉ cần chạy được.

**3.5** Layout khung: Sidebar (Dashboard / Nhiệm vụ / Phòng ban / Người dùng / Audit Log) + Header hiển thị tên user đăng nhập. Mỗi route con chỉ render `<h1>Tên trang</h1>` (chưa có nội dung thật).

**3.6** Middleware Next.js: chặn truy cập các route trong layout nếu chưa đăng nhập, redirect về `/login`.

**3.7** 🧪 `npm run dev`, đăng nhập bằng user test đã tạo ở bước 2.4, xác nhận vào được layout chính và điều hướng giữa các trang rỗng.

> Kết thúc giai đoạn 3: có 2 app chạy song song, đăng nhập được, nhưng frontend và backend **chưa nói chuyện với nhau**.

---

## Giai đoạn 4 — Vertical slice đầu tiên (nối đầu-cuối)

Đây là mốc quan trọng nhất: chọn **1 luồng đơn giản nhất có thể** để đi xuyên suốt DB → Prisma → NestJS → REST → Next.js → UI, chứng minh kiến trúc ráp lại được với nhau trước khi mở rộng.

**4.1** Backend: implement thật `GET /departments` (đọc từ Prisma, không cần auth guard ở bước này để giảm biến số khi debug).

**4.2** Frontend: trang `/departments` gọi API thật, hiển thị bảng tên phòng ban (không cần style đẹp).

**4.3** 🧪 Xác nhận: sửa 1 dòng dữ liệu trong Supabase → refresh trang → thấy thay đổi. Đây là bằng chứng toàn bộ chuỗi kết nối hoạt động.

**4.4** Thêm lại `AuthGuard` vào `GET /departments`, cập nhật frontend gửi kèm access token (qua fetch wrapper dùng chung). Xác nhận vẫn chạy được sau khi bảo vệ route.

> Kết thúc giai đoạn 4: **có bộ khung thật sự** — 2 app, có auth, có 1 API thật kết nối end-to-end. Từ đây các giai đoạn sau chỉ là lặp lại cùng một khuôn mẫu (module rỗng → logic thật → nối frontend) cho từng domain.

---

## Giai đoạn 5 — Users & Departments (CRUD quản trị cơ bản)

**5.1** Backend: `GET /users`, `POST /users` (chỉ Admin — nhưng `RolesGuard` thật sự làm ở bước 5.3, tạm thời chỉ auth).

**5.2** Frontend: trang `/users` — bảng danh sách + form tạo user tối thiểu (email, role, department).

**5.3** Viết `RolesGuard` dùng `req.currentUser.role` (đã có từ giai đoạn 2), decorator `@Roles('ADMIN')` áp cho `POST /users`. 🧪 Test: user không phải Admin gọi API này phải nhận 403.

**5.4** Backend: `POST /departments`, `PATCH /departments/:id` (Admin only) để có thể nhập đủ 22 phòng ban qua API thay vì seed cứng.

> Kết thúc giai đoạn 5: quản trị được người dùng và phòng ban qua giao diện, có sẵn `RolesGuard` để các giai đoạn sau tái sử dụng cho mọi kiểm tra theo role.

---

## Giai đoạn 6 — Task module: CRUD thô (chưa áp business rule)

**6.1** Mở rộng `schema.prisma`: thêm bảng `Task` (đầy đủ field theo thiết kế, kể cả `is_cancelled`, `is_finalized`, `version` — khai báo trước dù chưa dùng logic) và `TaskCoordinatingDepartment`. **Khai báo luôn index theo mục 6.15 thiết kế** ngay trong schema (`@@index`): `owner_department_id`, `required_completion_date`, `actual_completion_date`, `is_cancelled`, `is_finalized`, `created_at`, và composite `(owner_department_id, required_completion_date)`. Migrate.

**6.2** Backend: `POST /tasks`, `GET /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id` — CRUD thuần, chưa tính status, chưa check khóa/chốt, chưa phân quyền theo phòng ban (chỉ cần đăng nhập là gọi được).

**6.3** Frontend: trang `/tasks` — bảng danh sách + form tạo/sửa nhiệm vụ tối thiểu (đủ field bắt buộc theo mục 3.2 của thiết kế).

**6.4** 🧪 Tạo thử 3-5 nhiệm vụ qua UI, xác nhận lưu đúng vào DB, sửa được, xem chi tiết được.

> Kết thúc giai đoạn 6: CRUD nhiệm vụ hoạt động nhưng **chưa có "bộ não" nghiệp vụ**. Lưu ý: từ đây đến hết giai đoạn 9, **mọi user đã đăng nhập đều thấy được tất cả nhiệm vụ của mọi phòng ban** — đây là có chủ đích (tách "logic nghiệp vụ" khỏi "phạm vi truy cập dữ liệu" để dễ debug từng phần riêng biệt), không phải thiếu sót. Giai đoạn 10 sẽ khóa lại đúng phạm vi.

---

## Giai đoạn 7 — Status Calculation (logic nghiệp vụ lõi đầu tiên)

**7.1** 🧪 Viết pure function `calculateTaskStatus(task)` theo đúng bảng logic mục 4.7 (is_cancelled → required → actual), kèm unit test phủ toàn bộ các dòng trong bảng, kể cả trường hợp biên (NULL, ngày bằng nhau).

**7.2** Gắn hàm này vào response của `GET /tasks` và `GET /tasks/:id` (tính runtime, không lưu cột status trong DB).

**7.3** Frontend: hiển thị badge trạng thái (màu khác nhau theo trạng thái) trong bảng danh sách và trang chi tiết.

> Ghi chú: nhánh "Đã hủy" trong bảng logic 4.7 tạm thời chỉ test được bằng cách set tay `is_cancelled = true` trong DB — API để set qua ứng dụng sẽ có ở giai đoạn 9.

---

## Giai đoạn 8 — Audit Log (thiết lập pattern transaction)

Đặt trước RBAC vì Audit Log không phụ thuộc vào việc lọc dữ liệu theo phòng ban — nó chỉ cần biết "ai vừa sửa gì". Xây trước để giai đoạn 9 (Hủy) và giai đoạn 11 (Chốt) tái dùng ngay, thay vì phải quay lại vá từng API.

**8.1** Bảng `AuditLog` (Prisma), kèm index `user_id`, `entity_id`, `created_at` theo mục 6.15 thiết kế. Migrate.

**8.2** Backend: viết `AuditLogService`, tích hợp vào `PATCH /tasks/:id` — **trong cùng transaction** với việc update task (theo đúng yêu cầu ở mục 6.8 của thiết kế): nếu ghi audit log thất bại, toàn bộ update phải rollback.

**8.3** `GET /audit-logs`, `GET /audit-logs/:id` — giới hạn quyền xem cho **Admin** (đúng mục 2.2 thiết kế; thiết kế gốc không liệt kê quyền này cho Thư ký — có thể mở rộng sau nếu phát sinh nhu cầu thực tế).

**8.4** Frontend: trang `/audit-logs` hiển thị bảng lịch sử, chỉ hiện mục này trong sidebar khi user là Admin.

**8.5** 🧪 Sửa 1 nhiệm vụ, xác nhận log ghi đúng field/giá trị cũ/mới. Test thêm: giả lập lỗi khi ghi audit log (ví dụ tạm đổi tên cột sai), xác nhận task **không** bị update khi audit log thất bại (đúng transaction).

---

## Giai đoạn 9 — Trạng thái "Đã hủy"

Tách riêng thành giai đoạn nhỏ vì gắn chặt với logic status (giai đoạn 7) và chỉ cần permission theo role (đã có từ giai đoạn 5), không cần chờ RBAC theo phòng ban.

**9.1** Backend: `PATCH /tasks/:id/cancel` — set `is_cancelled = true`, `cancelled_at`, `cancelled_by`. Chỉ cho phép **SECRETARY hoặc ADMIN** gọi (đúng mục 3.1.L thiết kế — quyền hủy không phụ thuộc phòng ban), dùng `RolesGuard` có sẵn từ giai đoạn 5.

**9.2** Tích hợp ghi audit log cho hành động hủy, tái dùng `AuditLogService` từ giai đoạn 8, cùng transaction.

**9.3** Frontend: nút "Hủy nhiệm vụ" ở trang chi tiết (chỉ hiện với Secretary/Admin), cập nhật badge trạng thái thành "Đã hủy" ngay sau khi hủy thành công.

**9.4** 🧪 Hủy 1 nhiệm vụ: xác nhận status hiển thị "Đã hủy" ghi đè lên mọi tính toán khác (đúng mục 4.7), có audit log tương ứng, và một tài khoản DEPARTMENT_EDITOR gọi thử API này phải bị từ chối (403).

> Kết thúc giai đoạn 9: Status + Audit Log + Hủy nhiệm vụ hoạt động đúng và kiểm chứng được toàn bộ qua ứng dụng (không cần poke DB tay nữa) — nhưng **vẫn chưa giới hạn ai thấy nhiệm vụ của phòng nào**.

---

## Giai đoạn 10 — Phân quyền theo phòng ban (RBAC + Department)

**10.1** Backend: sửa `GET /tasks` để lọc theo `currentUser`:
- ADMIN/SECRETARY: thấy tất cả.
- DEPARTMENT_EDITOR/VIEWER: chỉ thấy nhiệm vụ mà phòng mình là `owner_department_id` **hoặc** nằm trong `TaskCoordinatingDepartment`.

**10.2** Backend: `PATCH /tasks/:id` — chặn nếu người gọi không phải owner/Secretary/Admin (đơn vị phối hợp chỉ đọc, không sửa — đúng mục 2.5).

**10.3** 🧪 Test bằng 3 tài khoản khác nhau (Admin, Editor phòng A, Editor phòng B) xác nhận đúng ma trận quyền: mỗi Editor chỉ thấy/sửa được nhiệm vụ phòng mình, thấy (không sửa được) nhiệm vụ mà phòng mình là đơn vị phối hợp.

> Kết thúc giai đoạn 10: phạm vi truy cập dữ liệu đã đúng thiết kế — giờ mới thật sự "an toàn" để demo cho nhiều phòng ban dùng thử song song.

---

## Giai đoạn 11 — Period Lock & Finalize

**11.1** Bảng `PeriodLock` (nếu chưa có), migrate.

**11.2** Backend: hàm kiểm tra "tháng của `required_completion_date` đã bị khóa chưa" (Nhóm A), áp vào `PATCH /tasks/:id` — chặn sửa Nhóm A nếu đã khóa và người gọi không phải Admin. Nhóm B (`actual_completion_date`, `completion_evidence`) không bị khóa tự động theo tháng (đúng mục 4.8).

**11.3** Backend: field `is_finalized` + `PATCH /tasks/:id/finalize` + `PATCH /tasks/:id/unfinalize`:
- **Finalize**: cho phép SECRETARY (bất kỳ nhiệm vụ) hoặc DEPARTMENT_EDITOR **chỉ khi** là owner của nhiệm vụ đó (tái dùng ownership-check từ giai đoạn 10).
- **Unfinalize**: chỉ ADMIN.
- Cả hai hành động đều ghi audit log (tái dùng `AuditLogService` từ giai đoạn 8), trong transaction.

**11.4** 🧪 Test đủ 4 case: (a) trong tháng, chưa chốt → sửa được cả Nhóm A và B; (b) qua tháng, chưa chốt → chỉ sửa được Nhóm B; (c) đã chốt → không sửa được gì (trừ Admin); (d) Admin mở khóa/mở lại → sửa được, có ghi audit log.

**11.5** Endpoint thủ công (Admin bấm tay) để tạo `PeriodLock` khi qua tháng mới — MVP chưa cần cron.

> Kết thúc giai đoạn 11: đầy đủ business rule + phân quyền đúng thiết kế (phòng ban, khóa theo tháng, chốt nhiệm vụ).

---

## Giai đoạn 12 — Dashboard

**12.1** Backend: `GET /dashboard/summary?month=YYYY-MM` — trả về các chỉ số mục 5.4 (loại trừ `is_cancelled`, đã hoạt động thật từ giai đoạn 9).

**12.2** Backend: `GET /dashboard/departments?month=YYYY-MM` — bảng tổng hợp theo 22 phòng ban (mục 5.6).

**12.3** Frontend: trang `/dashboard` — khu vực tổng quan (cards) + bảng phòng ban. Biểu đồ (nếu cần) làm sau khi số liệu đúng, không làm song song để tránh khó debug sai số.

**12.4** 🧪 Đối chiếu thủ công: tạo vài nhiệm vụ với trạng thái khác nhau qua chính ứng dụng (kể cả hủy 1 nhiệm vụ), đếm tay, so với số dashboard trả về, xác nhận khớp — phép thử này chỉ thật sự đầy đủ vì Cancel/Finalize đã có từ trước (giai đoạn 9, 11).

---

## Giai đoạn 13 — Hoàn thiện & hardening

Làm sau khi toàn bộ luồng nghiệp vụ chính đã chạy đúng — không làm sớm vì dễ phải sửa lại khi logic nghiệp vụ ở các giai đoạn trên còn thay đổi.

**13.1** Optimistic locking: thêm check `version` vào `PATCH /tasks/:id`, trả 409 khi xung đột (mục 6.14).

**13.2** Phân trang/lọc/sắp xếp cho `GET /tasks` (mục 6.7.1) — thêm sau khi dữ liệu test đủ nhiều để thấy rõ nhu cầu.

**13.3** Rate limiting cho endpoint nhạy cảm, review lại validate input toàn bộ API.

**13.4** Viết integration test cho ma trận phân quyền đầy đủ (mục 6.21), bao gồm cả các case Cancel/Finalize/Unfinalize nếu chưa có test riêng.

**13.5** Chuẩn bị Dockerfile cho `apps/api` và `apps/web`, README hướng dẫn chạy local + biến môi trường cần thiết cho triển khai.

---

## Tóm tắt mốc quan trọng

| Sau giai đoạn | Có được gì |
|---|---|
| 4 | Bộ khung end-to-end chạy thật (auth + 1 API thật + UI thật) |
| 6 | CRUD nhiệm vụ đầy đủ, chưa có nghiệp vụ |
| 9 | Status + Audit Log + Hủy nhiệm vụ hoạt động đúng, kiểm chứng qua ứng dụng — nhưng mọi user vẫn thấy tất cả nhiệm vụ (chưa giới hạn theo phòng ban) |
| 11 | Đầy đủ business rule + phân quyền đúng thiết kế (phòng ban, khóa/chốt dữ liệu) |
| 12 | MVP hoàn chỉnh về mặt chức năng |
| 13 | Sẵn sàng triển khai thật |

Nếu thời gian gấp, có thể dừng ở cuối giai đoạn 9 để có bản demo nội bộ (một phòng ban dùng thử, dữ liệu chưa cần tách bạch), rồi làm tiếp 10–13 sau trước khi mở cho nhiều phòng ban cùng dùng.
