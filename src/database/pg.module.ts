// src/database/pg.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './pg.constants';
import { PgShutdown } from './pg.shutdown';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      useFactory: async (config: ConfigService) => {
        const pool = new Pool({
          host: config.get<string>('PG_HOST'),
          port: Number(config.get<string>('PG_PORT') ?? 5432),
          user: config.get<string>('PG_USER'),
          password: config.get<string>('PG_PASSWORD'),
          database: config.get<string>('PG_DATABASE'),
          // optional pool tuning:
          // max: 10,
          // idleTimeoutMillis: 30000,
          // connectionTimeoutMillis: 5000,
        });
        // optional: verify connectivity at boot
        await pool.query('select 1');
        return pool;
      },
      inject: [ConfigService],
    },
    PgShutdown,
  ],
  exports: [PG_POOL],
})
export class PgModule {}
