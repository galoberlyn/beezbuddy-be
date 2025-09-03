// src/database/pg.shutdown.ts
import { Injectable, OnApplicationShutdown, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './pg.constants';

@Injectable()
export class PgShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
