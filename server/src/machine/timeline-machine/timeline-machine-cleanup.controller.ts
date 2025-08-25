import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { TimelineMachineCleanupService } from './timeline-machine-cleanup.service';
import { Cron } from '@nestjs/schedule';

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

export class CronConfigDto {
  enabled: boolean;
  schedule?: string; // cron expression
  batch_size?: number;
  dry_run?: boolean;
}

@Controller('timeline-machine')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimelineMachineCleanupController {
  private readonly logger = new Logger(TimelineMachineCleanupController.name);
  private cronEnabled = true;
  private cronBatchSize = 1000;
  private cronDryRun = false;

  constructor(
    private readonly timelineMachineService: TimelineMachineCleanupService,
  ) {}

  @Post('cleanup/preview')
  @Roles(Role.ADMIN)
  async getCleanupPreview(@Body() cleanupDto: CleanupTimelineDto) {
    return {
      status: 'success',
      message: 'Cleanup preview generated successfully',
      data: [await this.timelineMachineService.getCleanupPreview(cleanupDto)],
    };
  }

  @Post('cleanup/execute')
  @Roles(Role.ADMIN)
  async executeCleanup(@Body() cleanupDto: CleanupTimelineDto) {
    const result = await this.timelineMachineService.executeCleanup(cleanupDto);
    return {
      status: 'success',
      message: 'Timeline data cleanup completed successfully',
      data: [result],
    };
  }

  @Get('cleanup/estimate-savings')
  @Roles(Role.ADMIN)
  async estimateStorageSavings(@Query() query: CleanupTimelineDto) {
    const result =
      await this.timelineMachineService.estimateStorageSavings(query);
    return {
      status: 'success',
      message: 'Storage savings estimated successfully',
      data: [result],
    };
  }

  @Cron('0 0 0 * * *', {
    name: 'timeline-auto-cleanup',
    timeZone: 'Asia/Bangkok',
  })
  async autoCleanupCronJob() {
    if (!this.cronEnabled) {
      this.logger.log('⏸️ Auto cleanup cron job is disabled, skipping...');
      return;
    }

    try {
      this.logger.log('🧹 Starting auto cleanup cron job...');
      // คำนวณวันที่ (เมื่อวาน ถึง เมื่อวาน-1)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

      // Format วันที่เป็น YYYY-MM-DD
      const endDate = yesterday.toISOString().split('T')[0];
      const startDate = dayBeforeYesterday.toISOString().split('T')[0];

      const cleanupDto: CleanupTimelineDto = {
        date_range: {
          start: startDate,
          end: endDate,
        },
        dry_run: this.cronDryRun,
        batch_size: this.cronBatchSize,
      };

      // ทำการ cleanup
      const result =
        await this.timelineMachineService.executeCleanup(cleanupDto);

      this.logger.log('✅ Auto cleanup cron job completed successfully', {
        deletedCount: result.total_removed_records,
        dateRange: { startDate, endDate },
        dryRun: this.cronDryRun,
      });
    } catch (error) {
      this.logger.error(
        '❌ Auto cleanup cron job failed:',
        (error as Error).message,
        (error as Error).stack,
      );
      // อาจเพิ่ม notification service ที่นี่
    }
  }
}
