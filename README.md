# Task Tracking & Evaluation System

Web app quản lý, theo dõi và tổng hợp tình trạng thực hiện nhiệm vụ của 22 phòng ban thuộc Cục.

## Tech Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend**: NestJS + TypeScript + REST API + Prisma
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth

## Project Structure

```
/apps
  /web       (Next.js frontend — port 3000)
  /api       (NestJS backend — port 3001)
/docs
  technical-design.md   (Business Requirements v1.1)
  design-system.md      (Corporate Trust theme)
  security.md           (RLS decision)
```

## Getting Started

### Prerequisites

- Node.js >= 18
- Supabase account (free tier)
- PostgreSQL (via Supabase)

### Setup

1. Clone repo
2. Create Supabase project at [supabase.com](https://supabase.com)
3. Copy `.env.example` to `.env` in both `/apps/web` and `/apps/api`
4. Fill in Supabase credentials (URL, anon key, service role key, DB connection string)
5. Run seed: `cd apps/api && npx prisma db seed`
6. Create test user in Supabase Auth dashboard (or use the existing test account)

### Run

```bash
# Terminal 1 — Backend
cd apps/api && npm run start:dev

# Terminal 2 — Frontend
cd apps/web && npm run dev
```

Open `http://localhost:3000`

### Test Account

| Field | Value |
|---|---|
| Email | `test-admin@gttm.vn` |
| Password | `Test@123456` |
| Role | ADMIN |
| Department | PHONG_01 |

## Roles

- **Admin**: Full access, manage users, unlock data
- **Secretary**: Assign tasks, finalize tasks
- **Department Editor**: Manage tasks within own department
- **Viewer**: Read-only access

## Current Status

| Stage | Status |
|---|---|
| 0 — Workspace | Done |
| 1 — Backend skeleton | Done |
| 2 — Auth skeleton | Done |
| 3 — Frontend skeleton | Done |
| 4–13 | Pending |
