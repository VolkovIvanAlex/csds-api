import { Module } from '@nestjs/common';
import { NGSIService } from './ngsi.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [NGSIService],
  exports: [NGSIService],
})
export class NGSIModule {}
