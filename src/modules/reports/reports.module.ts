import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../infrastracture/prisma/prisma.module';
import { ReportController } from './reports.controller';
import { ReportService } from './reports.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportsModule {}
