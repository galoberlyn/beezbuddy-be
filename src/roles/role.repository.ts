import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Role } from '@prisma/client';

@Injectable()
export class RoleRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findOneByName(name: string): Promise<Role | null> {
    return await this.databaseService.role.findFirst({
      where: {
        name: name,
      },
    });
  }
}
