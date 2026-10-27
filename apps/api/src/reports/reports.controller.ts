import { Controller, Get, Query } from '@nestjs/common';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  overview(@Query() query: ReportQueryDto) {
    return this.reportsService.overview(query);
  }

  @Get('dashboard')
  dashboard() {
    return this.reportsService.dashboard();
  }
}
