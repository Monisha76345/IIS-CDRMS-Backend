import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Role } from '../roles/entities/role.entity';
import { PersonalDetails } from './entities/personal-details.entity';
import { PostDetails } from './entities/post-details.entity';
import { PostPersonMapping } from './entities/post-person-mapping.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      PersonalDetails,
      PostDetails,
      PostPersonMapping,
    ]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
