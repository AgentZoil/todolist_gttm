# Hệ thống Theo dõi & Đánh giá Nhiệm vụ

A task tracking and evaluation system built with NestJS, Next.js, and Supabase.

## Tech Stack

- **Backend**: NestJS + Prisma + PostgreSQL (Supabase)
- **Frontend**: Next.js + Tailwind CSS + shadcn/ui
- **Auth**: Supabase Auth
- **Database**: PostgreSQL (Supabase)

## Features

- Task CRUD with department-level permissions
- Status calculation (completed early/on time/late)
- Audit logging with field-level diff
- Period lock and task finalization
- Dashboard with summary statistics
- Role-based access control (Admin, Secretary, Department Editor)

## Prerequisites

- Node.js 20+
- npm or yarn
- Supabase project (free tier works)

## Environment Variables

### Backend (apps/api/.env)

```env
# Supabase
SUPABASE_URL=your-project-url
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key

# Database (PostgreSQL connection string from Supabase)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Server
PORT=3001
```

### Frontend (apps/web/.env)

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

1. Create a Supabase project at https://supabase.com
2. Get your project URL and keys from Settings > API
3. Get your database connection string from Settings > Database
4. Update the `.env` files with your credentials

### 3. Run Database Migrations

```bash
cd apps/api
npx prisma generate
```

Then apply the SQL migration manually via psql or Supabase SQL Editor.

### 4. Seed the Database

```bash
cd apps/api
npx ts-node prisma/seed.ts
```

### 5. Start Development Servers

```bash
# Terminal 1 - Backend
cd apps/api
npm run start:dev

# Terminal 2 - Frontend
cd apps/web
npm run dev
```

### 6. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api

### 7. Test Accounts

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Admin | admin@gttm.vn | admin123 | ADMIN |
| Editor 01 | editor01@gttm.vn | editor123 | DEPARTMENT_EDITOR |
| Editor 02 | editor02@gttm.vn | editor123 | DEPARTMENT_EDITOR |

## Docker Deployment

### Using Docker Compose

```bash
# Create .env file in root directory with all required variables
cp apps/api/.env.example .env

# Build and start services
docker-compose up -d

# Access:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:3001
```

### Building Individual Images

```bash
# Backend
docker build -t task-api -f apps/api/Dockerfile .

# Frontend
docker build -t task-web -f apps/web/Dockerfile .
```

## API Endpoints

### Auth
- `GET /api/auth/status` - Health check
- `GET /api/auth/me` - Get current user
- `GET /api/auth/roles` - Get available roles

### Tasks
- `GET /api/tasks` - List tasks (with pagination, search, filters)
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task (with optimistic locking)
- `PATCH /api/tasks/:id/cancel` - Cancel task (Admin/Secretary only)
- `PATCH /api/tasks/:id/finalize` - Finalize task
- `PATCH /api/tasks/:id/unfinalize` - Unfinalize task (Admin only)

### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department (Admin only)
- `PATCH /api/departments/:id` - Update department (Admin only)

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user (Admin only)

### Dashboard
- `GET /api/dashboard/summary` - Get summary statistics
- `GET /api/dashboard/departments` - Get department statistics

### Audit Logs
- `GET /api/audit-logs` - List audit logs (Admin only)
- `GET /api/audit-logs/:id` - Get audit log details

### Period Locks
- `GET /api/period-locks` - List locked periods
- `POST /api/period-locks/:year/:month` - Lock period (Admin only)
- `DELETE /api/period-locks/:year/:month` - Unlock period (Admin only)

## Project Structure

```
todolist_gttm/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/          # Authentication & authorization
│   │   │   ├── tasks/         # Task module
│   │   │   ├── users/         # Users module
│   │   │   ├── departments/   # Departments module
│   │   │   ├── audit-log/     # Audit logging
│   │   │   ├── period-lock/   # Period locking
│   │   │   └── dashboard/     # Dashboard statistics
│   │   └── prisma/            # Prisma schema & migrations
│   └── web/                    # Next.js frontend
│       ├── app/
│       │   ├── (dashboard)/    # Dashboard pages
│       │   └── login/          # Login page
│       ├── components/         # React components
│       └── lib/                # Utilities & API client
├── docs/                       # Documentation
├── docker-compose.yml          # Docker compose config
└── README.md                   # This file
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm run test`
4. Submit a pull request

## License

MIT
