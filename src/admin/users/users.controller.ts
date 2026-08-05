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
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ParseAnyUuidPipe } from '../common/pipes/parse-any-uuid.pipe';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PersonStatus } from './enums/assignment-status';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('USER:VIEW')
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
  @Permissions('USER:VIEW')
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
  @Permissions('USER:VIEW')
  async findUnmappedPersons() {
    return this.usersService.findUnmappedPersons();
  }

  @Get('mappings/post/:postId')
  @Permissions('USER:VIEW')
  async findActiveMappingByPost(
    @Param('postId', ParseAnyUuidPipe) postId: string,
  ) {
    return this.usersService.findActiveMappingByPostId(postId);
  }

  @Get('posts')
  @Permissions('USER:VIEW')
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
  @Permissions('USER:VIEW')
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
  @Permissions('USER:VIEW')
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
  @Permissions('USER:VIEW')
  async findRoleById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findRoleById(id);
  }

  @Post('roles')
  @Permissions('USER:ADD')
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
  @Permissions('USER:UPDATE')
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
  @Permissions('USER:ADD')
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
  @Permissions('USER:ADD')
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
  @Permissions('USER:UPDATE')
  async unmapPersonFromPost(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.unmapPersonFromPost(id);
  }

  @Post('people')
  @Permissions('USER:ADD')
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
  @Permissions('USER:ADD')
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
  @Permissions('USER:VIEW')
  async findPersonById(@Param('id', ParseAnyUuidPipe) id: string) {
    return this.usersService.findPersonById(id);
  }

  @Put('people/:id')
  @Permissions('USER:UPDATE')
  async updatePerson(
    @Param('id', ParseAnyUuidPipe) id: string,
    @Body() dto: any,
  ) {
    return this.usersService.updatePerson(id, dto);
  }

  @Delete('people/:id')
  @Permissions('USER:DELETE')
  async deletePerson(@Param('id', ParseAnyUuidPipe) id: string) {
    await this.usersService.deletePerson(id);
    return { success: true };
  }

  @Get('posts/:id')
  @Permissions('USER:VIEW')
  async findPostById(@Param('id', ParseAnyUuidPipe) id: string) {
    return this.usersService.findPostById(id);
  }

  @Put('posts/:id')
  @Permissions('USER:UPDATE')
  async updatePost(
    @Param('id', ParseAnyUuidPipe) id: string,
    @Body() dto: any,
  ) {
    return this.usersService.updatePost(id, dto);
  }

  @Delete('posts/:id')
  @Permissions('USER:DELETE')
  async deletePost(@Param('id', ParseAnyUuidPipe) id: string) {
    await this.usersService.deletePost(id);
    return { success: true };
  }

  @Delete(':id')
  @Permissions('USER:DELETE')
  async remove(
    @Param('id', ParseAnyUuidPipe) id: string,
  ): Promise<{ message: string }> {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }
}
