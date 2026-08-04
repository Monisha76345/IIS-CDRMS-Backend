import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ParseAnyUuidPipe } from '../common/pipes/parse-any-uuid.pipe';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PersonStatus } from './enums/assignment-status';
import { UserType } from './enums/user-types.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(UserType.SUPER_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('mappings')
  async findAllMappings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAllMappings({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('mappings/unmapped-persons')
  async findUnmappedPersons() {
    return this.usersService.findUnmappedPersons();
  }

  @Get('mappings/post/:postId')
  async findActiveMappingByPost(
    @Param('postId', ParseAnyUuidPipe) postId: string,
  ) {
    return this.usersService.findActiveMappingByPostId(postId);
  }

  @Get('posts')
  async findAllPosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAllPosts({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('people')
  async findAllPeople(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAllPeople({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('roles')
  async findAllRoles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAllRoles({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('roles/:id')
  async findRoleById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findRoleById(id);
  }

  @Post('roles')
  async createRole(
    @Body()
    dto: {
      name: string;
      description?: string | null;
    },
  ) {
    return this.usersService.createRole(dto);
  }

  @Patch('roles/:id')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(id, dto);
  }

  @Post('mappings')
  async mapPersonToPost(
    @Body()
    dto: {
      personId: string;
      postId: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.usersService.mapPersonToPost({
      personId: dto.personId,
      postId: dto.postId,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  @Post('mappings/post/:postId/person/:personId')
  async mapPersonToPostByPath(
    @Param('postId', ParseAnyUuidPipe) postId: string,
    @Param('personId', ParseAnyUuidPipe) personId: string,
    @Body()
    body: {
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    return this.usersService.mapPersonToPost({
      personId,
      postId,
      startDate: body?.startDate ? new Date(body.startDate) : undefined,
      endDate: body?.endDate ? new Date(body.endDate) : undefined,
    });
  }

  @Put('mappings/:id/unmap')
  async unmapPersonFromPost(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.unmapPersonFromPost(id);
  }

  @Post('people')
  async createPerson(
    @Body()
    dto: {
      personUniqueId?: string;
      firstName?: string;
      lastName: string;
      email: string;
      mobileNumber?: string;
      gender?: string;
      state?: string;
      districtName?: string;
      districtId?: number;
      talukName?: string;
      talukId?: number;
      department?: string;
      departmentId?: string;
      status?: PersonStatus;
    },
  ) {
    return this.usersService.createPerson(dto);
  }

  @Post('posts')
  async createPost(
    @Body()
    dto: {
      postId?: string;
      postName: string;
      departmentName?: string;
      roleId: number;
      roleName?: string;
      locationId?: number;
      location?: string;
      ofcAddress?: string;
      email?: string;
      phoneNumber?: string;
      aliasName?: string;
      zoneId?: number | null;
      zoneCode?: string | null;
    },
  ) {
    return this.usersService.createPost(dto);
  }

  @Get('people/:id')
  async findPersonById(@Param('id', ParseAnyUuidPipe) id: string) {
    return this.usersService.findPersonById(id);
  }

  @Put('people/:id')
  async updatePerson(
    @Param('id', ParseAnyUuidPipe) id: string,
    @Body() dto: any,
  ) {
    return this.usersService.updatePerson(id, dto);
  }

  @Delete('people/:id')
  async deletePerson(@Param('id', ParseAnyUuidPipe) id: string) {
    await this.usersService.deletePerson(id);
    return { success: true };
  }

  @Get('posts/:id')
  async findPostById(@Param('id', ParseAnyUuidPipe) id: string) {
    return this.usersService.findPostById(id);
  }

  @Put('posts/:id')
  async updatePost(
    @Param('id', ParseAnyUuidPipe) id: string,
    @Body() dto: any,
  ) {
    return this.usersService.updatePost(id, dto);
  }

  @Delete('posts/:id')
  async deletePost(@Param('id', ParseAnyUuidPipe) id: string) {
    await this.usersService.deletePost(id);
    return { success: true };
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseAnyUuidPipe) id: string,
  ): Promise<{ message: string }> {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }
}
