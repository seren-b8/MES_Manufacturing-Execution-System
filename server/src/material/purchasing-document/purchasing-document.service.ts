import { error } from 'console';
// purchasing-document.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import moment = require('moment-timezone');
import { PurchasingDocument } from 'src/schema/purchasing-document.schema';
import { ResponseFormat } from 'src/shared/interface';
import {
  SyncPurchasingDocumentsDto,
  QueryPurchasingDocumentDto,
} from './dto/purchasing-document.dto';

interface ExternalPOResponse {
  success: boolean;
  message: string;
  data: {
    current_page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
    data: Array<{
      purchasing_document: string;
      item: string;
      doc_date: string;
      material: string;
      part_name: string;
      order_qty: string;
      order_unit: string;
      plant: string;
    }>;
  };
}

@Injectable()
export class PurchasingDocumentService {
  private readonly sapApiBaseUrl: string;
  private readonly poApiUrl: string;

  constructor(
    @InjectModel(PurchasingDocument.name)
    private readonly poModel: Model<PurchasingDocument>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // ดึง SAP_API_BASE_URL จาก environment variables
    this.sapApiBaseUrl = this.configService.get<string>('SAP_API_BASE_URL');
    this.poApiUrl = `${this.sapApiBaseUrl}/v1/po`;
  }

  /**
   * Sync PO data from external SAP API
   */
  async syncFromExternalAPI(
    dto: SyncPurchasingDocumentsDto,
  ): Promise<ResponseFormat<PurchasingDocument>> {
    try {
      // Call external SAP API
      const response = await firstValueFrom(
        this.httpService.get<ExternalPOResponse>(this.poApiUrl, {
          params: {
            material: dto.material,
            plant: dto.plant,
            page: dto.page || 1,
            limit: dto.limit || 20,
          },
          timeout: 30000, // 30 seconds timeout
        }),
      );

      if (!response.data.success) {
        throw new BadRequestException(
          response.data.message || 'Failed to fetch PO data from SAP',
        );
      }

      const externalData = response.data.data.data;

      if (!externalData || externalData.length === 0) {
        return {
          status: 'success',
          message: 'No PO data found for the specified criteria',
          data: [],
        };
      }

      const syncedDocuments: PurchasingDocument[] = [];
      const errors = [];

      // Process each PO item
      for (const item of externalData) {
        try {
          // Validate required fields
          if (!item.purchasing_document || !item.item) {
            errors.push({
              purchasing_document: item.purchasing_document || 'N/A',
              item: item.item || 'N/A',
              error: 'Missing required fields: purchasing_document or item',
            });
            continue;
          }

          const poDoc = await this.poModel.findOneAndUpdate(
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

          syncedDocuments.push(poDoc);
        } catch (error) {
          errors.push({
            purchasing_document: item.purchasing_document,
            item: item.item,
            error: (error as Error).message,
          });
        }
      }

      const responseMessage =
        errors.length > 0
          ? `Synced ${syncedDocuments.length} of ${externalData.length} PO items. ${errors.length} failed.`
          : `Successfully synced ${syncedDocuments.length} PO items`;

      return {
        status: errors.length === externalData.length ? 'error' : 'success',
        message: responseMessage,
        data: syncedDocuments,
      };
    } catch (error) {
      if ((error as any).response) {
        throw new BadRequestException(
          `SAP API Error: ${(error as any).response.data?.message || (error as Error).message}`,
        );
      }
      throw new BadRequestException(
        `Failed to sync PO data: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sync single PO by document number
   */
  async syncSinglePO(
    purchasing_document: string,
    plant: string,
  ): Promise<ResponseFormat<PurchasingDocument>> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<ExternalPOResponse>(this.poApiUrl, {
          params: {
            purchasing_document,
            plant,
            page: 1,
            limit: 100, // Get all items for this PO
          },
          timeout: 30000,
        }),
      );

      if (!response.data.success) {
        throw new BadRequestException(
          response.data.message || 'Failed to fetch PO data from SAP',
        );
      }

      const externalData = response.data.data.data;
      const syncedDocuments: PurchasingDocument[] = [];

      for (const item of externalData) {
        const poDoc = await this.poModel.findOneAndUpdate(
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

        syncedDocuments.push(poDoc);
      }

      return {
        status: 'success',
        message: `Successfully synced PO ${purchasing_document}`,
        data: syncedDocuments,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to sync PO ${purchasing_document}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Query PO documents
   */
  async findAll(
    query: QueryPurchasingDocumentDto,
  ): Promise<ResponseFormat<PurchasingDocument>> {
    const {
      material,
      plant,
      purchasing_document,
      status,
      doc_date_from,
      doc_date_to,
      page = 1,
      limit = 20,
    } = query;

    const filter: any = {};

    if (material) filter.material = material;
    if (plant) filter.plant = plant;
    if (purchasing_document) {
      filter.purchasing_document = new RegExp(purchasing_document, 'i');
    }
    if (status) filter.status = status;

    if (doc_date_from || doc_date_to) {
      filter.doc_date = {};
      if (doc_date_from) {
        filter.doc_date.$gte = moment(doc_date_from).startOf('day').toDate();
      }
      if (doc_date_to) {
        filter.doc_date.$lte = moment(doc_date_to).endOf('day').toDate();
      }
    }

    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      this.poModel
        .find(filter)
        .sort({ doc_date: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.poModel.countDocuments(filter).exec(),
    ]);

    return {
      status: 'success',
      message: `Found ${documents.length} purchasing documents (Total: ${total})`,
      data: documents,
    };
  }

  /**
   * Get PO by number and item
   */
  async findByPOAndItem(
    purchasing_document: string,
    item: string,
  ): Promise<ResponseFormat<PurchasingDocument>> {
    const poDoc = await this.poModel
      .findOne({ purchasing_document, item })
      .exec();

    if (!poDoc) {
      throw new BadRequestException(
        `PO ${purchasing_document} Item ${item} not found in local database. Please sync from SAP first.`,
      );
    }

    return {
      status: 'success',
      message: 'PO document retrieved successfully',
      data: [poDoc],
    };
  }

  /**
   * Update received quantity (เรียกจาก receipt service)
   */
  async updateReceivedQuantity(
    purchasing_document: string,
    item: string,
    received_qty: number,
  ): Promise<void> {
    const poDoc = await this.poModel
      .findOne({ purchasing_document, item })
      .exec();

    if (!poDoc) {
      throw new BadRequestException(
        `PO ${purchasing_document} Item ${item} not found`,
      );
    }

    poDoc.received_qty += received_qty;
    poDoc.last_received_date = moment().tz('Asia/Bangkok').toDate();
    await poDoc.save();
  }

  /**
   * Get available quantity for receiving
   */
  async getAvailableQuantity(
    purchasing_document: string,
    item: string,
  ): Promise<number> {
    const poDoc = await this.poModel
      .findOne({ purchasing_document, item })
      .exec();

    if (!poDoc) {
      throw new BadRequestException(
        `PO ${purchasing_document} Item ${item} not found`,
      );
    }

    return poDoc.remaining_qty;
  }

  /**
   * Validate PO before receiving
   */
  async validatePOForReceiving(
    purchasing_document: string,
    item: string,
    quantity: number,
  ): Promise<{ valid: boolean; message: string; available_qty?: number }> {
    const poDoc = await this.poModel
      .findOne({ purchasing_document, item })
      .exec();

    if (!poDoc) {
      return {
        valid: false,
        message: `PO ${purchasing_document} Item ${item} not found`,
      };
    }

    if (poDoc.status === 'completed') {
      return {
        valid: false,
        message: 'PO is already completed',
        available_qty: 0,
      };
    }

    if (poDoc.status === 'cancelled') {
      return {
        valid: false,
        message: 'PO is cancelled',
        available_qty: 0,
      };
    }

    if (poDoc.remaining_qty < quantity) {
      return {
        valid: false,
        message: `Insufficient quantity. Available: ${poDoc.remaining_qty}, Requested: ${quantity}`,
        available_qty: poDoc.remaining_qty,
      };
    }

    return {
      valid: true,
      message: 'PO is valid for receiving',
      available_qty: poDoc.remaining_qty,
    };
  }
}
