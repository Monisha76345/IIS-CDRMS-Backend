# IIS CDRMS Backend

NestJS API for CDRMS. All configuration lives in a single `.env` file.

## Prerequisites

- Node.js 20+
- MySQL
- Optional: Redis, MinIO

## Setup

```bash
npm install
# edit .env (APP_PORT, DB_*, CACHE_*, JWT_*, …)
npm run start:dev
```

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
