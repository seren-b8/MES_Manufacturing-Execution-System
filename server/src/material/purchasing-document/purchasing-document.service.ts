import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import moment = require('moment-timezone');
import { PurchasingDocument } from 'src/schema/purchasing-document.schema';
import { ResponseFormat } from 'src/shared/interface';
import {
  QueryPurchasingDocumentDto,
  SyncStatsQueryDto,
  StatusStatsQueryDto,
} from './dto/purchasing-document.dto';

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
    this.sapApiBaseUrl = this.configService.get<string>('SAP_API_BASE_URL');
    this.poApiUrl = `${this.sapApiBaseUrl}/v1/po`;
  }

  /**
   * Query PO documents with filters
   */
  async findAll(
    query: QueryPurchasingDocumentDto,
  ): Promise<ResponseFormat<PurchasingDocument>> {
    try {
      const {
        material,
        plant,
        purchasing_document,
        status,
        sap_active,
        doc_date_from,
        doc_date_to,
        sap_last_sync_from,
        sap_last_sync_to,
        page = 1,
        limit = 20,
        sort = '-doc_date',
      } = query;

      const filter: any = {};

      // Basic filters
      if (material) filter.material = material;
      if (plant) filter.plant = plant;
      if (purchasing_document) {
        filter.purchasing_document = new RegExp(purchasing_document, 'i');
      }
      if (status) filter.status = status;
      if (sap_active !== undefined) filter.sap_active = sap_active;

      // Date range filters
      if (doc_date_from || doc_date_to) {
        filter.doc_date = {};
        if (doc_date_from) {
          filter.doc_date.$gte = moment(doc_date_from).startOf('day').toDate();
        }
        if (doc_date_to) {
          filter.doc_date.$lte = moment(doc_date_to).endOf('day').toDate();
        }
      }

      // SAP sync date filters
      if (sap_last_sync_from || sap_last_sync_to) {
        filter.sap_last_sync = {};
        if (sap_last_sync_from) {
          filter.sap_last_sync.$gte = moment(sap_last_sync_from)
            .startOf('day')
            .toDate();
        }
        if (sap_last_sync_to) {
          filter.sap_last_sync.$lte = moment(sap_last_sync_to)
            .endOf('day')
            .toDate();
        }
      }

      const skip = (page - 1) * limit;

      const [documents, total] = await Promise.all([
        this.poModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
        this.poModel.countDocuments(filter).exec(),
      ]);

      return {
        status: 'success',
        message: `Found ${documents.length} purchasing documents (Page ${page}/${Math.ceil(total / limit)}, Total: ${total})`,
        data: documents,
      };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message,
        data: [],
      };
    }
  }

  /**
   * Find single PO document by MongoDB _id
   */
  async findOne(id: string): Promise<ResponseFormat<PurchasingDocument>> {
    try {
      const document = await this.poModel.findById(id).exec();

      if (!document) {
        return {
          status: 'error',
          message: `PO document with ID ${id} not found`,
          data: [],
        };
      }

      return {
        status: 'success',
        message: 'PO document retrieved successfully',
        data: [document],
      };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message,
        data: [],
      };
    }
  }

  /**
   * Get PO by number and item
   */
  async findByPOAndItem(
    purchasing_document: string,
    item: string,
  ): Promise<ResponseFormat<PurchasingDocument>> {
    try {
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
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message,
        data: [],
      };
    }
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

  // ==================== STATISTICS ====================

  /**
   * Get sync statistics (รองรับ query parameter)
   */
  async getSyncStats(query: SyncStatsQueryDto): Promise<ResponseFormat<any>> {
    try {
      const { plant, include_inactive = false } = query;

      const match: any = {};
      if (plant) match.plant = plant;
      if (!include_inactive) match.sap_active = true;

      const stats = await this.poModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              plant: '$plant',
              sap_active: '$sap_active',
            },
            count: { $sum: 1 },
            lastSync: { $max: '$sap_last_sync' },
          },
        },
        {
          $group: {
            _id: '$_id.plant',
            active: {
              $sum: {
                $cond: [{ $eq: ['$_id.sap_active', true] }, '$count', 0],
              },
            },
            inactive: {
              $sum: {
                $cond: [{ $eq: ['$_id.sap_active', false] }, '$count', 0],
              },
            },
            total: { $sum: '$count' },
            lastSync: { $max: '$lastSync' },
          },
        },
        {
          $project: {
            _id: 0,
            plant: '$_id',
            active: 1,
            inactive: 1,
            total: 1,
            lastSync: 1,
            activePercentage: {
              $multiply: [{ $divide: ['$active', '$total'] }, 100],
            },
          },
        },
        { $sort: { plant: 1 } },
      ]);

      return {
        status: 'success',
        message: 'Sync statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message,
        data: [],
      };
    }
  }

  /**
   * Get status statistics (รองรับ query parameter)
   */
  async getStatusStats(
    query: StatusStatsQueryDto,
  ): Promise<ResponseFormat<any>> {
    try {
      const { plant, date_from, date_to } = query;

      const match: any = {};
      if (plant) match.plant = plant;

      if (date_from || date_to) {
        match.doc_date = {};
        if (date_from) {
          match.doc_date.$gte = moment(date_from).startOf('day').toDate();
        }
        if (date_to) {
          match.doc_date.$lte = moment(date_to).endOf('day').toDate();
        }
      }

      const stats = await this.poModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalOrderQty: { $sum: '$order_qty' },
            totalReceivedQty: { $sum: '$received_qty' },
            totalRemainingQty: { $sum: '$remaining_qty' },
          },
        },
        {
          $project: {
            _id: 0,
            status: '$_id',
            count: 1,
            totalOrderQty: 1,
            totalReceivedQty: 1,
            totalRemainingQty: 1,
            receivedPercentage: {
              $cond: [
                { $eq: ['$totalOrderQty', 0] },
                0,
                {
                  $multiply: [
                    { $divide: ['$totalReceivedQty', '$totalOrderQty'] },
                    100,
                  ],
                },
              ],
            },
          },
        },
        { $sort: { status: 1 } },
      ]);

      return {
        status: 'success',
        message: 'Status statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message,
        data: [],
      };
    }
  }
}
