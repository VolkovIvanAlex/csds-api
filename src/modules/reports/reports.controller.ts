import {
Body,
Controller,
Post,
Patch,
Delete,
Param,
UseGuards,
Req,
Get,
} from '@nestjs/common';
import { ReportService } from './reports.service';
import { ReportCreateDto, ReportUpdateDto } from './dto/report.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { AuthenticatedRequest } from 'src/core/types/auth.types';
  
@Controller('api/reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
    constructor(private readonly reportService: ReportService) {}
  
    @Post()
    create(@Body() dto: ReportCreateDto, @Req() req: AuthenticatedRequest) {
      return this.reportService.create(dto, req.user['id']);
    }

    @Get('user')
    getUserReports(@Req() req: AuthenticatedRequest) {
      return this.reportService.getUserReports(req.user['id']);
    }
  
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: ReportUpdateDto, @Req() req: AuthenticatedRequest) {
      return this.reportService.update(id, req.user['id'], dto);
    }
  
    @Delete(':id')
    remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
      return this.reportService.remove(id, req.user['id']);
    }
  
    @Post(':id/:sourceOrgId/share/:targetOrgId')
    share(@Param('id') id: string, @Param('targetOrgId') targetOrgId: string, @Param('sourceOrgId') sourceOrgId: string, @Req() req: AuthenticatedRequest) {
      return this.reportService.shareReport(id, sourceOrgId, targetOrgId, req.user['id']);
    }
  
    @Post(':id/:sourceOrgId/revoke/:targetOrgId')
    revoke(@Param('id') id: string, @Param('targetOrgId') targetOrgId: string, @Param('sourceOrgId') sourceOrgId: string, @Req() req: AuthenticatedRequest) {
      return this.reportService.revokeShare(id, sourceOrgId, targetOrgId, req.user['id']);
    }

    @Patch(':id/accept-share')
    async acceptShare(@Param('id') reportId: string, @Req() req: AuthenticatedRequest) {
        const userId = req.user['id'];
        if (!userId) {
        throw new Error('Unauthorized');
        }
        return this.reportService.acceptShare(reportId, userId);
    }

    @Post(':id/submit')
    async submitReport(
        @Param('id') id: string,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.reportService.submitReport(id, req.user['id']);
    }
}