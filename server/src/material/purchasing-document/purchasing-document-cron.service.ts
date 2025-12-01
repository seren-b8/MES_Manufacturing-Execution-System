import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PurchasingDocumentSyncService } from './purchasing-document-sync.service';

@Injectable()
export class PurchasingDocumentCronService {
  private readonly logger = new Logger(PurchasingDocumentCronService.name);

  constructor(private readonly syncService: PurchasingDocumentSyncService) {}

  @Cron('0 2 * * *', { timeZone: 'Asia/Bangkok' })
  async handleDailyFullSync() {
    this.logger.log('=== Starting Daily Full PO Sync ===');
    try {
      const result = await this.syncService.syncAll();
      this.logger.log(
        `✓ Daily sync completed: ${result.totalSynced} synced, ${result.failed} failed`,
      );
      if (result.errors?.length > 0) {
        this.logger.warn(`Sync errors: ${JSON.stringify(result.errors)}`);
      }
    } catch (error) {
      this.logger.error('✗ Daily sync failed', (error as Error).stack);
    }
  }

  @Cron('0 */4 * * *', { timeZone: 'Asia/Bangkok' })
  async handleIncrementalSync() {
    this.logger.log('=== Starting Incremental PO Sync ===');
    try {
      const result = await this.syncService.syncOpenOrders();
      this.logger.log(
        `✓ Incremental sync completed: ${result.totalSynced} updated`,
      );
    } catch (error) {
      this.logger.error('✗ Incremental sync failed', (error as Error).stack);
    }
  }

  @Cron('0 3 * * *', { timeZone: 'Asia/Bangkok' })
  async handleStaleRecordsCleanup() {
    this.logger.log('=== Starting Stale Records Cleanup ===');
    try {
      const count = await this.syncService.markStaleRecords();
      this.logger.log(`✓ Marked ${count} stale POs as inactive`);
    } catch (error) {
      this.logger.error(
        '✗ Stale records cleanup failed',
        (error as Error).stack,
      );
    }
  }
}
