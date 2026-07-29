# IIS CDRMS Backend

NestJS API for CDRMS. Env loading matches the CPMS/DMS style:

1. `.env` — switcher only (`NODE_ENV=local` | `dev` | `prod`)
2. `.env.local` / `.env.dev` / `.env.prod` — full config for that environment

## Prerequisites

- Node.js 20+
- MySQL (local: `root` / `root@123`)
- Optional: Redis, MinIO

## Setup

```bash
npm install
cp .env.example .env   # already present with NODE_ENV=local
# edit .env.local as needed (DB_DATABASE=cdrms)
npm run start:dev
```

API base: `http://localhost:3700/api`  
Health: `http://localhost:3700/api/health`

## Seed admin

```bash
# Start the API once so TypeORM can create tables (DB_SYNCHRONIZE=true)
npm run start:dev
# In another terminal:
npm run seed
```

Admin: `admin@cdrms.local` / `CDRMS00001` / `Okay@123`

## Modules (ported from CPMS pattern)

| Module | Routes prefix | Notes |
|--------|---------------|--------|
| Auth | `/api/auth` | Cookie JWT (`access_token` / `refresh_token`) |
| Users | `/api/users` | Users / roles (CDRMS: `super_admin`, `cao`, `engineer`) |
| Masters | `/api/masters` | Geo, attributes, statuses, system params, district/taluk/village |
| Object store | `/api/object-store` | MinIO/S3 uploads + `object_store` metadata |
| Series | (internal) | IDs like `CDRMS00001` |

Login: `POST /api/auth/login` with `{ "email": "...", "password": "..." }` — sets httpOnly cookies.
