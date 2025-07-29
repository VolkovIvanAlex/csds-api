import { Body, Controller, Post, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ReportService } from '../reports/reports.service';
import { FiwareNotificationDto } from './dto/report.dto';

@Controller('api/notifications')
export class NotificationController {
  constructor() {}

  @Inject()
  private readonly reportService: ReportService

  @Post('submitted')
  @HttpCode(HttpStatus.OK) // Respond with 200 OK so Orion knows we received it
  handleFiwareNotification(@Body() notification: any) {
    console.log("Handling subscription ...");
    // Asynchronously handle the logic without blocking the response to Orion
    this.reportService.handleSubmittedReport(notification).catch(err => {
        console.error('Error handling FIWARE notification:', err);
    });
    return;
  }
}