# DEPLOY PLAN — Oracle Cloud + Vercel

> **Phien ban:** 1.0  
> **Cap nhat:** 22/08/2026  
> **Trang thai:** Draft

---

## Tong quan kien truc

### Giai doan 1 (hien tai — chua co domain)

```
Frontend (Vercel Free) --> todolist-gttm.vercel.app
        |
        | NEXT_PUBLIC_API_URL --> http://<ORACLE_IP>/api
        v
Backend (Oracle Cloud Always Free)
  IP: <ORACLE_IP>
  +---------+     +------------------+
  | Caddy   | --> | API (NestJS)     |
  | :80     |     | :3001            |
  +---------+     +------------------+
        |
        v
  Supabase PostgreSQL (cloud)
```

### Giai doan 2 (sau khi co domain)

```
Oracle Cloud (ca 2 app)
  todolist.gttm.vn      --> Frontend
  api.todolist.gttm.vn  --> Backend
  SSL: Tu dong (Caddy + Let's Encrypt)
```

### Chi phi

| Component | Platform | Chi phi |
|---|---|---|
| Frontend (Next.js) | Vercel Free | $0 |
| Backend (NestJS) | Oracle Cloud Always Free | $0 |
| Database | Supabase Free | $0 |
| SSL | Caddy (Let's Encrypt) | $0 |
| Domain (khi co) | Namecheap/Cloudflare | ~$10/nam |
| **Tong** | | **$0/thang** |

---

## PHAN 1: SUA BLOCKER TRUOC KHI DEPLOY

### Blocker #1: next.config.ts thieu output: standalone

- **File:** `apps/web/next.config.ts`
- **Van de:** Dockerfile copy `.next/standalone` nhung Next.js khong tao thu muc nay
- **Fix:**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

### Blocker #2: API Dockerfile thieu prisma generate

- **File:** `apps/api/Dockerfile`
- **Van de:** Build se fail vi PrismaClient chua duoc generate
- **Fix:** Them `RUN npx prisma generate` vao builder stage

### Blocker #3: Dockerfile sai COPY context

- **File:** `apps/api/Dockerfile`, `apps/web/Dockerfile`
- **Van de:** `COPY package.json ./` se copy package.json cua root thay vi app
- **Fix:** Sua duong dan copy cho dung

### Blocker #4: docker-compose.yml sai env var name

- **File:** `docker-compose.yml`
- **Van de:** `SUPABASE_SERVICE_ROLE_KEY` nhung code dung `SUPABASE_SECRET_KEY`
- **Fix:** Doi ten env var trong docker-compose

### Blocker #5: Thieu .dockerignore

- **Van de:** Docker build copy ca `.git/`, `.env` (co secrets), `node_modules/`
- **Fix:** Tao `.dockerignore` o root

### Blocker #6: API .env co the bi track trong git

- **Van de:** `.env` chua `SUPABASE_SECRET_KEY`, `DATABASE_URL` co password
- **Kiem tra:** `git ls-files apps/api/.env`
- **Fix:** Neu bi track thi `git rm --cached apps/api/.env`

---

## PHAN 2: DEPLOY FRONTEND LEN VERCEL

### Buoc 2.1: Chuan bi

| # | Buoc | Chi tiet |
|---|---|---|
| 1 | Fix Blocker #1 | Them `output: 'standalone'` vao `next.config.ts` |
| 2 | Push code | Push len GitHub (chua bao gom `.env` files) |

### Buoc 2.2: Deploy tren Vercel

1. Dang nhap vercel.com -> Continue with GitHub
2. Import repo -> Chon `apps/web` lam root directory
3. Cau hinh:
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Buoc 2.3: Them Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  (anon key tu Supabase)
NEXT_PUBLIC_API_URL=http://<ORACLE_IP>/api
```

> **Luu y:** `NEXT_PUBLIC_` vars duoc embed vao client bundle khi build. PHAI set dung khi deploy.

### Buoc 2.4: Deploy

- Vercel tu build va tao URL: `https://todolist-gttm.vercel.app`
- Kiem tra bang cach mo URL va thu login

---

## PHAN 3: DEPLOY BACKEND LEN ORACLE CLOUD

### Buoc 3.1: Tao VM tren Oracle Cloud

1. Dang nhap oracle.com/cloud/free
2. Compute -> Instances -> Create Instance
3. Cau hinh:

| Setting | Gia tri |
|---|---|
| Name | `todolist-api` |
| Shape | VM.Standard.A1.Flex (ARM) |
| OCPUs | 2 (de 2 cores du phong) |
| RAM | 8 GB (de 16 GB du phong) |
| OS | Ubuntu 22.04 |
| Boot volume | 50 GB |
| SSH key | Tao hoac upload public key |

> **Luu y ARM:** Neu bi loi "Out of capacity", thu Availability Domain khac hoac retry sau.

### Buoc 3.2: Mo port trong OCI

OCI Console -> Networking -> VCN -> Security Lists -> Add Ingress Rules:

| Port | Protocol | Purpose |
|---|---|---|
| 80 | TCP | HTTP (Caddy) |
| 443 | TCP | HTTPS (Caddy) |

### Buoc 3.3: SSH vao VM va cai dat

```bash
# Ket noi SSH
ssh -i your-key.pem ubuntu@<PUBLIC_IP>

# Cai Docker
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
# Logout roi login lai de docker group co hieu luc

# Clone repo
git clone https://github.com/xxx/todolist_gttm.git
cd todolist_gttm
```

### Buoc 3.4: Cau hinh Environment Variables

Tao file `.env` o root directory:

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SECRET_KEY=eyJ...  (service_role key tu Supabase)

# Database
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres

# CORS
FRONTEND_URL=https://todolist-gttm.vercel.app

# Server
PORT=3001
```

> **QUAN TRONG:** Dung `SUPABASE_SECRET_KEY` (service_role), KHONG dung `SUPABASE_PUBLISHABLE_KEY` (anon).

### Buoc 3.5: Tao Caddyfile

```bash
cat > Caddyfile << 'EOF'
:80 {
    @api path /api/*
    @web not path /api/*

    handle @api {
        reverse_proxy localhost:3001
    }

    handle @web {
        reverse_proxy localhost:3000
    }
}
EOF
```

> **Luu y:** Chua co domain thi dung IP truc tiep tren port 80. Khi co domain thi cap nhat Caddyfile.

### Buoc 3.6: Cap nhat docker-compose.yml

Xem file `docker-compose.yml` o phan Tham khao ben duoi.

### Buoc 3.7: Deploy

```bash
docker-compose up -d --build
```

Kiem tra:

```bash
# Xem logs
docker-compose logs -f

# Kiem tra health
curl http://localhost:3001/api/health
```

---

## PHAN 4: CAU HINH SUPABASE

### Authentication -> URL Configuration

```
Site URL: https://todolist-gttm.vercel.app

Redirect URLs:
  - https://todolist-gttm.vercel.app/**
  - http://<ORACLE_IP>/**
```

> **Luu y:** Khi co domain, them domain moi vao whitelist.

---

## PHAN 5: SEED DATA CHO PRODUCTION

### Buoc 5.1: Chay SQL seed

Mo Supabase Dashboard -> SQL Editor -> Chay file `apps/api/prisma/seed-departments.sql`

File nay tao:
- 4 roles: ADMIN, SECRETARY, DEPARTMENT_EDITOR, VIEWER
- 22 phong ban (PHONG_01 den PHONG_22)

### Buoc 5.2: Tao user admin

1. Supabase Dashboard -> Authentication -> Users -> Invite User
2. Nhap email: `admin@gttm.vn`
3. User se nhan email invite de set password

### Buoc 5.3: Tao user record trong DB

```sql
INSERT INTO users (id, auth_user_id, full_name, role_id, department_id, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  '<auth_user_id_from_supabase>',
  'Admin',
  (SELECT id FROM roles WHERE name = 'ADMIN'),
  NULL,
  true,
  NOW(),
  NOW()
);
```

> **Luu y:** Lay `auth_user_id` tu Supabase Dashboard -> Authentication -> Users -> User detail.

---

## PHAN 6: MIGRATE SAU KHI CO DOMAIN

### Buoc 6.1: Mua domain

| Provider | Gia | Ghi chu |
|---|---|---|
| Cloudflare Registrar | ~$8/nam (.com) | Re nhat, recommended |
| Namecheap | ~$10/nam (.com) | Pho bien |

### Buoc 6.2: Cau hinh DNS

Them 2 A records:

```
todolist.gttm.vn      --> <ORACLE_IP>
api.todolist.gttm.vn  --> <ORACLE_IP>
```

### Buoc 6.3: Cap nhat Caddyfile

```bash
cat > Caddyfile << 'EOF'
todolist.gttm.vn {
    reverse_proxy localhost:3000
}

api.todolist.gttm.vn {
    reverse_proxy localhost:3001
}
EOF
```

Sau do restart Caddy:

```bash
docker-compose restart caddy
```

### Buoc 6.4: Cap nhat environment

Tren Oracle VM, cap nhat file `.env`:

```
FRONTEND_URL=https://todolist.gttm.vn
```

Tren Vercel Dashboard, cap nhat env var:

```
NEXT_PUBLIC_API_URL=https://api.todolist.gttm.vn/api
```

### Buoc 6.5: Cap nhat Supabase

Supabase Dashboard -> Authentication -> URL Configuration:

```
Site URL: https://todolist.gttm.vn

Redirect URLs:
  - https://todolist.gttm.vn/**
  - https://todolist-gttm.vercel.app/**  (giu lai de backup)
```

### Buoc 6.6: Deploy Frontend len Oracle (optional)

Khi da co domain, co the chuyen frontend sang Oracle de tiep kiem tri:

1. Cap nhat `docker-compose.yml` de build web tu source
2. Cap nhat Caddyfile de reverse proxy frontend
3. Update DNS de frontend truy cap Oracle truc tiep
4. Unlink repo tu Vercel

---

## PHAN 7: KIEM TRA SAU DEPLOY

| # | Kiem tra | Expected |
|---|---|---|
| 1 | Mo frontend URL | Trang login hien thi |
| 2 | Login voi tai khoan test | Vao duoc dashboard |
| 3 | `GET /api/health` | `{"status":"ok"}` |
| 4 | Tao/sua/xoa task | Hoat dung dung |
| 5 | Dashboard hien thi dung so lieu | Dung business rules |
| 6 | Audit log ghi nhan thay doi | Dung format |
| 7 | Supabase Auth callback | Redirect dung sau login |

---

## TOM TAT THOI GIAN

| Phase | Thoi gian | Chi phi |
|---|---|---|
| Fix blockers | 30 phut | $0 |
| Deploy Vercel (FE) | 15 phut | $0 |
| Deploy Oracle (BE) | 45 phut | $0 |
| Seed data | 15 phut | $0 |
| Test | 30 phut | $0 |
| **Tong** | **~2.5 gio** | **$0/thang** |

---

## THAM KHAO

### docker-compose.yml day du (sau khi fix blockers)

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api
      - web
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY}
      - FRONTEND_URL=${FRONTEND_URL}
      - PORT=3001
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    depends_on:
      - api
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

### .dockerignore

```
.git
.gitignore
**/.env
**/.env.*
**/node_modules
**/dist
**/.next
**/docs
**/*.md
.DS_Store
```

---

## AGENT NOTES — THONG TIN QUAN TRONG CHO CODING AGENT

> **PHAN NAY THONG TIN BAT BUOC PHAI DOC TRUOC KHI LAM BAT KY THAY DOI NAO.**

### 1. Codebase Architecture

```
todolist_gttm/
  apps/
    api/                    # NestJS backend (port 3001)
      src/
        auth/               # JWT verification qua Supabase API
        tasks/              # Task CRUD + status calculation
        users/              # User management
        departments/        # Department management
        audit-log/          # Audit logging (append-only)
        period-lock/        # Monthly data locking
        dashboard/          # Statistics aggregation
      prisma/
        schema.prisma       # Database schema (7 models)
        seed.ts             # Dev seed (3 depts, fake user)
        seed-departments.sql  # Production seed (22 depts)
      Dockerfile
    web/                    # Next.js frontend (port 3000)
      app/                  # App Router pages
      components/           # React components
      lib/
        api.ts              # API client (browser-side fetch)
        supabase/           # Supabase client + middleware
      Dockerfile
  docker-compose.yml
  docs/
```

### 2. Key Technical Decisions

| Quyet dinh | Ly do | File |
|---|---|---|
| NestJS dung service_role key de verify JWT | Goi Supabase API moi request | apps/api/src/auth/supabase.service.ts |
| Frontend chi dung client-side fetching | Tat ca page la "use client" | apps/web/app/ |
| Middleware chay moi request | Supabase session refresh qua cookie | apps/web/middleware.ts |
| Status tinh runtime, khong luu trong DB | Tranh mau thuan du lieu | apps/api/src/tasks/ |
| Optimistic locking bang version field | Ngan 2 user cung edit task dong thoi | apps/api/prisma/schema.prisma |
| Audit log trong cung transaction voi update | Dam bao du lieu va log luon dong bo | apps/api/src/audit-log/ |

### 3. Environment Variables — Day Du

**Backend (apps/api/.env):**

| Variable | Used in | Notes |
|---|---|---|
| SUPABASE_URL | supabase.service.ts | Supabase project URL |
| SUPABASE_SECRET_KEY | supabase.service.ts | Service role key, NOT publishable/anon key |
| SUPABASE_PUBLISHABLE_KEY | KHONG DUOC SU DUNG | Chi co trong .env nhung code khong goi |
| DATABASE_URL | schema.prisma | PostgreSQL connection string tu Supabase |
| FRONTEND_URL | main.ts (CORS) | Origin duoc phep goi API |
| PORT | main.ts | Default 3001 |

**Frontend (apps/web/.env):**

| Variable | Used in | Notes |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase client | Embedded vao client bundle |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase client | Anon key, an toan cho client |
| NEXT_PUBLIC_API_URL | lib/api.ts | Backend API URL, default http://localhost:3001 |

> **CRITICAL:** NEXT_PUBLIC_ vars duoc embed vao client bundle khi build time. Phai set dung khi deploy tren Vercel, khong phai runtime.

### 4. Frontend-Backend Communication

```
Browser -> Next.js (Vercel)
              |
              | GET /api/auth/me (client-side fetch)
              | Authorization: Bearer <supabase_access_token>
              v
         NestJS (Oracle Cloud)
              |
              | supabase.auth.getUser(token) -> Supabase API
              | prisma.user.findUnique(authUserId) -> PostgreSQL
              v
         Response -> Browser
```

**Luong request moi trang:**
- Middleware: 1 call supabase.auth.getUser() (server-side)
- Sidebar: 1 call GET /api/auth/me
- Header: 1 call GET /api/auth/me (trung lap voi Sidebar)
- Page content: 1-3 calls tuy trang

**Luu y:** Co su trung lap goi /api/auth/me giua Sidebar, Header va page content. Tong so call la 3-7 moi trang.

### 5. Supabase Integration

**Frontend (browser):**
- lib/supabase/client.ts — Tao Supabase client voi anon key
- lib/supabase/middleware.ts — Session refresh moi request
- middleware.ts — Redirect neu chua login

**Backend (server):**
- src/auth/supabase.service.ts — Tao Supabase client voi service_role key
- src/auth/auth.guard.ts — Verify JWT qua supabase.auth.getUser(token)
- src/auth/current-user.middleware.ts — Lay user info tu DB sau khi verify JWT

> **Quan trong:** Moi authenticated request tren NestJS deu goi Supabase API de verify JWT. Neu Supabase down -> tat ca API authenticate that bai.

### 6. Prisma Schema — 7 Models

```
Role          <- 4 roles: ADMIN, SECRETARY, DEPARTMENT_EDITOR, VIEWER
Department    <- 22 phong ban
User          <- 120 users (2/editor + 3/viewer per dept + 5 secretary + admin)
Task          <- 22 fields, 7 indexes (including composite)
TaskCoordinatingDepartment  <- Many-to-many join table
AuditLog      <- Append-only, 3 indexes
PeriodLock    <- Month-year locking
```

**Indexes (apps/api/prisma/schema.prisma):**
- tasks.ownerDepartmentId
- tasks.requiredCompletionDate
- tasks.actualCompletionDate
- tasks.isCancelled
- tasks.isFinalized
- tasks.createdAt
- tasks.[ownerDepartmentId, requiredCompletionDate] (composite)
- auditLogs.userId, auditLogs.entityId, auditLogs.createdAt

### 7. Docker Configuration

**API Dockerfile (apps/api/Dockerfile):**
- 3-stage build: deps -> builder -> runner
- Chua THIEU npx prisma generate trong builder stage (BLOCKER)
- Chay node dist/main.js trong production

**Web Dockerfile (apps/web/Dockerfile):**
- 3-stage build: deps -> builder -> runner
- Copy .next/standalone (yeu cau output: standalone trong next.config.ts — BLOCKER)
- Copy .next/static va public/
- Chay node server.js trong production

**docker-compose.yml:**
- 2 services: api, web
- Env var name SUPABASE_SERVICE_ROLE_KEY bi sai (code dung SUPABASE_SECRET_KEY)
- Chua co Caddy reverse proxy (can them)

### 8. Common Pitfalls

| # | Pitfall | Solution |
|---|---|---|
| 1 | Docker build fail vi copy sai package.json | Sua COPY path trong Dockerfile |
| 2 | Next.js build khong tao .next/standalone | Them output: standalone vao next.config.ts |
| 3 | PrismaClient khong tim thay | Them RUN npx prisma generate trong Dockerfile |
| 4 | CORS error khi frontend goi backend | Set FRONTEND_URL env var dung |
| 5 | Supabase Auth redirect that bai | Them URL vao Supabase Dashboard whitelist |
| 6 | 403 Forbidden moi request | Kiem tra SUPABASE_SECRET_KEY la service_role key |
| 7 | Database connection fail | Kiem tra DATABASE_URL va Supabase IP whitelist |

### 9. Testing Checklist

```
[ ] Login voi tai khoan admin
[ ] Xem dashboard -> so lieu dung
[ ] Tao task moi
[ ] Sua task -> audit log ghi dung
[ ] Huy task -> status hien "Da huy"
[ ] Chot task (finalize) -> khong sua duoc nua
[ ] Mo lai task (unfinalize) -> sua duoc lai
[ ] Login voi tai khoan department editor -> chi thay task phong minh
[ ] Login voi tai khoan viewer -> chi xem, khong sua duoc
[ ] Kiem tra dashboard theo phong ban
[ ] Kiem tra period lock (khóa thang)
```

### 10. Deployment Commands Quick Reference

```bash
# Fix blockers (trước khi deploy)
# 1. Sua next.config.ts
# 2. Sua Dockerfiles
# 3. Sua docker-compose.yml
# 4. Tao .dockerignore

# Deploy Frontend (Vercel)
# Push code -> Vercel auto build -> Set env vars

# Deploy Backend (Oracle Cloud)
ssh -i key.pem ubuntu@<IP>
cd todolist_gttm
docker-compose up -d --build

# Kiem tra
curl http://localhost:3001/api/health
docker-compose logs -f

# Seed data (Supabase SQL Editor)
# Chay apps/api/prisma/seed-departments.sql
```

### 11. Rollback Plan

Neu deploy that bai:

1. **Vercel:** Rollback to previous deployment trong Vercel Dashboard
2. **Oracle Cloud:** `docker-compose down && git checkout <previous-commit> && docker-compose up -d --build`
3. **Database:** Prisma migrations la forward-only, khong co rollback. Can restore tu Supabase backup neu can.

### 12. Monitoring

- **Health check:** GET /api/health -> {"status":"ok"}
- **Logs:** docker-compose logs -f (xem real-time)
- **Database:** Supabase Dashboard -> Database -> Logs
- **Auth:** Supabase Dashboard -> Authentication -> Logs
