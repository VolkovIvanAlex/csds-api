import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../infrastracture/prisma/prisma.module';
import { ReportController } from './reports.controller';
import { ReportService } from './reports.service';
import { NGSIModule } from '../ngsi/ngsi.module';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [AuthModule, PrismaModule, NGSIModule],
  controllers: [ReportController],
  providers: [ReportService, BlockchainService],
})
export class ReportsModule {}
