import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Organization } from '@prisma/client';

@Injectable()
export class UserRepository {
  logger = new Logger(UserRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    user: CreateUserDto & { roleId: string; firebaseId: string },
    organization?: Partial<Organization>,
  ) {
    if (!organization) {
      throw new Error('Organization is required');
    }

    const organizationData = organization.id
      ? { connect: { id: organization.id } }
      : organization.name
        ? {
            create: {
              name: organization.name,
            },
          }
        : undefined;

    if (!organizationData) {
      throw new Error(
        'Organization data is incomplete: must provide id or name',
      );
    }

    return await this.databaseService.user.create({
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        firebaseId: user.firebaseId,
        role: {
          connect: { id: user.roleId },
        },
        organization: organizationData,
      },
      include: {
        role: true,
        organization: true,
      },
    });
  }

  async findOneById(id: string) {
    return await this.databaseService.user.findUnique({
      where: { id },
      include: {
        role: true,
        organization: true,
      },
    });
  }
}
