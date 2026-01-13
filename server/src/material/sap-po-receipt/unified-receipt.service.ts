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
import { SAPPOReceiptService } from './receipt.service';
import { BatchReceiptService } from './batch-receipt.service';
import { UnifiedReceiveDto } from './dto/unified-receive.dto';
import { BatchReceiveDto } from './dto/batch-receive.dto';

// unified-receipt.service.ts
@Injectable()
export class UnifiedReceiptService {
  constructor(
    private readonly sapPoReceiptService: SAPPOReceiptService,
    private readonly batchReceiptService: BatchReceiptService,
  ) {}

  async receiveWithMode(
    dto: UnifiedReceiveDto,
    employeeId: string,
  ): Promise<ResponseFormat<SAPDOLog>> {
    if (dto.mode === 'sap_sync') {
      // Validate SAP required fields
      this.validateSAPMode(dto);

      // Convert to SAP DTO
      const sapDto: ReceiveFromSAPPODto = {
        header: {
          invoice_no: dto.header.invoice_no!,
          outbound: dto.header.outbound!,
          del_date: dto.header.del_date!,
          create_by: dto.header.create_by,
        },
        items: dto.items.map((item) => ({
          po_doc: item.po_doc!,
          material: item.material,
          del_qty: item.del_qty,
          to_location_code: item.to_location_code || '1P10',
          to_position_code: item.to_position_code,
        })),
      };

      return this.sapPoReceiptService.receiveFromSAPPO(sapDto, employeeId);
    } else {
      // Convert to Batch DTO
      const batchDto: BatchReceiveDto = {
        create_by: dto.header.create_by,
        items: dto.items.map((item) => ({
          material: item.material,
          del_qty: item.del_qty,
          to_location_code: item.to_location_code,
          to_position_code: item.to_position_code,
          lot_number: item.lot_number,
        })),
      };

      return this.batchReceiptService.batchReceiveMaterials(
        batchDto,
        employeeId,
      );
    }
  }

  private validateSAPMode(dto: UnifiedReceiveDto): void {
    if (
      !dto.header.invoice_no ||
      !dto.header.outbound ||
      !dto.header.del_date
    ) {
      throw new BadRequestException(
        'invoice_no, outbound, and del_date are required for SAP sync mode',
      );
    }

    const missingPoDocs = dto.items.filter((item) => !item.po_doc);
    if (missingPoDocs.length > 0) {
      throw new BadRequestException(
        'po_doc is required for all items in SAP sync mode',
      );
    }
  }
}
