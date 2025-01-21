import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SqlService } from 'src/shared/services/sql.service';

import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import {
  IAssignEmployee,
  IAssignOrder,
  IMasterNotGood,
  IProductionRecord,
  ISapProductionData,
} from 'src/shared/interface';

@Injectable()
export class SapProductionSyncService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private readonly productionRecordModel: Model<ProductionRecord>,
    private readonly sqlService: SqlService,
  ) {}

  private async sendToSapEmp(data: ISapProductionData) {
    const query = `
      INSERT INTO OPENQUERY([SNC-HBQ],'SELECT MANDT,TID,ITEMNO,EMPLOYEE,AUFNR,APLFL,VORNR,UVORN,LMNGA,MEINH,XMNGA,RMNGA,RUECK,RMZHL,BUDAT,ISMNG,ISMNGEH,POSTED,MESSAGE,ERDAT,ERZET,ERNAM,WERKS,AGRND,TILE FROM ZIPHT_CONF_LOG') 
      VALUES (
        @mandt,
        CONVERT(text,REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(VARCHAR,SYSUTCDATETIME()),'-',''),':',''),'.',''),' ','')+CONVERT(VARCHAR(50),@empId)),
        @itemno,
        @empId,
        @aufnr,
        @aplfl,
        @vornr,
        @uvorn,
        @lmnga,
        @meinh,
        @xmnga,
        @rmnga,
        @rueck,
        @rmzhl,
        CONVERT(VARCHAR(50),GETDATE(),112),
        @ismng,
        @ismngeh,
        @posted,
        @message,
        CONVERT(VARCHAR(50),GETDATE(),112),
        REPLACE(CONVERT(VARCHAR(8),GETDATE(),108),':',''),
        @ernam,
        @werks,
        @agrnd,
        @tile
      )`;

    const params = [
      { name: 'mandt', value: 700 },
      { name: 'empId', value: data.employee_id },
      { name: 'itemno', value: 1 },
      { name: 'aufnr', value: `00${data.order_id}` },
      { name: 'aplfl', value: `00000${data.sequence_no}` },
      { name: 'vornr', value: `00${data.activity}` },
      { name: 'uvorn', value: '' },
      { name: 'lmnga', value: data.quantity },
      { name: 'meinh', value: 'ST' },
      { name: 'xmnga', value: data.is_not_good ? data.quantity : 0 },
      { name: 'rmnga', value: 0 },
      { name: 'rueck', value: '' },
      { name: 'rmzhl', value: '' },
      { name: 'ismng', value: data.quantity },
      { name: 'ismngeh', value: 'STD' },
      { name: 'posted', value: '' },
      { name: 'message', value: '' },
      { name: 'ernam', value: 'ADMINIT' },
      { name: 'werks', value: '1620' },
      { name: 'agrnd', value: data.case_ng || '' },
      { name: 'tile', value: 'Team' },
    ];

    return this.sqlService.query(
      query,
      params.map((p) => p.value),
    );
  }

  private async sendToSapSnc(data: ISapProductionData) {
    const query = `
      INSERT INTO OPENQUERY([SNC-HBQ],'SELECT MANDT,TID,ITEMNO,EMPLOYEE,AUFNR,APLFL,VORNR,UVORN,LMNGA,MEINH,XMNGA,RMNGA,RUECK,RMZHL,BUDAT,ISMNG,ISMNGEH,POSTED,MESSAGE,ERDAT,ERZET,ERNAM,WERKS,AGRND,TILE FROM ZIPHT_CONF_LOG') 
      VALUES (
        @mandt,
        CONVERT(text,REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(VARCHAR,SYSUTCDATETIME()),'-',''),':',''),'.',''),' ','')+'SNC'),
        @itemno,
        'SNC',
        @aufnr,
        @aplfl,
        @vornr,
        @uvorn,
        @lmnga,
        @meinh,
        @xmnga,
        @rmnga,
        @rueck,
        @rmzhl,
        CONVERT(VARCHAR(50),GETDATE(),112),
        @ismng,
        @ismngeh,
        @posted,
        @message,
        CONVERT(VARCHAR(50),GETDATE(),112),
        REPLACE(CONVERT(VARCHAR(8),GETDATE(),108),':',''),
        @ernam,
        @werks,
        @agrnd,
        @tile
      )`;

    const params = [
      { name: 'mandt', value: 700 },
      { name: 'itemno', value: 1 },
      { name: 'aufnr', value: `00${data.order_id}` },
      { name: 'aplfl', value: `00000${data.sequence_no}` },
      { name: 'vornr', value: `00${data.activity}` },
      { name: 'uvorn', value: '' },
      { name: 'lmnga', value: data.quantity },
      { name: 'meinh', value: 'ST' },
      { name: 'xmnga', value: data.is_not_good ? data.quantity : 0 },
      { name: 'rmnga', value: 0 },
      { name: 'rueck', value: '' },
      { name: 'rmzhl', value: '' },
      { name: 'ismng', value: data.quantity },
      { name: 'ismngeh', value: 'STD' },
      { name: 'posted', value: '' },
      { name: 'message', value: '' },
      { name: 'ernam', value: 'ADMINIT' },
      { name: 'werks', value: '1620' },
      { name: 'agrnd', value: data.case_ng || '' },
      { name: 'tile', value: 'Team' },
    ];

    return this.sqlService.query(
      query,
      params.map((p) => p.value),
    );
  }

  async syncProductionToSap(productionRecordId: Types.ObjectId) {
    try {
      // 1. ดึงข้อมูล Production Record พร้อม populate
      const record = await this.productionRecordModel
        .findById(productionRecordId)
        .populate<{
          assign_employee_ids: IAssignEmployee[];
        }>('assign_employee_ids')
        .populate<{ assign_order_id: IAssignOrder }>('assign_order_id')
        .populate<{ master_not_good_id: IMasterNotGood }>('master_not_good_id');

      if (!record) {
        return {
          status: 'error',
          message: 'Production record not found',
          data: [],
        };
      }

      // Cast record to IProductionRecord type
      const typedRecord = record as unknown as IProductionRecord;

      if (typedRecord.confirmation_status !== 'confirmed') {
        return {
          status: 'error',
          message: 'Production record must be confirmed before syncing',
          data: [],
        };
      }

      // 2. คำนวณจำนวนสำหรับแต่ละพนักงาน
      const employeeCount = typedRecord.assign_employee_ids.length;
      const baseQuantity = Math.floor(typedRecord.quantity / employeeCount);
      const remainder = typedRecord.quantity % employeeCount;

      // 3. ส่งข้อมูลสำหรับแต่ละพนักงาน
      for (const employee of typedRecord.assign_employee_ids) {
        try {
          await this.sendToSapEmp({
            employee_id: employee.user_id,
            order_id: typedRecord.assign_order_id.order_id,
            sequence_no: typedRecord.assign_order_id.sequence_no,
            activity: typedRecord.assign_order_id.activity,
            quantity: baseQuantity,
            is_not_good: typedRecord.is_not_good,
            case_ng: typedRecord.is_not_good
              ? typedRecord.master_not_good_id?.case_english
              : '',
          });
        } catch (error) {
          console.error(`Failed to sync employee ${employee.user_id}:`, error);
          throw error;
        }
      }

      // 4. ส่งข้อมูลเศษที่เหลือไปยัง SNC (ถ้ามี)
      if (remainder > 0) {
        try {
          await this.sendToSapSnc({
            order_id: typedRecord.assign_order_id.order_id,
            sequence_no: typedRecord.assign_order_id.sequence_no,
            activity: typedRecord.assign_order_id.activity,
            quantity: remainder,
            is_not_good: typedRecord.is_not_good,
            case_ng: typedRecord.is_not_good
              ? typedRecord.master_not_good_id?.case_english
              : '',
          });
        } catch (error) {
          console.error('Failed to sync SNC remainder:', error);
          throw error;
        }
      }

      // 5. อัพเดทสถานะการ sync
      await this.productionRecordModel.findByIdAndUpdate(productionRecordId, {
        is_synced_to_sap: true,
        sap_sync_timestamp: new Date(),
      });

      return {
        status: 'success',
        message: 'Synced production record successfully',
        data: [
          {
            recordId: productionRecordId,
            employeeCount,
            baseQuantity,
            remainder,
          },
        ],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to sync production record: ' + error.message,
        data: [],
      };
    }
  }

  async syncPendingRecords() {
    try {
      const pendingRecords = await this.productionRecordModel
        .find<IProductionRecord>({
          confirmation_status: 'confirmed',
          is_synced_to_sap: false,
        })
        .sort({ confirmed_at: 1 });

      const results = [];
      for (const record of pendingRecords) {
        const result = await this.syncProductionToSap(record._id);
        results.push(result);
      }

      return {
        status: 'success',
        message: 'Synced all pending records',
        data: [{ results }],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to sync pending records: ' + error.message,
        data: [],
      };
    }
  }
}
