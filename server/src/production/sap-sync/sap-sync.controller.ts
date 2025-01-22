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
  ) {
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (syncType) {
      filter.sync_type = syncType;
    }

    if (startDate || endDate) {
      filter.sync_timestamp = {};
      if (startDate) {
        filter.sync_timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.sync_timestamp.$lte = new Date(endDate);
      }
    }

    return this.sapSyncService.getSyncLogs(filter);
  }

  @Get('logs/failed')
  async getFailedLogs() {
    return this.sapSyncService.getSyncLogs({ status: 'failed' });
  }

  @Post('logs/:id/retry')
  async retrySyncLog(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return {
        status: 'error',
        message: 'Invalid log ID',
        data: [],
      };
    }

    return this.sapSyncService.retrySyncLog(new Types.ObjectId(id));
  }

  @Post('sync-records')
  async syncSpecificRecords(@Query('record_ids') recordIds: string) {
    const ids = recordIds.split(',').filter((id) => Types.ObjectId.isValid(id));

    if (ids.length === 0) {
      return {
        status: 'error',
        message: 'No valid record IDs provided',
        data: [],
      };
    }

    return this.sapSyncService.syncSpecificRecords(
      ids.map((id) => new Types.ObjectId(id)),
    );
  }
}
