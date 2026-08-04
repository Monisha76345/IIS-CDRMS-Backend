# IIS CDRMS Backend

NestJS API for CDRMS. Env loading:

1. `.env` — switcher only (`NODE_ENV=local` | `dev` | `prod`)
2. `.env.local` / `.env.dev` / `.env.prod` — full config for that environment

## Prerequisites

- Node.js 20+
- MySQL
- Optional: Redis (`REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`), MinIO

## Setup

```bash
npm install
# .env already has NODE_ENV=local
# edit .env.local as needed (DB_*, REDIS_*, APP_PORT, …)
npm run start:dev
```

When `REDIS_HOST` is set, Nest CacheModule uses Redis (Keonics-style) for token blacklist and other cache keys. Without it, cache falls back to in-memory.
API base: `http://localhost:3710/api`  
Health: `http://localhost:3710/api/health`

## Modules (ported from CPMS pattern)

| Module | Routes prefix | Notes |
|--------|---------------|--------|
| Auth | `/api/auth` | Cookie JWT (`access_token` / `refresh_token`) |
| Users | `/api/users` | Users / roles (CDRMS: `super_admin`, `cao`, `engineer`) |
| Masters | `/api/masters` | Geo, attributes, statuses, system params, district/taluk/village |
| Object store | `/api/object-store` | MinIO/S3 uploads + `object_store` metadata |
| Series | (internal) | IDs like `CDRMS00001` |

Login: `POST /api/auth/login` with `{ "email": "...", "password": "..." }` — sets httpOnly cookies.
