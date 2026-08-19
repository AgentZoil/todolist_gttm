# Task Tracking & Evaluation System

Web app quản lý, theo dõi và tổng hợp tình trạng thực hiện nhiệm vụ của 22 phòng ban thuộc Cục.

## Tech Stack

- **Frontend**: Next.js + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: NestJS + TypeScript + REST API + Prisma
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth

## Project Structure

```
/apps
  /web       (Next.js frontend)
  /api       (NestJS backend)
/docs
  technical-design.md
```

## Getting Started

### Prerequisites

- Node.js >= 18
- Supabase account (free tier)

### Setup

1. Clone repo
2. Create Supabase project at [supabase.com](https://supabase.com)
3. Copy `.env.example` to `.env` in both `/apps/web` and `/apps/api`
4. Fill in Supabase credentials
5. Follow setup instructions in each app directory

## Roles

- **Admin**: Full access, manage users, unlock data
- **Secretary**: Assign tasks, finalize tasks
- **Department Editor**: Manage tasks within own department
- **Viewer**: Read-only access
