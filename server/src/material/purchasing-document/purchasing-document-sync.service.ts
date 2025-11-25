// purchasing-document-sync.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import moment = require('moment-timezone');
import { PurchasingDocument } from 'src/schema/purchasing-document.schema';
import {
  ExternalPOResponse,
  PageResult,
  SyncParams,
  SyncResult,
} from 'src/shared/interface/purchasing-document-sync.interface';

@Injectable()
export class PurchasingDocumentSyncService {
  private readonly logger = new Logger(PurchasingDocumentSyncService.name);
  private readonly sapApiBaseUrl: string;
  private readonly poApiUrl: string;

  constructor(
    @InjectModel(PurchasingDocument.name)
    private readonly poModel: Model<PurchasingDocument>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.sapApiBaseUrl = this.configService.get<string>('SAP_API_BASE_URL');
    this.poApiUrl = `${this.sapApiBaseUrl}/v1/po`;
  }

  /**
   * สำหรับ Cron - Sync ทั้งหมดตาม config
   */
  async syncAll(): Promise<SyncResult> {
    const plants = this.configService.get<string[]>('AUTO_SYNC_PLANTS', [
      '1000',
    ]);
    const results: SyncResult[] = [];

    for (const plant of plants) {
      try {
        const result = await this.syncByPlant(plant);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to sync plant ${plant}`,
          (error as Error).stack,
        );
        results.push({
          plant,
          synced: 0,
          failed: 0,
          data: [],
          errors: [(error as Error).message],
        });
      }
    }

    return this.aggregateResults(results);
  }

  /**
   * Sync เฉพาะ PO ที่ยังเปิดอยู่
   */
  async syncOpenOrders(): Promise<SyncResult> {
    const plants = this.configService.get<string[]>('AUTO_SYNC_PLANTS', [
      '1000',
    ]);
    const results: SyncResult[] = [];

    for (const plant of plants) {
      try {
        // หา PO ที่ status = open หรือ partial
        const openPOs = await this.poModel
          .find({
            plant,
            status: { $in: ['open', 'partial'] },
          })
          .distinct('purchasing_document')
          .exec();

        this.logger.log(
          `Found ${openPOs.length} open POs in plant ${plant} to sync`,
        );

        const syncedDocs = [];
        for (const poNumber of openPOs) {
          try {
            const result = await this.syncSinglePO(poNumber, plant);
            syncedDocs.push(...result.data);
          } catch (error) {
            this.logger.error(
              `Failed to sync PO ${poNumber}`,
              (error as Error).stack,
            );
          }
        }

        results.push({
          plant,
          synced: syncedDocs.length,
          failed: 0,
          data: syncedDocs,
        });
      } catch (error) {
        this.logger.error(
          `Failed to sync open orders for plant ${plant}`,
          (error as Error).stack,
        );
      }
    }

    return this.aggregateResults(results);
  }

  /**
   * Sync ตาม plant
   */
  async syncByPlant(plant: string): Promise<SyncResult> {
    let page = 1;
    let hasMore = true;
    const syncedDocs = [];
    const errors = [];

    while (hasMore) {
      try {
        const result = await this.fetchAndSync({ plant, page, limit: 100 });
        syncedDocs.push(...result.data);

        hasMore = result.hasNextPage;
        page++;

        // Delay เพื่อไม่ให้ทำงานหนักเกินไป
        await this.delay(500);
      } catch (error) {
        this.logger.error(
          `Error syncing page ${page} for plant ${plant}`,
          (error as Error).stack,
        );
        errors.push({ page, error: (error as Error).message });
        hasMore = false;
      }
    }

    return {
      plant,
      synced: syncedDocs.length,
      failed: errors.length,
      data: syncedDocs,
      errors,
    };
  }

  /**
   * Sync single PO
   */
  async syncSinglePO(
    purchasing_document: string,
    plant: string,
  ): Promise<SyncResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<ExternalPOResponse>(this.poApiUrl, {
          params: {
            purchasing_document,
            plant,
            page: 1,
            limit: 100,
          },
          timeout: 30000,
        }),
      );

      if (!response.data.success) {
        throw new BadRequestException(
          response.data.message || 'Failed to fetch PO data from SAP',
        );
      }

      const items = response.data.data.data;
      const syncedDocs = [];

      for (const item of items) {
        const doc = await this.upsertPODocument(item);
        syncedDocs.push(doc);
      }

      return {
        synced: syncedDocs.length,
        failed: 0,
        data: syncedDocs,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to sync PO ${purchasing_document}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sync with parameters (for manual trigger)
   */
  async syncByParams(params: {
    material?: string;
    plant: string;
    page?: number;
    limit?: number;
  }): Promise<SyncResult> {
    const { page = 1, limit = 20 } = params;
    const syncedDocs = [];

    try {
      const result = await this.fetchAndSync({
        ...params,
        page,
        limit,
      });
      syncedDocs.push(...result.data);

      return {
        synced: syncedDocs.length,
        failed: 0,
        data: syncedDocs,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to sync: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Core sync logic
   */
  private async fetchAndSync(params: SyncParams): Promise<PageResult> {
    const response = await firstValueFrom(
      this.httpService.get<ExternalPOResponse>(this.poApiUrl, {
        params,
        timeout: 30000,
      }),
    );

    if (!response.data.success) {
      throw new BadRequestException(
        response.data.message || 'Failed to fetch from SAP',
      );
    }

    const items = response.data.data.data;
    const syncedDocs = [];

    for (const item of items) {
      try {
        const doc = await this.upsertPODocument(item);
        syncedDocs.push(doc);
      } catch (error) {
        this.logger.error(
          `Failed to upsert PO ${item.purchasing_document}-${item.item}`,
          (error as Error).stack,
        );
      }
    }

    return {
      data: syncedDocs,
      hasNextPage: params.page < response.data.data.total_pages,
      currentPage: params.page,
      totalPages: response.data.data.total_pages,
    };
  }

  private async upsertPODocument(item: any): Promise<PurchasingDocument> {
    return this.poModel.findOneAndUpdate(
      {
        purchasing_document: item.purchasing_document,
        item: item.item,
      },
      {
        purchasing_document: item.purchasing_document,
        item: item.item,
        doc_date: moment(item.doc_date, 'YYYY-MM-DD').toDate(),
        material: item.material,
        part_name: item.part_name,
        order_qty: parseFloat(item.order_qty),
        order_unit: item.order_unit,
        plant: item.plant,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  /**
   * รวมผลลัพธ์จากหลาย plants
   */
  private aggregateResults(results: SyncResult[]): SyncResult {
    return {
      totalSynced: results.reduce((sum, r) => sum + r.synced, 0),
      synced: results.reduce((sum, r) => sum + r.synced, 0),
      failed: results.reduce((sum, r) => sum + r.failed, 0),
      data: results.flatMap((r) => r.data),
      errors: results.flatMap((r) => r.errors || []),
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
