import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { TimelineMachineCleanupService } from './timeline-machine-cleanup.service';

// DTOs
export class CleanupTimelineDto {
  machine_number?: string;
  date_range?: {
    start: string;
    end: string;
  };
  dry_run?: boolean;
  batch_size?: number;
}

@Controller('timeline-machine')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimelineMachineCleanupController {
  constructor(private readonly cleanupService: TimelineMachineCleanupService) {}

  @Post('cleanup/preview')
  @Roles(Role.ADMIN)
  async getCleanupPreview(@Body() cleanupDto: CleanupTimelineDto) {
    return {
      status: 'success',
      message: 'Cleanup preview generated successfully',
      data: [await this.cleanupService.getCleanupPreview(cleanupDto)],
    };
  }

  @Post('cleanup/execute')
  @Roles(Role.ADMIN)
  async executeCleanup(@Body() cleanupDto: CleanupTimelineDto) {
    const result = await this.cleanupService.executeCleanup(cleanupDto);
    return {
      status: 'success',
      message: 'Timeline data cleanup completed successfully',
      data: [result],
    };
  }

  @Get('cleanup/estimate-savings')
  @Roles(Role.ADMIN)
  async estimateStorageSavings(@Query() query: CleanupTimelineDto) {
    const result = await this.cleanupService.estimateStorageSavings(query);
    return {
      status: 'success',
      message: 'Storage savings estimated successfully',
      data: [result],
    };
  }
}
