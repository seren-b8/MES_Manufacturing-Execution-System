import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SqlService } from 'src/shared/services/sql.service';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import { SAPSyncLog } from 'src/shared/modules/schema/sap_sync_log.schema';
import { GroupedProductionData } from 'src/shared/interface/sap';
import { SapSyncValidationService } from './sap-sync-validation.service';

@Injectable()
export class SapProductionSyncService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private readonly productionRecordModel: Model<ProductionRecord>,
    @InjectModel(SAPSyncLog.name)
    private readonly sapSyncLogModel: Model<SAPSyncLog>,
    private readonly sqlService: SqlService,
    private readonly validationService: SapSyncValidationService,
  ) {}

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 8).replace(/:/g, '');
  }

  private async createSyncLogEntry(
    productionRecordIds: Types.ObjectId[],
    employeeId: string,
    quantity: number,
    syncType: 'EMP' | 'SNC',
    groupedData: GroupedProductionData,
  ): Promise<SAPSyncLog> {
    const now = new Date();

    const validatedEmpId =
      this.validationService.validateAndTruncateEmployeeId(employeeId);

    const tid = this.validationService.createTID();

    this.validationService.validateSAPFields({
      employeeId: validatedEmpId,
      orderId: groupedData.order_id,
      sequenceNo: groupedData.sequence_no,
      activity: groupedData.activity,
    });

    return await this.sapSyncLogModel.create({
      // ข้อมูลอ้างอิง
      production_record_ids: productionRecordIds,
      employee_id: employeeId,
      quantity,
      sync_type: syncType,
      status: 'pending',

      // ข้อมูล SAP
      tid,
      itemno: 1,
      aufnr: groupedData.order_id.padStart(12, '0'),
      aplfl: groupedData.sequence_no.padStart(6, '0'),
      vornr: groupedData.activity.padStart(4, '0'),
      budat: this.formatDate(now),
      erdat: this.formatDate(now),
      erzet: this.formatTime(now),

      // ข้อมูลงานเสีย
      is_not_good: groupedData.is_not_good,
      agrnd: groupedData.is_not_good ? groupedData.case_ng : undefined,
    });
  }

  private createSAPSyncQuery(syncLog: SAPSyncLog): string {
    // ค่าคงที่สำหรับ SAP
    const SAP_CONSTANTS = {
      MANDT: '700',
      MEINH: 'ST',
      ISMNGEH: 'STD',
      ERNAM: 'ADMINIT',
      WERKS: '1620',
      TILE: 'Team',
    };

    const validatedFields = {
      TID: this.validationService.validateAndTruncateField(syncLog.tid, 'TID'),
      EMPLOYEE: this.validationService.validateAndTruncateField(
        syncLog.employee_id,
        'EMPLOYEE',
      ),
      AUFNR: this.validationService.validateAndTruncateField(
        syncLog.aufnr,
        'AUFNR',
      ),
      APLFL: this.validationService.validateAndTruncateField(
        syncLog.aplfl,
        'APLFL',
      ),
      VORNR: this.validationService.validateAndTruncateField(
        syncLog.vornr,
        'VORNR',
      ),
      AGRND:
        syncLog.is_not_good && syncLog.agrnd
          ? this.validationService.validateAndTruncateField(
              syncLog.agrnd,
              'AGRND',
            )
          : '',
    };
    // กำหนดจำนวนตามประเภทงาน
    const okQuantity = syncLog.is_not_good
      ? '0.000'
      : syncLog.quantity.toFixed(3);
    const ngQuantity = syncLog.is_not_good
      ? syncLog.quantity.toFixed(3)
      : '0.000';
    const timeJob = syncLog.quantity.toFixed(3);

    return `
      INSERT INTO OPENQUERY([SNC-HBQ],'SELECT MANDT,TID,ITEMNO,EMPLOYEE,AUFNR,APLFL,VORNR,UVORN,LMNGA,MEINH,XMNGA,RMNGA,RUECK,RMZHL,BUDAT,ISMNG,ISMNGEH,POSTED,MESSAGE,ERDAT,ERZET,ERNAM,WERKS,AGRND,TILE FROM ZIPHT_CONF_LOG') 
      VALUES (
        '${SAP_CONSTANTS.MANDT}',
        '${validatedFields.TID}',
        ${syncLog.itemno},
        '${validatedFields.EMPLOYEE}',
        '${validatedFields.AUFNR}',
        '${validatedFields.APLFL}',
        '${validatedFields.VORNR}',
        '',
        ${okQuantity},                    /* LMNGA: จำนวนงาน OK */
        '${SAP_CONSTANTS.MEINH}',
        ${ngQuantity},                    /* XMNGA: จำนวนงาน NG */
        0,
        0,
        '',
        '${syncLog.budat}',
        ${timeJob},                       /* ISMNG: time job */
        '${SAP_CONSTANTS.ISMNGEH}',
        '',
        '',
        '${syncLog.erdat}',
        '${syncLog.erzet}',
        '${SAP_CONSTANTS.ERNAM}',
        '${SAP_CONSTANTS.WERKS}',
        '${validatedFields.AGRND}',
        '${SAP_CONSTANTS.TILE}'
      )`;
  }

  private async validateBeforeSend(
    syncLog: SAPSyncLog,
    groupedData: GroupedProductionData,
  ): Promise<void> {
    try {
      this.validationService.validateSAPFields({
        employeeId: syncLog.employee_id,
        orderId: syncLog.aufnr,
        sequenceNo: syncLog.aplfl,
        activity: syncLog.vornr,
      });

      // เพิ่มการตรวจสอบอื่นๆ ตามความต้องการ
      if (syncLog.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      if (syncLog.is_not_good && !syncLog.agrnd) {
        throw new Error('Reason code is required for not good items');
      }
    } catch (error) {
      throw new Error(
        `Failed to validate before sending to SAP: ${(error as Error).message}`,
      );
    }
  }

  private async sendToSap(
    syncLog: SAPSyncLog,
    groupedData: GroupedProductionData,
  ): Promise<void> {
    try {
      await this.validateBeforeSend(syncLog, groupedData);
      const query = this.createSAPSyncQuery(syncLog);
      await this.sqlService.query(query);
      await this.updateSyncLogStatus(syncLog._id, 'completed');
    } catch (error) {
      await this.updateSyncLogStatus(
        syncLog._id,
        'failed',
        (error as Error).message,
      );
      throw error;
    }
  }

  private async updateSyncLogStatus(
    logId: Types.ObjectId,
    status: 'completed' | 'failed' | 'pending',
    errorMessage?: string,
  ): Promise<void> {
    const updateData: any = {
      status,
      sync_timestamp: status === 'completed' ? new Date() : undefined,
      error_message: errorMessage,
    };

    await this.sapSyncLogModel.findByIdAndUpdate(logId, updateData);
  }

  async syncPendingRecords() {
    try {
      // ค้นหา production records ที่รอการซิงค์
      const pendingRecords = await this.productionRecordModel
        .find({
          confirmation_status: 'confirmed',
          is_synced_to_sap: false,
        })
        .populate([
          {
            path: 'assign_order_id',
            populate: {
              path: 'production_order_id',
            },
          },
          'master_not_good_id',
          {
            path: 'assign_employee_ids',
            populate: {
              path: 'user_id',
            },
          },
        ])
        .lean();

      if (pendingRecords.length === 0) {
        return {
          status: 'success',
          message: 'No pending records found',
          data: [],
        };
      }

      // Process records (implementation depends on your business logic)
      const processedCount = await this.processRecords(pendingRecords);

      return {
        status: 'success',
        message: 'Successfully synced pending records',
        data: [
          {
            processed: processedCount,
            total: pendingRecords.length,
          },
        ],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to sync pending records: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSyncLogs(filter: any) {
    try {
      const logs = await this.sapSyncLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .lean();

      return {
        status: 'success',
        message: 'Successfully retrieved sync logs',
        data: logs,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to retrieve sync logs: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async retrySyncLog(logId: Types.ObjectId) {
    try {
      const syncLog = await this.sapSyncLogModel.findById(logId);
      if (!syncLog) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Sync log not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (syncLog.status !== 'failed') {
        throw new HttpException(
          {
            status: 'error',
            message: 'Can only retry failed sync logs',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get the original records and group data
      const records = await this.productionRecordModel
        .find({ _id: { $in: syncLog.production_record_ids } })
        .populate(['assign_order_id', 'master_not_good_id'])
        .lean();

      if (!records.length) {
        throw new Error('No production records found for this sync log');
      }

      // Resend to SAP
      await this.sendToSap(syncLog, {
        order_id: syncLog.aufnr,
        sequence_no: syncLog.aplfl,
        activity: syncLog.vornr,
        is_not_good: syncLog.is_not_good,
        case_ng: syncLog.agrnd,
        employee_quantities: new Map(),
        snc_quantity: 0,
      });

      return {
        status: 'success',
        message: 'Successfully retried sync log',
        data: [{ logId }],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to retry sync log: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async processRecords(records: any[]) {
    let processedCount = 0;

    try {
      // จัดกลุ่มข้อมูลตาม order_id, sequence และ activity
      const groupedRecords = new Map<string, any[]>();

      for (const record of records) {
        const order = record.assign_order_id.production_order_id;
        const key = `${order.order_id}-${order.sequence_number || '000000'}-${order.activity || '0010'}`;

        if (!groupedRecords.has(key)) {
          groupedRecords.set(key, []);
        }
        groupedRecords.get(key).push(record);
      }

      // ประมวลผลแต่ละกลุ่ม
      for (const [key, groupRecords] of groupedRecords) {
        const [orderId, sequenceNo, activity] = key.split('-');

        // จัดกลุ่มข้อมูลสำหรับส่ง SAP
        const recordIds = groupRecords.map((r) => r._id);
        const empQuantities = new Map<string, number>();
        let totalQuantity = 0;
        let isNotGood = false;
        let caseNg: string | undefined;

        // รวมจำนวนและข้อมูลงานเสีย
        for (const record of groupRecords) {
          totalQuantity += record.quantity;
          if (record.is_not_good) {
            isNotGood = true;
            caseNg = record.master_not_good_id?.case_english;
          }

          // รวมจำนวนต่อพนักงาน
          for (const assignEmp of record.assign_employee_ids) {
            const empId = assignEmp.user_id.employee_id;
            empQuantities.set(
              empId,
              (empQuantities.get(empId) || 0) +
                record.quantity / record.assign_employee_ids.length,
            );
          }
        }

        // เตรียมข้อมูลสำหรับส่ง SAP
        const groupedData: GroupedProductionData = {
          order_id: orderId,
          sequence_no: sequenceNo,
          activity: activity,
          is_not_good: isNotGood,
          case_ng: caseNg,
          employee_quantities: empQuantities,
          snc_quantity: totalQuantity % 1, // เศษทศนิยมจะถูกส่งเป็น SNC
        };

        // ส่งข้อมูลไป SAP
        await this.processProductionSync(recordIds, groupedData);

        // อัพเดทสถานะ records
        await this.productionRecordModel.updateMany(
          { _id: { $in: recordIds } },
          {
            is_synced_to_sap: true,
            sap_sync_timestamp: new Date(),
          },
        );

        processedCount += groupRecords.length;
      }

      return processedCount;
    } catch (error) {
      throw new Error(`Failed to process records: ${(error as Error).message}`);
    }
  }

  async processProductionSync(
    productionRecordIds: Types.ObjectId[],
    groupedData: GroupedProductionData,
  ): Promise<void> {
    // สร้าง sync logs สำหรับพนักงานแต่ละคน
    for (const [employeeId, quantity] of groupedData.employee_quantities) {
      const syncLog = await this.createSyncLogEntry(
        productionRecordIds,
        employeeId,
        quantity,
        'EMP',
        groupedData,
      );
      await this.sendToSap(syncLog, groupedData);
    }

    // สร้าง sync log สำหรับ SNC ถ้ามี
    if (groupedData.snc_quantity > 0) {
      const sncSyncLog = await this.createSyncLogEntry(
        productionRecordIds,
        'SNC',
        groupedData.snc_quantity,
        'SNC',
        groupedData,
      );
      await this.sendToSap(sncSyncLog, groupedData);
    }
  }
}
// INSERT INTO OPENQUERY([SNC-HBQ],'SELECT MANDT,TID,ITEMNO,EMPLOYEE,AUFNR,APLFL,VORNR,UVORN,LMNGA,MEINH,XMNGA,RMNGA,RUECK,RMZHL,BUDAT,ISMNG,ISMNGEH,POSTED,MESSAGE,ERDAT,ERZET,ERNAM,WERKS,AGRND,TILE FROM ZIPHT_CONF_LOG')
//       VALUES (
//         '700',
//       '${tid}', //->>>  รหัสรายการ หาก order_id เดียวกัน ให้ใช้รหัสเดียวกัน
//       1, //->>> หาก tid เดียวกัน ให้เพิ่มขึ้นทีละ 1
//       '${syncLog.employee_id}',  //->>> รหัสพนักงาน
//       '${groupedData.order_id.padStart(12, '0')}', //->>> รหัสใบสั่งงาน
//       '${groupedData.sequence_no.padStart(6, '0')}', //->>> ลำดับใบสั่งงาน
//       '${groupedData.activity.padStart(4, '0')}', //->>> กิจกรรม
//       '',
//       ${syncLog.quantity.toFixed(3)},  //->>> จำนวน งาน OK
//       'ST',
//       ${syncLog.quantity.toFixed(3)}, //->>> จำนวน งาน NG
//       0,
//       0,
//       '',
//       CONVERT(VARCHAR(50),GETDATE(),112), //->>> วันที่
//       ${syncLog.quantity.toFixed(3)}, //->>> time job
//       'STD',
//       '',
//       '',
//       CONVERT(VARCHAR(50),GETDATE(),112),
//       REPLACE(CONVERT(VARCHAR(8),GETDATE(),108),':',''),
//       'ADMINIT',
//       '1620',
//       '${groupedData.is_not_good ? groupedData.case_ng || '' : ''}',
//       'Team'
//       )`;
