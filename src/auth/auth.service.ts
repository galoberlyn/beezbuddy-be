import { HttpException, Injectable, Logger } from '@nestjs/common';
import { CreateAuthUserDto } from './dto/create-auth-user.dto';
import firebaseAdmin from 'firebase-admin';
import { RoleRepository } from 'src/roles/role.repository';
import { UserRepository } from './users/user.repository';
import { DecodedFirebaseTokenWithCustomClaims } from './guards/types';

@Injectable()
export class AuthService {
  logger = new Logger(AuthService.name);

  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Creates a new user in the platform as the organization admin
   */
  async create(createUserDto: CreateAuthUserDto) {
    try {
      const superAdmin = await this.roleRepository.findOneByName('Super Admin');
      if (!superAdmin) {
        throw new Error('Super Admin role not found');
      }

      // 1. Create Firebase user
      const firebaseUser = await firebaseAdmin.auth().createUser({
        email: createUserDto.email,
        password: createUserDto.password,
        displayName: `${createUserDto.firstName} ${createUserDto.lastName}`,
        emailVerified: false,
      });

      this.logger.log('User created in Firebase');

      // 2. Create local user in DB
      const localUser = await this.userRepository.create(
        {
          ...createUserDto,
          firebaseId: firebaseUser.uid,
          roleId: superAdmin.id,
        },
        { name: createUserDto.organization },
      );

      this.logger.log('User created in database');

      // 3. Set custom claims with local user ID
      await firebaseAdmin.auth().setCustomUserClaims(firebaseUser.uid, {
        userDbId: localUser.id,
        role: 'Super Admin',
        org: localUser.organizationId,
      });

      // 4. Create custom token
      const customToken = await firebaseAdmin
        .auth()
        .createCustomToken(firebaseUser.uid);

      return {
        firebaseUser,
        localUser,
        customToken,
      };
    } catch (error) {
      this.logger.error('Error creating a user:', error);
      if (error.code === 'auth/email-already-exists') {
        throw new HttpException('User already exists', 409);
      }
      throw new HttpException('Internal Server Error', 500);
    }
  }

  async getUser(user: DecodedFirebaseTokenWithCustomClaims) {
    const userDb = await this.userRepository.findOneById(user.userDbId);
    return userDb;
  }
}
