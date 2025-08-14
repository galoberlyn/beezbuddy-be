import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(organization: string) {
    return await this.databaseService.organization.create({
      data: {
        name: organization,
      },
    });
  }
}
