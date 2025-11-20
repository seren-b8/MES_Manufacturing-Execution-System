import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import moment = require('moment-timezone');
import { Model, Types } from 'mongoose';
import { SAPDOLog, SAPDOItem } from 'src/schema/sap-do-logs.schema';
import { MaterialReceipt } from 'src/schema/material-receipts.schema';
import { MaterialReceiptItem } from 'src/schema/material-receipt-items';
import { TransactionService } from '../material-transaction/transaction.service';
import { ReceiveFromSAPPODto } from './dto/sap-po.dto';
import { ResponseFormat } from 'src/shared/interface';
import { toObjectId } from 'src/shared/utils/type.utils';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios'; // อย่าลืม import AxiosError

@Injectable()
export class SAPPOReceiptService {
  private readonly SAP_API_BASE_URL = process.env.SAP_API_BASE_URL;

  constructor(
    @InjectModel(SAPDOLog.name) private doLogModel: Model<SAPDOLog>,
    @InjectModel(MaterialReceipt.name)
    private receiptModel: Model<MaterialReceipt>,
    @InjectModel(MaterialReceiptItem.name)
    private receiptItemModel: Model<MaterialReceiptItem>,
    private readonly transactionService: TransactionService,
    private readonly httpService: HttpService, // เพิ่ม
  ) {}

  async receiveFromSAPPO(
    dto: ReceiveFromSAPPODto,
    employeeId: string,
  ): Promise<ResponseFormat<SAPDOLog>> {
    // 1. Generate DO Number (MES สร้างเอง)
    const doNum = await this.generateDONumber();

    // 2. Create DO Log
    const doLog = await this.doLogModel.create({
      do_num: doNum, // MES DO Number
      invoice_no: dto.header.invoice_no,
      outbound: dto.header.outbound,
      del_date: moment.tz(dto.header.del_date, 'Asia/Bangkok').toDate(),
      created_by: toObjectId(dto.header.create_by),
      employee_id: employeeId,
      items: dto.items.map(
        (item): SAPDOItem => ({
          po_doc: item.po_doc,
          material: item.material,
          del_qty: item.del_qty,
          process_status: 'pending',
        }),
      ),
      overall_status: 'processing',
    });

    // 3. Process each item
    const results = await this.processItems(doLog);

    // 4. Update final status
    await this.updateDOLogStatus(doLog._id.toString(), results);

    if (process.env.ENABLE_SAP_SYNC === 'true') {
      await this.sendStatusToSAP(doLog, results);
    }

    // 5. Return
    const finalDoLog = await this.doLogModel
      .findById(doLog._id)
      .populate('created_by', 'employee_id')
      .exec();

    return {
      status: 'success',
      message: `Processed ${results.success} of ${results.total} items successfully`,
      data: [finalDoLog],
    };
  }

  private async sendStatusToSAP(
    doLog: SAPDOLog,
    results: { success: number; failed: number; total: number },
  ): Promise<void> {
    try {
      const sapEndpoint = `${this.SAP_API_BASE_URL}/v1/do`;

      // Prepare payload
      const payload = {
        header: {
          do_num: doLog.do_num, // MES DO Number
          invoice_no: doLog.invoice_no,
          outbound: doLog.outbound,
          del_date: moment(doLog.del_date)
            .tz('Asia/Bangkok')
            .format('YYYY-MM-DD'),
          create_by: doLog.employee_id,
        },
        items: doLog.items.map((item) => ({
          po_doc: item.po_doc,
          material: item.material,
          del_qty: item.del_qty,
        })),
        processed_at: moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
      };

      console.log('📤 Sending status to SAP:', doLog.do_num);

      const response = await this.httpService.axiosRef.post(
        sapEndpoint,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            // Authorization: `Bearer ${process.env.SAP_API_TOKEN}`,
          },
          timeout: 30000,
        },
      );

      // Update sync status in MES
      await this.doLogModel.findByIdAndUpdate(doLog._id, {
        sap_sync_status: 'Y',
        sap_sync_timestamp: moment().tz('Asia/Bangkok').toDate(),
      });

      console.log('✅ SAP Status Updated:', response.data);
    } catch (error) {
      const axiosError = error as AxiosError;

      console.error('❌ Failed to send status to SAP:', axiosError.message);

      // กรณี SAP ตอบกลับมา (เช่น 422 Unprocessable Entity)
      if (axiosError.response) {
        // Cast เป็น any เพื่อให้ดึงค่า message และ errors ได้โดยไม่ติด Type check
        const sapData = axiosError.response.data as any;

        // Update DB ว่า Failed พร้อมเก็บ Log เต็มๆ
        await this.doLogModel.findByIdAndUpdate(doLog._id, {
          sap_sync_status: 'N',
          processing_notes: `${doLog.processing_notes || ''} | SAP Error: ${JSON.stringify(sapData)}`,
        });

        // throw new HttpException(
        //   {
        //     status: 'error',
        //     message: sapData.message || 'SAP Validation Failed',
        //     data: sapData.errors ? [sapData.errors] : [],
        //   },
        //   axiosError.response.status,
        // );
      }

      // กรณี Error อื่นๆ (Network, Time out)
      await this.doLogModel.findByIdAndUpdate(doLog._id, {
        sap_sync_status: 'N',
        processing_notes: `${doLog.processing_notes || ''} | System Error: ${(error as Error).message}`,
      });

      throw new BadRequestException((error as Error).message);
    }
  }

  /**
   * Retry sending status to SAP (กรณีที่ส่งไม่สำเร็จ)
   */
  async retrySAPSync(doNum: string): Promise<ResponseFormat<SAPDOLog>> {
    const doLog = await this.doLogModel.findOne({ do_num: doNum }).exec();

    if (!doLog) {
      throw new NotFoundException(`DO ${doNum} not found`);
    }

    if (doLog.sap_sync_status === 'Y') {
      return {
        status: 'success',
        message: `DO ${doNum} already synced to SAP`,
        data: [doLog],
      };
    }

    // Calculate results from items
    const results = {
      success: doLog.items.filter((i) => i.process_status === 'completed')
        .length,
      failed: doLog.items.filter((i) => i.process_status === 'failed').length,
      total: doLog.items.length,
    };

    // Retry sync
    await this.sendStatusToSAP(doLog, results);

    // Return updated DO
    const updatedDoLog = await this.doLogModel
      .findOne({ do_num: doNum })
      .populate('created_by', 'employee_id')
      .exec();

    return {
      status: 'success',
      message: 'SAP sync retry completed',
      data: [updatedDoLog],
    };
  }

  private async processItems(doLog: SAPDOLog) {
    let success = 0;
    let failed = 0;

    for (let i = 0; i < doLog.items.length; i++) {
      const item = doLog.items[i];

      try {
        // Call receiveMaterial
        const receiveResult = await this.transactionService.receiveMaterial({
          material_number: item.material,
          quantity: item.del_qty,
          to_location_code: '1P10',
          user_id: doLog.created_by.toString(),
          reference_doc: `PO-${item.po_doc}`,
          lot_number: item.po_doc,
        });

        // Create MaterialReceipt & ReceiptItem
        const receiptItem = await this.createReceiptItem(
          doLog,
          item,
          receiveResult,
        );

        // Update item status
        const updatedItem: SAPDOItem = {
          po_doc: item.po_doc,
          material: item.material,
          del_qty: item.del_qty,
          material_receipt_item_id: receiptItem._id as Types.ObjectId,
          material_transaction_id: receiveResult.data[0]._id as Types.ObjectId,
          process_status: 'completed',
        };

        doLog.items[i] = updatedItem;
        success++;
      } catch (error) {
        const failedItem: SAPDOItem = {
          po_doc: item.po_doc,
          material: item.material,
          del_qty: item.del_qty,
          process_status: 'failed',
          error_message: (error as Error).message,
        };

        doLog.items[i] = failedItem;
        failed++;
      }
    }

    doLog.markModified('items');
    await doLog.save();

    return { success, failed, total: doLog.items.length };
  }

  private async createReceiptItem(
    doLog: SAPDOLog,
    item: SAPDOItem,
    receiveResult: any,
  ) {
    let receipt = await this.receiptModel.findOne({
      material_number: item.material,
      received_date: doLog.del_date,
      sync_status: 'pending',
    });

    if (!receipt) {
      receipt = await this.receiptModel.create({
        plant: 'PLANT-01',
        material_number: item.material,
        short_text: item.material,
        movement_type: '101',
        received_date: doLog.del_date,
        total_received_quantity: item.del_qty,
        remaining_quantity: 0,
        receipt_status: 'completed',
        unit: 'PC',
        sync_status: 'processed',
      });
    }

    const receiptItem = await this.receiptItemModel.create({
      material_receipt_id: receipt._id,
      location_id: receiveResult.data[0].to_location_id,
      position_id: receiveResult.data[0].to_position_id,
      quantity: item.del_qty,
      lot_number: item.po_doc,
      material_transaction_id: receiveResult.data[0]._id,
      received_by: doLog.created_by,
      received_at: doLog.del_date,
      remark: `SAP PO ${item.po_doc}`,
    });

    return receiptItem;
  }

  private async updateDOLogStatus(
    doLogId: string,
    results: { success: number; failed: number; total: number },
  ): Promise<void> {
    let overall_status: string;

    if (results.failed === 0) {
      overall_status = 'completed';
    } else if (results.success === 0) {
      overall_status = 'failed';
    } else {
      overall_status = 'partial_failed';
    }

    await this.doLogModel.findByIdAndUpdate(doLogId, {
      overall_status,
      processing_notes: `Completed: ${results.success}, Failed: ${results.failed}, Total: ${results.total}`,
    });
  }

  private async generateDONumber(): Promise<string> {
    const today = moment().tz('Asia/Bangkok');
    const prefix = `MESDO${today.format('YYYYMM')}`; // DO202511

    const lastDO = await this.doLogModel
      .findOne({ do_num: new RegExp(`^${prefix}`) })
      .sort({ do_num: -1 })
      .exec();

    let sequence = 1;
    if (lastDO) {
      sequence = parseInt(lastDO.do_num.slice(-4)) + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
    // Examples: DO2025110001, DO2025110002, ...
  }

  async findByDONumber(doNum: string): Promise<SAPDOLog> {
    const doLog = await this.doLogModel
      .findOne({ do_num: doNum })
      .populate('created_by', 'employee_id')
      .populate('items.material_receipt_item_id')
      .populate('items.material_transaction_id')
      .exec();

    if (!doLog) {
      throw new NotFoundException(`DO Number ${doNum} not found`);
    }

    return doLog;
  }

  async findAll(query?: {
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ResponseFormat<SAPDOLog>> {
    const filter: any = {};

    if (query?.status) {
      filter.overall_status = query.status;
    }

    if (query?.start_date || query?.end_date) {
      filter.del_date = {};

      if (query.start_date) {
        filter.del_date.$gte = moment
          .tz(query.start_date, 'Asia/Bangkok')
          .startOf('day')
          .toDate();
      }

      if (query.end_date) {
        filter.del_date.$lt = moment
          .tz(query.end_date, 'Asia/Bangkok')
          .add(1, 'days')
          .startOf('day')
          .toDate();
      }
    }

    const doLogs = await this.doLogModel
      .find(filter)
      .populate('created_by', 'employee_id')
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    return {
      status: 'success',
      message: `Found ${doLogs.length} SAP DO records`,
      data: doLogs,
    };
  }
}
