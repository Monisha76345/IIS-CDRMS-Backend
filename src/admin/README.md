# Admin module (portable) — mirrors CPMS `src/admin`

This folder is the CDRMS admin surface:

- Login / register (`auth`)
- User / person / post / post–person mapping (`users`)
- Roles (`roles`)
- Masters (geo / attributes) (`masters`)
- **Public common-data API** (`public`) — unauthenticated GETs for districts, taluqs, zones, attributes, etc.
- Series ID generator (`series-generator`)
- Shared admin helpers (`common`)

### Public API (`/api/public/*`)

No JWT. Read-only reference data for dropdowns / forms (Keonics-style). Writes stay on `/api/masters/*` with JWT.

| Method | Path |
|--------|------|
| GET | `/public/countries` |
| GET | `/public/states?countryId=` |
| GET | `/public/districts?stateId=` |
| GET | `/public/taluqs?districtId=` |
| GET | `/public/zones/active` |
| GET | `/public/attributes?type=&status=` |
| GET | `/public/application-statuses` (static list from `applications.status` enum — no DB table) |

## Wire-up

```ts
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true }),
    TypeOrmModule.forRoot({ /* ... */ autoLoadEntities: true }),
    AdminModule,
    ApplicationsModule,
    ObjectStoreModule,
  ],
})
export class AppModule {}
```

Domain modules that stay outside `admin/`:

- `applications` — ZC / engineer / CAO workflow
- `object-store` — MinIO uploads
