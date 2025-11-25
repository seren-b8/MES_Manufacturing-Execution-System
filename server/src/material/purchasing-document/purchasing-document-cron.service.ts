// purchasing-document.service.ts
import { Injectable, Logger } from '@nestjs/common';

import moment = require('moment-timezone');
import { PurchasingDocumentSyncService } from './purchasing-document-sync.service';
import { Cron } from '@nestjs/schedule';

// purchasing-document-cron.service.ts
@Injectable()
export class PurchasingDocumentCronService {
  private readonly logger = new Logger(PurchasingDocumentCronService.name);

  constructor(private readonly syncService: PurchasingDocumentSyncService) {}

  /**
   * ทุกวันเวลา 02:00 น.
   */
  @Cron('0 2 * * *', {
    timeZone: 'Asia/Bangkok',
  })
  async handleDailySync() {
    this.logger.log('Starting daily PO sync...');

    try {
      const result = await this.syncService.syncAll();

      this.logger.log(
        `Daily sync completed: ${result.totalSynced} documents synced`,
      );
    } catch (error) {
      this.logger.error('Daily sync failed', (error as Error).stack);
    }
  }

  /**
   * ทุก 4 ชั่วโมง (optional - สำหรับข้อมูลที่ต้องการความถี่สูง)
   */
  @Cron('0 */4 * * *', {
    timeZone: 'Asia/Bangkok',
  })
  async handleFrequentSync() {
    this.logger.log('Starting frequent PO sync...');

    try {
      // Sync เฉพาะ open/partial POs
      const result = await this.syncService.syncOpenOrders();

      this.logger.log(
        `Frequent sync completed: ${result.totalSynced} documents updated`,
      );
    } catch (error) {
      this.logger.error('Frequent sync failed', (error as Error).stack);
    }
  }
}
