import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SapProductionSyncService } from './sap-sync.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { ResponseFormat } from 'src/shared/interface';
import { SapSyncLogService } from './sap-sync-log.service';
import { Role } from 'src/auth/enum/roles.enum';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { CustomThrottlerGuard } from 'src/auth/guard/custom-throttler.guard';
import {
  LongCacheInterceptor,
  MicroCacheInterceptor,
  ShortCacheInterceptor,
} from 'src/machine/interceptors/simple-cache.interceptor';
import { TimeoutInterceptor } from 'src/machine/interceptors/timeout.interceptor';

@Controller('sap-sync')
@UseGuards(JwtAuthGuard, CustomThrottlerGuard)
export class SapSyncController {
  constructor(
    private readonly sapSyncService: SapProductionSyncService,
    private readonly sapSyncLogService: SapSyncLogService,
  ) {}

  @Post('create-sync-log')
  async createSyncLog() {
    return this.sapSyncService.createSyncLogsFromPendingRecords();
  }

  @Post('send-logs-by-tid')
  async sendPendingSyncLogsById(
    @Body() payload: { tids: string[] },
  ): Promise<ResponseFormat<any>> {
    const tIds = payload.tids;
    const result = await this.sapSyncService.sendPendingSyncLogsByTid(tIds);

    // รับประกันว่า status เป็น 'success' หรือ 'error' เท่านั้น
    return {
      status: result.status as 'success' | 'error',
      message: result.message,
      data: result.data,
    };
  }

  @Post('logs/:id/retry')
  async retrySyncLog(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return {
        status: 'error',
        message: 'Invalid log ID format',
        data: [],
      };
    }

    return this.sapSyncService.retrySyncLog(new Types.ObjectId(id));
  }

  @Get('logs')
  @UseInterceptors(ShortCacheInterceptor, new TimeoutInterceptor(20000))
  async getSyncLogs(
    @Query('status') status?: 'pending' | 'completed' | 'failed',
    @Query('sync_type') syncType?: 'EMP' | 'SNC',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('employee_id') employeeId?: string,
    @Query('aufnr') aufnr?: string,
    @Query('tid') tid?: string,
  ) {
    const filter: any = {};

    // Basic filters
    if (status) filter.status = status;
    if (syncType) filter.sync_type = syncType;
    if (employeeId) filter.employee_id = employeeId;
    if (aufnr) filter.aufnr = aufnr;
    if (tid) filter.tid = tid;

    // Date range filter
    if (startDate || endDate) {
      filter.sync_timestamp = {};
      if (startDate) {
        filter.sync_timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.sync_timestamp.$lte = endDateTime;
      }
    }

    return this.sapSyncLogService.getSyncLogs(filter);
  }

  @Get('pending-tids-summary')
  @UseInterceptors(ShortCacheInterceptor, new TimeoutInterceptor(20000))
  @Roles(Role.ADMIN)
  async getPendingTidsSummary() {
    return this.sapSyncLogService.getPendingTidsSummary();
  }

  @Put('update-orders-current-month')
  @Roles(Role.ADMIN)
  async updateOrderToCurrentMonth() {
    return this.sapSyncService.updateOrdersToCurrentMonth();
  }
}
