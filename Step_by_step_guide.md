# Kế hoạch triển khai — Trạng thái hiện tại

> Cập nhật: 24/09/2026
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
| Public registration request | Hoàn thành |
| Admin list/approve/reject registration | Hoàn thành |
| Admin cấp role + phòng ban khi approve | Hoàn thành |
| User bị pending chưa đăng nhập được | Hoàn thành qua Supabase `email_confirm: false` |
| Admin tạo user trực tiếp bằng flow cũ | Đã bỏ endpoint `POST /api/users` và UI form cũ |
| User/department management | Đang chạy |
| Task CRUD, status, approval, cancel, finalize | Đang chạy |
| Dashboard, period lock, optimistic locking | Đang chạy |
| Audit log field diff | Đang chạy; transaction coverage còn thiếu |
| Prisma migration cho registration request | Đã tạo và đã deploy |
| Docker API/web image | Đã có; web dùng standalone server |
| API/Web build, unit test hiện có | Pass |

## 3. Luồng tài khoản hiện tại

```text
Visitor
  -> POST /api/users/register
  -> UserRegistrationRequest(PENDING)
  -> Admin xem danh sách pending
  -> Approve + chọn role/department
  -> tạo/activate Supabase user + user nội bộ
  -> user đăng nhập
```

API chính:

```text
POST  /api/users/register
GET   /api/users/registration-requests              Admin
PATCH /api/users/registration-requests/:id/approve  Admin
PATCH /api/users/registration-requests/:id/reject   Admin
GET   /api/users                                     Admin
```

`POST /api/users` không còn là đường tạo user trực tiếp. Nếu cần tạo tài khoản mới, dùng registration request rồi Admin duyệt.

## 4. Chạy local

### Backend `apps/api/.env`

```env
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
DATABASE_URL=postgresql://...
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
PORT=3001
```

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

DB hiện hữu đã được baseline các migration cũ; migration registration request mới đã deploy. Không dùng `prisma migrate reset` trên DB thật.

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

Tạo `.env` ở root, gồm `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ALLOWED_ORIGINS`, và các biến `NEXT_PUBLIC_*`.

```bash
cd apps/api
npx prisma migrate deploy
npx prisma migrate status
cd ../..

docker compose build --no-cache
docker compose up -d
docker compose ps
curl http://localhost:3001/api/auth/status
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
- Render env: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ALLOWED_ORIGINS`, `PORT=3001`.
- Deploy API trước, lấy URL `onrender.com`, đặt vào `NEXT_PUBLIC_API_URL`, rồi deploy web.
- Cập nhật `ALLOWED_ORIGINS` trên Render bằng URL Vercel sau khi web deploy xong.

Giới hạn trial: Render Free sleep sau 15 phút idle, chỉ một instance, 750 instance-hours/workspace mỗi tháng; không coi là production. API hiện có throttler toàn cục 100 request/phút/process để chống abuse.

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

- Kiểm tra RBAC task list/detail: `GET /api/tasks` hiện cần lọc theo user/department/role đúng yêu cầu nghiệp vụ, không chỉ chặn mutation.
- Nối quan hệ coordinating department (`TaskCoordinatingDepartment`) vào query/permission; hiện một số flow còn dùng `coordinatingUnits` dạng text.
- Đưa mutation chính và audit log vào cùng transaction, đặc biệt update/delete/cancel/finalize.
- Chuẩn hóa validation/error mapping để frontend không chỉ nhận lỗi chung.
- Thêm rate limit/anti-abuse cho public registration và giới hạn resend/duplicate request.

### P1 — hardening

- Bảo vệ approve/reject khỏi double-submit và retry đồng thời.
- Bổ sung deactivate/reactivate user, xử lý user Supabase đã tồn tại nhưng request cũ bị từ chối.
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
- [ ] Admin approve chọn đúng role/department; user login được.
- [ ] Admin reject không tạo account active.
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
