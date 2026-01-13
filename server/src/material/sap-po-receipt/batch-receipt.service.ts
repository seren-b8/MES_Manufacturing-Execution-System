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
import { TransactionService } from '../material-transaction/transaction.service';
import { ReceiveFromSAPPODto } from './dto/sap-po.dto';
import { ResponseFormat } from 'src/shared/interface';
import { toObjectId } from 'src/shared/utils/type.utils';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios'; // อย่าลืม import AxiosError
import { BatchReceiveDto } from './dto/batch-receive.dto';

// batch-receipt.service.ts
@Injectable()
export class BatchReceiptService {
  constructor(
    @InjectModel(SAPDOLog.name) private doLogModel: Model<SAPDOLog>,
    private readonly transactionService: TransactionService,
  ) {}

  async batchReceiveMaterials(
    dto: BatchReceiveDto,
    employeeId: string,
  ): Promise<ResponseFormat<SAPDOLog>> {
    // 1. Generate DO Number
    const doNum = await this.generateDONumber('BATCH');

    // 2. Create DO Log (simple version)
    const doLog = await this.doLogModel.create({
      do_num: doNum,
      invoice_no: `BATCH-${doNum}`,
      outbound: 'INTERNAL',
      del_date: moment().tz('Asia/Bangkok').toDate(),
      created_by: toObjectId(dto.create_by),
      employee_id: employeeId,
      items: dto.items.map(
        (item): SAPDOItem => ({
          po_doc: `BATCH-${doNum}`,
          material: item.material,
          del_qty: item.del_qty,
          to_location_code: item.to_location_code,
          to_position_code: item.to_position_code,
          lot_number: item.lot_number,
          process_status: 'pending',
        }),
      ),
      overall_status: 'processing',
    });

    // 3. Process items
    const results = await this.processItems(doLog);

    // 4. Update status
    await this.updateDOLogStatus(doLog._id.toString(), results);

    // 5. Return
    const finalDoLog = await this.doLogModel
      .findById(doLog._id)
      .populate('created_by', 'employee_id')
      .exec();

    return {
      status: 'success',
      message: `Received ${results.success} of ${results.total} items successfully`,
      data: [finalDoLog],
    };
  }

  private async processItems(doLog: SAPDOLog) {
    let success = 0;
    let failed = 0;

    for (let i = 0; i < doLog.items.length; i++) {
      const item = doLog.items[i];

      try {
        const receiveResult = await this.transactionService.receiveMaterial({
          material_number: item.material.toString(),
          quantity: item.del_qty,
          to_location_code: item.to_location_code.toString(),
          to_position_code: item.to_position_code?.toString(),
          lot_number: (item.lot_number || item.po_doc).toString(),
          user_id: doLog.created_by.toString(),
          reference_doc: item.po_doc.toString(),
        });

        const updatedItem: SAPDOItem = {
          ...item,
          material_transaction_id: receiveResult.data[0]._id as Types.ObjectId,
          process_status: 'completed',
        };

        doLog.items[i] = updatedItem;
        success++;
      } catch (error) {
        const failedItem: SAPDOItem = {
          ...item,
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
      processing_notes: `Batch Receive - Completed: ${results.success}, Failed: ${results.failed}`,
    });
  }

  private async generateDONumber(prefix: string = 'BATCH'): Promise<string> {
    const today = moment().tz('Asia/Bangkok');
    const fullPrefix = `${prefix}${today.format('YYYYMM')}`;

    const lastDO = await this.doLogModel
      .findOne({ do_num: new RegExp(`^${fullPrefix}`) })
      .sort({ do_num: -1 })
      .exec();

    let sequence = 1;
    if (lastDO) {
      sequence = parseInt(lastDO.do_num.slice(-4)) + 1;
    }

    return `${fullPrefix}${sequence.toString().padStart(4, '0')}`;
  }
}
