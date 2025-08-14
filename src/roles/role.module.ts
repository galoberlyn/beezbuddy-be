// role.module.ts
import { Module } from '@nestjs/common';
import { RoleRepository } from './role.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [RoleRepository],
  exports: [RoleRepository],
})
export class RoleModule {}
