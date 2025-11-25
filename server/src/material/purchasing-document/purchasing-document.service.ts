import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import moment = require('moment-timezone');
import { PurchasingDocument } from 'src/schema/purchasing-document.schema';
import { ResponseFormat } from 'src/shared/interface';
import { QueryPurchasingDocumentDto } from './dto/purchasing-document.dto';

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
