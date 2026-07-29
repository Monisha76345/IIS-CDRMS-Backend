# Admin module (portable) — mirrors CPMS `src/admin`

This folder is the CDRMS admin surface:

- Login / register (`auth`)
- User / person / post / post–person mapping (`users`)
- Roles (`roles`)
- Masters (geo / status / attributes) (`masters`)
- Series ID generator (`series-generator`)
- Shared admin helpers (`common`)

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
