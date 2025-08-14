import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RoleRepository } from 'src/roles/role.repository';
import { DatabaseModule } from 'src/database/database.module';
import { UserRepository } from './users/user.repository';
import { OrganizationRepository } from './organizations/organization.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserRepository,
    RoleRepository,
    OrganizationRepository,
  ],
})
export class AuthModule {}
