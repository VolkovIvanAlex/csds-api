import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Get,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationCreateDto, OrganizationUpdateDto } from './dto/organization.dto';
import { AuthenticatedRequest } from 'src/core/types/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor() {}
  @Inject()
  private readonly organizationService: OrganizationService;

  @Post()
  create(@Body() createDto: OrganizationCreateDto, @Req() req: AuthenticatedRequest) {
    return this.organizationService.create(createDto, req.user['id']);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: OrganizationUpdateDto, @Req() req: AuthenticatedRequest) {
    return this.organizationService.update(id, updateDto, req.user['id']);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationService.remove(id);
  }

  @Get()
  findAll() {
    return this.organizationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }
}