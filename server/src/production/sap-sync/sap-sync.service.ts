import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SqlService } from 'src/shared/services/sql.service';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import { SAPSyncLog } from 'src/shared/modules/schema/sap_sync_log.schema';
import { GroupedProductionData } from 'src/shared/interface/sap';
import { SapSyncValidationService } from './sap-sync-validation.service';
import * as moment from 'moment-timezone';
import * as _ from 'lodash';

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

  private formatDate(date: moment.Moment): string {
    // ใช้ moment เพื่อให้แน่ใจว่าใช้เวลา Bangkok
    return moment(date).tz('Asia/Bangkok').format('YYYYMMDD');
  }

  private formatTime(date: moment.Moment): string {
    // ใช้ moment เพื่อให้แน่ใจว่าใช้เวลา Bangkok
    return moment(date).tz('Asia/Bangkok').format('HHmmss');
  }

  private createSAPSyncQuery(syncLog: SAPSyncLog): string {
    // ค่าคงที่สำหรับ SAP
    const SAP_CONSTANTS = {
      MANDT: '900', //!TODO 700 = QAS, 900 = PRD
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
    // คำนวณเวลาที่ใช้ในการทำงานจริง (หน่วยเป็นชั่วโมง)
    // ตัวอย่าง: สมมติว่ามีข้อมูล cycle_time_per_unit ในหน่วยวินาที
    const cycleTimePerUnitInSeconds = syncLog.cycle_time_per_unit || 60; // ค่าเริ่มต้น 60 วินาที
    const totalTimeInHours =
      (syncLog.quantity * cycleTimePerUnitInSeconds) / 3600;
    const timeJob = totalTimeInHours.toFixed(3);

    //! [SNC-HANA] คือชื่อ Linked Server ที่เชื่อมต่อกับ SAP HANA ใช้กับ PRD
    //! [SNC-HBQ] คือชื่อ Linked Server ที่เชื่อมต่อกับ SAP HANA ใช้กับ QAS
    return `
      INSERT INTO OPENQUERY([SNC-HANA],'SELECT MANDT,TID,ITEMNO,EMPLOYEE,AUFNR,APLFL,VORNR,UVORN,LMNGA,MEINH,XMNGA,RMNGA,RUECK,RMZHL,BUDAT,ISMNG,ISMNGEH,POSTED,MESSAGE,ERDAT,ERZET,ERNAM,WERKS,AGRND,TILE FROM ZIPHT_CONF_LOG') 
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

      if (syncLog.is_not_good && !syncLog.agrnd && syncLog.agrnd !== '') {
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
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await this.validateBeforeSend(syncLog, groupedData);
        const query = this.createSAPSyncQuery(syncLog);

        // เพิ่ม timeout เพื่อป้องกันการ hang
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('SAP query timeout')), 30000); // 30s timeout
        });

        // ใช้ Promise.race เพื่อจัดการ timeout
        await Promise.race([this.sqlService.query(query), timeoutPromise]);

        await this.updateSyncLogStatus(syncLog._id, 'completed');
        return; // ส่งสำเร็จ ออกจาก loop
      } catch (error) {
        retryCount++;

        // ถ้ายังไม่ถึงจำนวน retry สูงสุด ให้ลองใหม่
        if (retryCount < maxRetries) {
          // ใช้ exponential backoff (รอเวลานานขึ้นในแต่ละครั้งที่ retry)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, retryCount)),
          );
          continue;
        }

        // ถ้า retry ครบแล้วยังไม่สำเร็จ ให้บันทึกข้อผิดพลาด
        await this.updateSyncLogStatus(
          syncLog._id,
          'failed',
          (error as Error).message,
        );
        throw error;
      }
    }
  }

  private async sendToSapInBatches(
    syncLogEntries: SAPSyncLog[],
    concurrentLimit = 3, // ลดจาก 5 เป็น 3
  ): Promise<void> {
    // แบ่งเป็นกลุ่มๆ
    const chunks: SAPSyncLog[][] = [];
    for (let i = 0; i < syncLogEntries.length; i += concurrentLimit) {
      chunks.push(syncLogEntries.slice(i, i + concurrentLimit));
    }

    // ส่งข้อมูลทีละชุดพร้อมกับ delay ที่มากขึ้น
    for (const chunk of chunks) {
      try {
        await Promise.all(
          chunk.map((syncLog) =>
            this.sendToSap(syncLog, {
              order_id: syncLog.aufnr.trim(),
              sequence_no: syncLog.aplfl.trim(),
              activity: syncLog.vornr.trim(),
              is_not_good: syncLog.is_not_good,
              case_ng: syncLog.agrnd,
              employee_quantities: new Map(),
              snc_quantity: 0,
              cycle_time_per_unit: syncLog.cycle_time_per_unit,
              production_date: moment(syncLog.budat, 'YYYYMMDD')
                .tz('Asia/Bangkok')
                .toDate(),
            }),
          ),
        );
      } catch (error) {
        // จัดการ error ที่เกิดขึ้นทั้งชุด
        console.error(`Batch error: ${(error as Error).message}`);

        // ส่งทีละรายการเมื่อเกิด error กับทั้งชุด
        for (const syncLog of chunk) {
          try {
            await this.sendToSap(syncLog, {
              order_id: syncLog.aufnr.trim(),
              sequence_no: syncLog.aplfl.trim(),
              activity: syncLog.vornr.trim(),
              is_not_good: syncLog.is_not_good,
              case_ng: syncLog.agrnd,
              employee_quantities: new Map(),
              snc_quantity: 0,
              cycle_time_per_unit: syncLog.cycle_time_per_unit,
              production_date: moment(syncLog.budat, 'YYYYMMDD')
                .tz('Asia/Bangkok')
                .toDate(),
            });
            // เพิ่ม delay ระหว่างแต่ละรายการเมื่อส่งแบบเดี่ยว
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (itemError) {
            console.error(
              `Failed to send item: ${(itemError as Error).message}`,
            );
            // อัพเดทสถานะ log เป็น failed
            await this.updateSyncLogStatus(
              syncLog._id,
              'failed',
              (itemError as Error).message,
            );
          }
        }
      }

      // เพิ่ม delay ระหว่างชุดให้มากขึ้น
      await new Promise((resolve) => setTimeout(resolve, 800)); // เพิ่มจาก 200ms เป็น 800ms
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

  private async processRecords(
    records: any[],
    orderTidMap: Map<string, string>,
  ) {
    let processedCount = 0;

    try {
      // จัดกลุ่มข้อมูลตาม order_id, sequence และ activity
      const groupedRecords: { [key: string]: any[] } = {};

      for (const record of records) {
        const order = record.assign_order_id.production_order_id;
        const dateStr = moment(record.production_date)
          .tz('Asia/Bangkok')
          .format('YYYYMMDD');

        const caseCode =
          record.is_not_good && record.master_not_good_id
            ? record.master_not_good_id.case_code || 'UNKNOWN'
            : '';

        // ใช้งาน object เป็น key กำหนด pattern ให้ชัดเจน
        const key = `${order.order_id}-${order.sequence_number || '000000'}-${
          order.activity || '0010'
        }-${dateStr}-${record.is_not_good ? 'NG' : 'OK'}-${record.is_not_good ? caseCode : ''}`;

        if (!groupedRecords[key]) {
          groupedRecords[key] = [];
        }
        groupedRecords[key].push(record);
      }

      // เก็บข้อมูลทั้งหมดของแต่ละ order ก่อนประมวลผล
      const orderGroups: {
        [orderId: string]: { key: string; records: any[] }[];
      } = {};

      // จัดกลุ่มตาม orderId
      Object.entries(groupedRecords).forEach(([key, groupRecords]) => {
        const [orderId] = key.split('-');
        if (!orderGroups[orderId]) {
          orderGroups[orderId] = [];
        }
        orderGroups[orderId].push({ key, records: groupRecords });
      });

      const orderPromises = Object.entries(orderGroups).map(
        async ([orderId, groups]) => {
          // ใช้ TID ที่มีอยู่แล้วหรือสร้างใหม่
          let sharedTid = orderTidMap.get(orderId);
          if (!sharedTid) {
            sharedTid = await this.validationService.createTID();
            orderTidMap.set(orderId, sharedTid);
          }
          // เตรียมข้อมูลสำหรับทุกกลุ่มใน order นี้
          let globalItemCounter = 1; // itemno เริ่มที่ 1 สำหรับแต่ละ order
          const allSyncLogEntries: SAPSyncLog[] = [];

          // ประมวลผลแต่ละกลุ่มในแต่ละ order
          for (const { key, records } of groups) {
            const keySplit = key.split('-');
            const orderId = keySplit[0];
            const sequenceNo = keySplit[1];
            const activity = keySplit[2];
            const dateStr = keySplit[3];
            const recordType = keySplit[4];
            const caseCode = keySplit[5];

            const isNotGood = recordType === 'NG';

            // ใช้ reduce แทน loop + map เพื่อเพิ่มประสิทธิภาพ
            let totalQuantity = 0;
            let employeeIds: string[] = [];
            let cycleTimePerUnit = 60;

            for (const record of records) {
              totalQuantity += record.quantity;
              // เก็บรวบรวม employee IDs จากทุก record
              for (const assignEmp of record.assign_employee_ids) {
                const empId = assignEmp.user_id.employee_id;
                if (!employeeIds.includes(empId)) {
                  employeeIds.push(empId);
                }
              }

              if (record.assign_order_id.machine_info?.cycle_time) {
                cycleTimePerUnit =
                  record.assign_order_id.machine_info.cycle_time;
              }
            }

            // คำนวณจำนวนต่อพนักงานที่ควรได้ (ทุกคนเท่ากัน)
            const employeeCount = employeeIds.length;
            const equalSharePerEmployee = Math.floor(
              totalQuantity / employeeCount,
            );

            // คำนวณเศษที่เหลือ (ไม่สามารถแบ่งเท่ากันได้)
            const remainder =
              totalQuantity - equalSharePerEmployee * employeeCount;

            // สร้าง map จำนวนต่อพนักงาน
            const empQuantitiesObj: { [empId: string]: number } = {};

            // แบ่งให้แต่ละพนักงานเท่าๆ กัน
            for (const empId of employeeIds) {
              empQuantitiesObj[empId] = equalSharePerEmployee;
            }

            // เศษทั้งหมดไปเข้า SNC
            const sncQuantity = remainder;

            // แปลง obj เป็น Map
            const empQuantities = new Map(Object.entries(empQuantitiesObj));

            // เตรียมข้อมูลสำหรับส่ง SAP
            const groupedData: GroupedProductionData = {
              order_id: orderId,
              sequence_no: sequenceNo,
              activity: activity,
              is_not_good: isNotGood,
              case_ng: isNotGood ? caseCode : undefined,
              employee_quantities: empQuantities,
              snc_quantity: sncQuantity,
              cycle_time_per_unit: cycleTimePerUnit,
              production_date: moment
                .tz(dateStr, 'YYYYMMDD', 'Asia/Bangkok')
                .toDate(),
            };

            // สร้าง sync log entries สำหรับกลุ่มนี้ และเพิ่มเข้าไปในรายการรวม
            const recordIds = records.map((r) => r._id);

            for (const [
              employeeId,
              quantity,
            ] of groupedData.employee_quantities) {
              const syncLog = await this.createSyncLogEntryWithSharedTid(
                recordIds,
                employeeId,
                quantity,
                'EMP',
                groupedData,
                sharedTid,
                globalItemCounter++, // ใช้ globalItemCounter
              );
              allSyncLogEntries.push(syncLog);
            }

            if (groupedData.snc_quantity > 0) {
              const sncSyncLog = await this.createSyncLogEntryWithSharedTid(
                recordIds,
                'SNC',
                groupedData.snc_quantity,
                'SNC',
                groupedData,
                sharedTid,
                globalItemCounter++, // ใช้ globalItemCounter
              );
              allSyncLogEntries.push(sncSyncLog);
            }

            // อัพเดทสถานะ records
            await this.productionRecordModel.updateMany(
              { _id: { $in: recordIds } },
              {
                is_synced_to_sap: true,
                sap_sync_timestamp: moment.tz('Asia/Bangkok').toDate(),
              },
            );
          }

          // ในฟังก์ชัน processRecords
          // ส่งข้อมูลทั้งหมดไป SAP
          await this.sendToSapInBatches(allSyncLogEntries);
          return groups.reduce(
            (total, { records }) => total + records.length,
            0,
          );
        },
      );

      // รอให้ทุก order ทำงานเสร็จและรวมจำนวนที่ประมวลผล
      const results = await Promise.all(orderPromises);
      processedCount = results.reduce((sum, count) => sum + count, 0);

      return processedCount;
    } catch (error) {
      throw new Error(`Failed to process records: ${(error as Error).message}`);
    }
  }

  private async createSyncLogEntryWithSharedTid(
    productionRecordIds: Types.ObjectId[],
    employeeId: string,
    quantity: number,
    syncType: 'EMP' | 'SNC',
    groupedData: GroupedProductionData,
    sharedTid: string,
    itemno: number,
  ): Promise<SAPSyncLog> {
    const productionDate = moment(groupedData.production_date).tz(
      'Asia/Bangkok',
    );
    const now = moment.tz('Asia/Bangkok');

    const validatedEmpId =
      this.validationService.validateAndTruncateEmployeeId(employeeId);

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
      tid: sharedTid,
      itemno: itemno, // ใช้ค่า itemno ที่ส่งมา
      aufnr: groupedData.order_id.padStart(12, '0'),
      aplfl: groupedData.sequence_no.padStart(6, '0'),
      vornr: groupedData.activity.padStart(4, '0'),
      budat: this.formatDate(productionDate), // Posting date
      erdat: this.formatDate(now),
      erzet: this.formatTime(now),

      // ข้อมูลงานเสีย
      is_not_good: groupedData.is_not_good,
      agrnd: groupedData.is_not_good ? groupedData.case_ng : undefined,

      cycle_time_per_unit: groupedData.cycle_time_per_unit || 60,

      //วันที่ผลิต
      production_date: groupedData.production_date,
    });
  }

  async syncPendingRecords() {
    try {
      // นับจำนวนข้อมูลทั้งหมดที่ต้องประมวลผล
      const totalCount = await this.productionRecordModel.countDocuments({
        confirmation_status: 'confirmed',
        is_synced_to_sap: false,
      });

      if (totalCount === 0) {
        return {
          status: 'success',
          message: 'No pending records found',
          data: [],
        };
      }

      // กำหนดขนาด batch
      const batchSize = 100;
      let processedCount = 0;
      let currentPage = 0;

      // สร้าง Map เพื่อเก็บ TID สำหรับแต่ละ order
      const orderTidMap = new Map<string, string>();

      // ประมวลผลทีละ batch
      while (processedCount < totalCount) {
        const pendingRecords = await this.productionRecordModel
          .find({
            confirmation_status: 'confirmed',
            is_synced_to_sap: false,
          })
          .select(
            'quantity is_not_good assign_employee_ids assign_order_id master_not_good_id createdAt production_date',
          )
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
          .skip(currentPage * batchSize)
          .limit(batchSize)
          .lean();

        if (pendingRecords.length === 0) break;

        // ประมวลผล batch นี้ โดยส่ง orderTidMap เข้าไปด้วย
        const batchProcessed = await this.processRecords(
          pendingRecords,
          orderTidMap,
        );
        processedCount += batchProcessed;
        currentPage++;
      }

      return {
        status: 'success',
        message: 'Successfully synced pending records',
        data: [
          {
            processed: processedCount,
            total: totalCount,
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
        cycle_time_per_unit: syncLog.cycle_time_per_unit,
        production_date: moment(syncLog.budat, 'YYYYMMDD')
          .tz('Asia/Bangkok')
          .toDate(),
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

  async processProductionSync(
    productionRecordIds: Types.ObjectId[],
    groupedData: GroupedProductionData,
  ): Promise<void> {
    // สร้าง TID เดียวสำหรับทุกรายการในกลุ่มเดียวกัน
    const sharedTid = await this.validationService.createTID();

    // สร้างข้อมูลสำหรับส่ง SAP ทั้งหมดก่อน
    const syncLogEntries: SAPSyncLog[] = [];
    let itemCounter = 1; // เริ่มนับ item จาก 1

    for (const [employeeId, quantity] of groupedData.employee_quantities) {
      const syncLog = await this.createSyncLogEntryWithSharedTid(
        productionRecordIds,
        employeeId,
        quantity,
        'EMP',
        groupedData,
        sharedTid,
        itemCounter++,
      );
      syncLogEntries.push(syncLog);
    }

    // สร้าง entry สำหรับ SNC ถ้ามี
    if (groupedData.snc_quantity > 0) {
      const sncSyncLog = await this.createSyncLogEntryWithSharedTid(
        productionRecordIds,
        'SNC',
        groupedData.snc_quantity,
        'SNC',
        groupedData,
        sharedTid,
        itemCounter++,
      );
      syncLogEntries.push(sncSyncLog);
    }

    await this.sendToSapInBatches(syncLogEntries);
  }
}
