import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SapProductionSyncService } from './sap-sync.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@Controller('sap-sync')
@UseGuards(JwtAuthGuard)
export class SapSyncController {
  constructor(private readonly sapSyncService: SapProductionSyncService) {}

  @Post('sync-pending')
  async syncPendingRecords() {
    return this.sapSyncService.syncPendingRecords();
  }

  @Get('logs')
  async getSyncLogs(
    @Query('status') status?: 'pending' | 'completed' | 'failed',
    @Query('sync_type') syncType?: 'EMP' | 'SNC',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('employee_id') employeeId?: string,
    @Query('aufnr') aufnr?: string,
  ) {
    const filter: any = {};

    // Basic filters
    if (status) filter.status = status;
    if (syncType) filter.sync_type = syncType;
    if (employeeId) filter.employee_id = employeeId;
    if (aufnr) filter.aufnr = aufnr;

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

    return this.sapSyncService.getSyncLogs(filter);
  }

  @Get('logs/failed')
  async getFailedLogs(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const filter: any = { status: 'failed' };

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

    return this.sapSyncService.getSyncLogs(filter);
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
}
