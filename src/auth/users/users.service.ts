import { HttpException, Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import firebaseAdmin from 'firebase-admin';
import { UserRepository } from './user.repository';
import { RoleRepository } from 'src/roles/role.repository';

@Injectable()
export class UsersService {
  logger = new Logger(UsersService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Creates a new user
   * @param createUserDto
   * @returns Promise<user>
   */
  async create(createUserDto: CreateUserDto) {
    try {
      const superAdmin = await this.roleRepository.findOneByName('Super Admin');
      if (!superAdmin) {
        throw new Error('Super Admin role not found');
      }
      const { user, customToken } =
        await this._createFirebaseUser(createUserDto);

      this.logger.log('User created in Firebase');

      const userRecord = await this.userRepository.create({
        ...createUserDto,
        firebaseId: user.uid,
        roleId: superAdmin.id,
      });
      this.logger.log('User created in database');

      return {
        ...user,
        customToken,
        ...userRecord,
      };
    } catch (error) {
      this.logger.error('Error creating a user: ', error);
      if (error.code === 'auth/email-already-exists') {
        throw new HttpException('User already exists', 409);
      }
      throw new HttpException(JSON.stringify(error), 500);
    }
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    console.log(updateUserDto);
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async _createFirebaseUser(createUserDto: CreateUserDto) {
    const user = await firebaseAdmin.auth().createUser({
      email: createUserDto.email,
      password: createUserDto.password,
      displayName: `${createUserDto.firstName} ${createUserDto.lastName}`,
      emailVerified: false,
    });

    const customToken = await firebaseAdmin.auth().createCustomToken(user.uid);

    return {
      user,
      customToken,
    };
  }
}
