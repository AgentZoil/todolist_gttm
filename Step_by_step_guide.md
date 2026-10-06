# Kế hoạch triển khai — Trạng thái hiện tại

> Cập nhật: 06/10/2026
>
> Tài liệu này thay thế plan cũ. Nội dung bám theo code hiện tại, không coi các hạng mục đã hoàn thành là việc cần làm lại.

## 1. Kiến trúc đang chạy

```text
Browser
  -> Next.js web :3000
  -> NestJS API :3001
  -> Prisma -> PostgreSQL/Supabase
  -> Supabase Auth
```

- Frontend gọi API qua `NEXT_PUBLIC_API_URL`.
- API dùng Supabase service key để xác thực/quản lý user; không đưa secret key lên frontend.
- API CORS đọc `ALLOWED_ORIGINS`, đồng thời cho phép localhost/127.0.0.1 ở local.
- RLS chưa phải lớp phân quyền chính; phân quyền hiện nằm ở NestJS guards/services.

## 2. Đã hoàn thành

| Hạng mục | Trạng thái |
|---|---|
| Login/logout/current user | Hoàn thành |
| Public registration request | Nhập email, mật khẩu 2 lần; Auth giữ mật khẩu, app DB không lưu; Admin duyệt mới kích hoạt |
| Password reset request | Email tạo yêu cầu cho Admin; Admin xác minh rồi cấp link một lần, app không gửi email |
| Admin list/approve/reject registration | Hoàn thành |
| Admin cấp role + phòng ban khi approve | Hoàn thành |
| User bị pending chưa đăng nhập được | Hoàn thành qua Supabase `email_confirm: false` |
| Admin tạo user trực tiếp bằng flow cũ | Đã bỏ endpoint `POST /api/users` và UI form cũ |
| Admin quản lý role, phòng ban và xóa user | Hoàn thành; không tự xóa hoặc xóa Admin cuối cùng; chặn xóa khi còn dữ liệu nghiệp vụ liên quan |
| Task CRUD, status, approval, cancel, finalize | Đang chạy; ngày nghiệp vụ dùng `YYYY-MM-DD` theo múi giờ Việt Nam |
| Dashboard, period lock, optimistic locking | Đang chạy |
| Audit log | Ghi cùng transaction cho task, user, phòng ban, khóa kỳ và duyệt đăng ký; giao diện phân trang toàn bộ lịch sử |
| Prisma migration | Có migration email user và yêu cầu reset mật khẩu; phải deploy trước release |
| Docker API/web image | Đã có; web dùng standalone server |
| API/Web build và lint phần auth đã sửa | Đã pass sau patch; chưa chạy unit test |

## 3. Luồng tài khoản hiện tại

```text
Visitor
  -> POST /api/users/register
  -> Supabase Auth tạo user với mật khẩu user chọn, email chưa xác minh
  -> UserRegistrationRequest(PENDING), không lưu mật khẩu vào app DB
  -> Admin xem danh sách pending
  -> Approve + chọn role/department
  -> Admin xác minh danh tính qua kênh tin cậy rồi mở tài khoản
  -> user đăng nhập bằng mật khẩu đã tạo
```

Email đăng ký không được xác minh qua mailbox. Nếu Admin chỉ tin email người dùng tự nhập, kẻ khác có thể đăng ký mạo danh email đó. Admin phải đối chiếu danh tính qua nguồn liên hệ đã biết trước khi duyệt.

Quên mật khẩu: người dùng gửi email ở trang quên mật khẩu; phản hồi luôn chung để không lộ email có tài khoản hay không. Yêu cầu chỉ tạo cho tài khoản đang hoạt động, giới hạn 5 lần/phút/IP và mỗi tài khoản có tối đa một yêu cầu chờ. Admin xác minh chủ tài khoản, duyệt rồi sao chép link đặt lại mật khẩu và gửi riêng. Admin không xem/đặt mật khẩu người dùng.

API chính:

```text
POST  /api/users/register
GET   /api/users/registration-requests              Admin
PATCH /api/users/registration-requests/:id/approve  Admin
PATCH /api/users/registration-requests/:id/reject   Admin
POST  /api/users/password-reset-requests           Public, throttled
GET   /api/users/password-reset-requests           Admin
PATCH /api/users/password-reset-requests/:id/approve Admin; sinh recovery link, không gửi email
PATCH /api/users/password-reset-requests/:id/reject  Admin
GET   /api/users                                     Admin, Secretary
PATCH /api/users/:id                                 Admin; đổi role/phòng ban
DELETE /api/users/:id                                Admin; xóa Auth và hồ sơ nếu không còn nhiệm vụ/feedback/kỳ khóa liên quan
```

`POST /api/users` không còn là đường tạo user trực tiếp. Nếu cần tạo tài khoản mới, dùng registration request rồi Admin duyệt.

Migration `20261006120000_add_password_reset_requests` thêm email vào bảng user và bảng yêu cầu đặt lại mật khẩu. Chạy `npx prisma migrate deploy` trước khi dùng flow mới. Reset link cần `FRONTEND_URL` là HTTPS ở production và URL `/reset-password` nằm trong allowlist Supabase Auth. Xác nhận cấu hình notification password-changed riêng của Supabase nếu cần tránh email thông báo bảo mật.

## 4. Chạy local

### Backend `apps/api/.env`

```env
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
DATABASE_URL=postgresql://...
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
FRONTEND_URL=http://localhost:3000
PORT=3001
```

Trong Supabase Auth, thêm `${FRONTEND_URL}/reset-password` vào danh sách Redirect URLs. Không đặt URL production thành localhost.
Đặt chính sách mật khẩu Supabase tối thiểu 12 ký tự; API rate limit dựa trên IP sau một proxy tin cậy.

### Frontend `apps/web/.env`

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

`NEXT_PUBLIC_API_URL` phải là URL browser truy cập được. Không dùng `http://api:3001/api` trong browser ngoài Docker network.

### Cài dependency và migration

```bash
cd apps/api && npm ci
cd ../web && npm ci

cd ../api
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
```

DB hiện hữu đã được baseline các migration cũ. Chạy `prisma migrate deploy` để áp dụng migration mới trước release; không dùng `prisma migrate reset` trên DB thật.

Seed tùy môi trường:

```bash
cd apps/api
npx ts-node prisma/seed.ts
```

### Start

```bash
# Terminal 1
cd apps/api && npm run start:dev

# Terminal 2
cd apps/web && npm run dev
```

Kiểm tra:

```bash
curl http://localhost:3001/api/auth/status
open http://localhost:3000/register
```

Nếu chạy Node trực tiếp ngoài Nest CLI, cần export env trước vì app không tự load `.env`:

```bash
set -a; source apps/api/.env; set +a
cd apps/api && npm run start:prod
```

## 5. Docker deploy

Tạo `.env` ở root, gồm `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ALLOWED_ORIGINS`, `FRONTEND_URL`, và các biến `NEXT_PUBLIC_*`.

Trước khi nâng cấp production, backup database. Migration mới làm `audit_logs.user_id` nullable và xóa bảng phối hợp cũ. Build image trước, dừng API cũ rồi mới chạy migration để phiên bản cũ không truy cập bảng đang bị xóa.

```bash
set -a; source .env; set +a
docker compose build
docker compose stop api web

cd apps/api
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
cd ../..

docker compose up -d
docker compose ps
curl -fsS http://localhost:3001/api/auth/status
docker compose logs -f api web
```

Entrypoint hiện tại:

- API production: `node dist/src/main.js`; `npm run start:prod` trỏ vào `dist/src/main`.
- Web production: Next standalone `node server.js` trong image.
- Web build dùng `next build --webpack` để tránh lỗi Turbopack trong môi trường hiện tại.

Sau khi đổi `NEXT_PUBLIC_API_URL`, phải build lại web image; biến `NEXT_PUBLIC_*` được nhúng lúc build.

### 5.1. Trial public free, không cần thẻ

Dùng Vercel cho `apps/web`, Render Free cho `apps/api`, Supabase giữ database/Auth.

- Render đọc Blueprint từ [`render.yaml`](./render.yaml), chạy một API service Docker.
- Vercel project root: `apps/web`.
- Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`.
- Render env: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ALLOWED_ORIGINS`, `FRONTEND_URL`, `PORT=3001`.
- Deploy API trước, lấy URL `onrender.com`, đặt vào `NEXT_PUBLIC_API_URL`, rồi deploy web.
- Cập nhật `ALLOWED_ORIGINS` trên Render bằng URL Vercel sau khi web deploy xong.

Giới hạn trial: Render Free sleep sau 15 phút idle, chỉ một instance, 750 instance-hours/workspace mỗi tháng; không coi là production. API giới hạn chung 100 request/phút/process; đăng ký public giới hạn 5 request/phút/IP.

### Xử lý `Failed to fetch`

1. Mở DevTools xem Request URL có đúng `NEXT_PUBLIC_API_URL` không.
2. Gọi `curl http://<api-host>:3001/api/auth/status` từ máy chạy browser.
3. Kiểm tra `ALLOWED_ORIGINS` khớp origin thực tế (`localhost`, `127.0.0.1`, LAN IP hoặc domain).
4. Kiểm tra preflight:

```bash
curl -i -X OPTIONS http://localhost:3001/api/users/register \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST'
```

5. Nếu API đúng nhưng browser vẫn dùng URL cũ, rebuild/restart web.

## 6. Việc còn thiếu theo ưu tiên

### P0 — cần xử lý trước production

- Xác nhận phân quyền nhiệm vụ: phòng ban xem được tất cả; đại diện phòng chỉ sửa nhiệm vụ của phòng mình; giữ nguyên các quyền ghi hiện có của Admin/Thư ký/Lãnh đạo theo từng thao tác.
- Deploy migration xóa `task_coordinating_departments` cũ; trường phối hợp đang dùng chuỗi `coordinatingUnits`.
- Ngày nhiệm vụ và lọc ngày dùng `YYYY-MM-DD` theo múi giờ `Asia/Ho_Chi_Minh`.
- Chuẩn hóa validation/error mapping để frontend không chỉ nhận lỗi chung.

### P1 — hardening

- Thêm integration tests cho role/department/task visibility và registration approval.
- Đặt reverse proxy/TLS/domain; cập nhật `ALLOWED_ORIGINS` production, không dùng wildcard.
- Thiết lập backup/restore drill, secret rotation, log/alert.

### P2 — mở rộng

- Realtime notification cho request/approval/task.
- File storage và attachment policy.
- Báo cáo/export.
- Đánh giá bật RLS trước khi cho frontend truy cập Supabase trực tiếp.

## 7. Release checklist

- [ ] Production env đủ biến, secret không commit.
- [ ] `npx prisma migrate status` báo up to date.
- [ ] API health trả 200.
- [ ] Web build pass.
- [ ] Đăng ký public tạo request `PENDING`.
- [ ] User pending không login được.
- [ ] Admin approve chọn đúng role/department; chỉ mailbox owner đặt mật khẩu và đăng nhập được.
- [ ] Admin reject không tạo account active.
- [ ] Admin đổi role/phòng ban, xóa user không còn dữ liệu liên quan; không thể tự xóa hoặc xóa Admin cuối cùng.
- [ ] Redirect URL Supabase trỏ đúng domain; recovery link đặt được mật khẩu.
- [ ] Password policy Supabase yêu cầu tối thiểu 12 ký tự.
- [ ] Audit log rollback cùng transaction khi mutation thất bại.
- [ ] Task permission test pass với từng role.
- [ ] CORS preflight pass từ domain production.
- [ ] Docker health/log không có crash loop.
- [ ] Backup và rollback plan đã kiểm tra.

## 8. Definition of Done

Release được coi là đạt khi:

1. Registration request chạy xuyên suốt từ public form đến Admin approval.
2. Không còn đường tạo user trực tiếp ngoài flow được duyệt.
3. Migration reproducible trên DB mới và DB hiện hữu.
4. API/web deploy được bằng Docker với URL/CORS đúng môi trường.
5. RBAC task visibility, transaction audit, rate limit public endpoint được kiểm thử trước production.
