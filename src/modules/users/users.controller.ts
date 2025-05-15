import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Res,
  HttpStatus,
  UploadedFiles,
  UsePipes,
  Inject,
  Req
} from '@nestjs/common';
import { Response } from 'express';
import { UserService } from './users.service';
import {
  UserCheckDto,
  UserCreateDto,
  UserUpdateDto,
} from './dto/users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/core/types/auth.types';

@Controller('api/users')
export class UsersController {
  constructor() {}
  @Inject()
  private readonly usersService: UserService

  @Get()
  @UseGuards(JwtAuthGuard)
  async findMany() {
    return this.usersService.findMany();
  }

  // @Get(':id')
  // @UseGuards(JwtAuthGuard)
  // async findOne(@Param('id') id: string, @Query() query: FindUserDto) {
  //   return this.usersService.findOne({ ...query, id });
  // }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: UserCreateDto) {
    return this.usersService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() body: UserUpdateDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.usersService.update(id, body, files);
  }

  @Get('organizations')
  @UseGuards(JwtAuthGuard)
  async getUserOrganizations(@Req() req: AuthenticatedRequest) {
    return this.usersService.getUserOrganizations(req.user['id']);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post('user')
  async checkOne(@Body() body: UserCheckDto, @Res() res: Response) {
    const { email } = body;
    const userExists = await this.usersService.userExists(email);
    if (userExists) {
      return res
        .status(HttpStatus.CONFLICT)
        .json({ message: 'The user with such email was found.' });
    }
    return res.status(HttpStatus.OK).json({ userExists: false });
  }
}
