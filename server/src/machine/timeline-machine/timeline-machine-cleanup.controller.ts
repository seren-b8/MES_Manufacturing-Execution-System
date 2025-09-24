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
import * as moment from 'moment-timezone';

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
      const now = moment().tz('Asia/Bangkok');
      const yesterday = now.clone().subtract(1, 'day').startOf('day');

      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

      const cleanupDto: CleanupTimelineDto = {
        date_range: {
          start: yesterday.format('YYYY-MM-DD'),
          end: now.format('YYYY-MM-DD'), // ถึงวันปัจจุบัน
        },
        dry_run: this.cronDryRun,
        batch_size: this.cronBatchSize,
      };

      const result =
        await this.timelineMachineService.executeCleanup(cleanupDto);

      this.logger.log('✅ Auto cleanup cron job completed successfully', {
        deletedCount: result.total_removed_records,
        dateRange: cleanupDto.date_range,
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
