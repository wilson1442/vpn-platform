import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StatsService } from './stats.service';
import { Roles } from '../../common/decorators';

@Controller('stats')
export class StatsController {
  constructor(private stats: StatsService) {}

  @Get('dashboard')
  @Roles(Role.ADMIN)
  getDashboard() {
    return this.stats.getDashboard();
  }
}
