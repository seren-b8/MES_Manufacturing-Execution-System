import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SqlService } from 'src/shared/services/sql.service';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { SAPSyncLog } from 'src/schema/sap_sync_log.schema';
import { GroupedProductionData } from 'src/shared/interface/sap';
import { SapSyncValidationService } from './sap-sync-validation.service';
import moment = require('moment-timezone');
import * as _ from 'lodash';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { toObjectId } from 'src/shared/utils/type.utils';

@Injectable()
export class SapProductionSyncService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private readonly productionRecordModel: Model<ProductionRecord>,
    @InjectModel(SAPSyncLog.name)
    private readonly sapSyncLogModel: Model<SAPSyncLog>,
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,
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

  //! ส่งข้อมูลไปยัง SAP โดยใช้ retry mechanism
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

        await this.updateSyncLogStatus((syncLog as any)._id, 'completed');
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
          (syncLog as any)._id,
          'failed',
          (error as Error).message,
        );
        throw error;
      }
    }
  }

  //! ส่งข้อมูลไปยัง SAP ในชุดๆ โดยใช้ Promise.all
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
              (syncLog as any)._id,
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

  //! ประมวลผลข้อมูลก่อนส่งไปยัง SAP
  private async createSyncLogsFromRecords(
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
        [orderDateKey: string]: { key: string; records: any[] }[];
      } = {};

      // จัดกลุ่มตาม orderId
      Object.entries(groupedRecords).forEach(([key, groupRecords]) => {
        const [orderId, , , dateStr] = key.split('-');
        const orderDateKey = `${orderId}-${dateStr}`;
        if (!orderGroups[orderDateKey]) {
          orderGroups[orderDateKey] = [];
        }
        orderGroups[orderDateKey].push({ key, records: groupRecords });
      });

      const orderPromises = Object.entries(orderGroups).map(
        async ([orderDateKey, groups]) => {
          const [baseOrderId, baseDateStr] = orderDateKey.split('-');

          // ใช้ TID ที่มีอยู่แล้วหรือสร้างใหม่
          let sharedTid = orderTidMap.get(orderDateKey);
          if (!sharedTid) {
            sharedTid = await this.validationService.createTID(
              baseOrderId,
              baseDateStr,
            );

            orderTidMap.set(orderDateKey, sharedTid);
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
          // await this.sendToSapInBatches(allSyncLogEntries);
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

  async createSyncLogsFromPendingRecords() {
    try {
      const orderTidMap = new Map<string, string>();

      // ใช้ aggregation เพื่อกรอง sql_active เท่านั้น
      const filteredRecordIds = await this.productionRecordModel.aggregate([
        {
          $match: {
            confirmation_status: 'confirmed',
            is_synced_to_sap: false,
            assign_order_id: { $ne: null },
          },
        },
        {
          $lookup: {
            from: 'assign_order',
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order_data',
          },
        },
        {
          $unwind: {
            path: '$assign_order_data',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $lookup: {
            from: 'production_order',
            let: {
              production_order_id: '$assign_order_data.production_order_id',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$production_order_id'] },
                      { $eq: ['$sql_active', true] },
                    ],
                  },
                },
              },
            ],
            as: 'production_order_data',
          },
        },
        {
          $unwind: {
            path: '$production_order_data',
            preserveNullAndEmptyArrays: false,
          },
        },
        // Project เฉพาะ _id
        {
          $project: {
            _id: 1,
          },
        },
      ]);

      if (filteredRecordIds.length === 0) {
        return {
          status: 'success',
          message: 'No pending records found',
          data: [],
        };
      }

      // ใช้ populate แบบเดิม (ปลอดภัย 100%)
      const pendingRecords = await this.productionRecordModel
        .find({
          _id: { $in: filteredRecordIds.map((r) => r._id) },
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
        .lean();

      // ประมวลผลข้อมูลทั้งหมด
      const processedCount = await this.createSyncLogsFromRecords(
        pendingRecords,
        orderTidMap,
      );

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

  async sendPendingSyncLogsByTid(tids: string[]) {
    try {
      // ค้นหา SyncLog ที่มีสถานะ pending และ ID ตรงตามที่ระบุ
      const pendingSyncLogs = await this.sapSyncLogModel
        .find({ tid: { $in: tids }, status: 'pending' })
        .lean();

      if (pendingSyncLogs.length === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'No pending sync logs found with the specified IDs',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // // วันที่ปัจจุบันในรูปแบบที่ต้องการ
      // const currentDate = moment().tz('Asia/Bangkok');
      // const currentMonth = currentDate.month();
      // const currentYear = currentDate.year();

      // วันที่ 1 ของเดือนปัจจุบัน ในรูปแบบ YYYYMMDD
      // const firstDayOfCurrentMonth = moment()
      //   .tz('Asia/Bangkok')
      //   .startOf('month')
      //   .format('YYYYMMDD');

      // // 1. ตรวจสอบและปรับ budat ให้ตรงกับเดือนปัจจุบันก่อน
      // const updatedSyncLogs = [];

      // for (const syncLog of pendingSyncLogs) {
      //   // สร้าง copy ของ syncLog เพื่อไม่แก้ไขข้อมูลต้นฉบับ
      //   const updatedLog = { ...syncLog };

      //   // ตรวจสอบเดือนของ budat
      //   const budatMonth = moment(syncLog.budat, 'YYYYMMDD').month();
      //   const budatYear = moment(syncLog.budat, 'YYYYMMDD').year();

      //   // ถ้าเดือนไม่ตรงกับเดือนปัจจุบัน ให้ปรับเป็นวันที่ 1 ของเดือนปัจจุบัน
      //   if (budatMonth !== currentMonth || budatYear !== currentYear) {
      //     updatedLog.budat = firstDayOfCurrentMonth;

      //     // อัพเดท budat ใน database
      //     await this.sapSyncLogModel.findByIdAndUpdate(syncLog._id, {
      //       budat: firstDayOfCurrentMonth,
      //     });
      //   }

      //   updatedSyncLogs.push(updatedLog);
      // }

      // 2. แปลง aufnr เป็น order_id โดยตัด 0 ด้านหน้าออก
      const orderIds = pendingSyncLogs.map((log) => {
        return log.aufnr.replace(/^0+/, '');
      });

      // 3. ดึงข้อมูล production orders
      const productionOrders = await this.productionOrderModel
        .find({ order_id: { $in: orderIds }, sql_active: true })
        .lean();

      // สร้าง map เพื่อค้นหาข้อมูล order ได้เร็วขึ้น
      const orderMap = new Map();
      for (const order of productionOrders) {
        orderMap.set(order.order_id, order);
      }

      // 4. ตรวจสอบความถูกต้องของเดือนเทียบกับ order
      const validLogs = [];
      const invalidLogs = [];

      for (const syncLog of pendingSyncLogs) {
        const orderId = syncLog.aufnr.replace(/^0+/, '');
        const order = orderMap.get(orderId);

        if (!order) {
          invalidLogs.push({
            syncLogId: syncLog._id,
            aufnr: syncLog.aufnr,
            orderId: orderId,
            reason: `Order ${orderId} not found or not active in SQL`,
          });
          continue;
        }

        if (!order.basic_start_date) {
          invalidLogs.push({
            syncLogId: syncLog._id,
            aufnr: syncLog.aufnr,
            orderId: orderId,
            reason: `Order ${orderId} has no basic_start_date`,
          });
          continue;
        }

        // ตรวจสอบเดือน
        const orderStartMonth = moment(order.basic_start_date).month();
        const orderStartYear = moment(order.basic_start_date).year();
        const syncMonth = moment(syncLog.budat, 'YYYYMMDD').month();
        const syncYear = moment(syncLog.budat, 'YYYYMMDD').year();

        // ตรวจสอบทั้งเดือนและปี
        if (orderStartMonth !== syncMonth || orderStartYear !== syncYear) {
          invalidLogs.push({
            syncLogId: syncLog._id,
            aufnr: syncLog.aufnr,
            orderId: orderId,
            orderStartDate: order.basic_start_date,
            syncDate: syncLog.budat,
            reason: `Month/Year mismatch: order start date (${moment(order.basic_start_date).format('YYYY-MM')}) vs sync date (${moment(syncLog.budat, 'YYYYMMDD').format('YYYY-MM')})`,
          });
        } else {
          validLogs.push(syncLog);
        }
      }

      // ถ้ามี logs ที่ไม่ถูกต้อง
      if (invalidLogs.length > 0) {
        throw new HttpException(
          {
            status: 'error',
            message:
              'Cannot send sync logs with month/year mismatch between order start date and sync date',
            data: invalidLogs,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // ส่งเฉพาะ logs ที่ผ่านการตรวจสอบแล้ว
      if (validLogs.length > 0) {
        await this.sendToSapInBatches(validLogs);
        console.warn(
          `Sent ${validLogs.length} valid sync logs to SAP with TID: ${validLogs[0].tid}`,
        );
      }

      return {
        status: 'success',
        message: 'Successfully sent pending sync logs to SAP',
        data: [{ sent: validLogs.length }],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to send pending sync logs by ID: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * อัปเดต order ID ใน sync logs ทุกตัวที่มีสถานะ pending ให้เป็น order ที่มี basic start date ตรงกับเดือนปัจจุบัน
   * @returns ข้อมูลการอัปเดต
   */
  async updateOrdersToCurrentMonth() {
    try {
      // ค้นหา sync logs ทั้งหมดที่มีสถานะ pending
      const allPendingSyncLogs = await this.sapSyncLogModel
        .find({ status: 'pending' })
        .lean();

      if (allPendingSyncLogs.length === 0) {
        return {
          status: 'success',
          message: 'No pending sync logs found',
          data: [],
        };
      }

      // จัดกลุ่ม logs ตาม order ID (aufnr)
      const orderIdGroups = {};
      allPendingSyncLogs.forEach((log) => {
        const orderId = log.aufnr.replace(/^0+/, '');
        if (!orderIdGroups[orderId]) {
          orderIdGroups[orderId] = [];
        }
        orderIdGroups[orderId].push(log);
      });

      // เลือก 1 รายการต่อ order ID เพื่อตรวจสอบ
      const pendingSyncLogs = Object.values(orderIdGroups).map(
        (logs: any) => logs[0],
      );

      // 1. ดึงข้อมูล orders ทั้งหมด (ทั้ง active และ inactive)
      const orderIds = pendingSyncLogs.map((log) =>
        log.aufnr.replace(/^0+/, ''),
      );

      const allOrders = await this.productionOrderModel
        .find({ order_id: { $in: orderIds } })
        .lean();

      // แยก orders ออกเป็น active และ inactive
      const activeOrderMap = new Map();
      const inactiveOrderMap = new Map();
      const materialGroups = {}; // จัดกลุ่มตาม material

      for (const order of allOrders) {
        if (order.sql_active) {
          activeOrderMap.set(order.order_id, order);
        } else {
          inactiveOrderMap.set(order.order_id, order);
        }

        // จัดกลุ่มตาม material_number
        if (order.material_number) {
          if (!materialGroups[order.material_number]) {
            materialGroups[order.material_number] = [];
          }
          materialGroups[order.material_number].push(order);
        }
      }

      // 2. หา orders ที่เป็นเดือนปัจจุบันและ active เท่านั้น
      const currentDate = moment().tz('Asia/Bangkok');
      const currentMonth = currentDate.month();
      const currentYear = currentDate.year();

      // 3. สำหรับแต่ละ material หา order เดือนปัจจุบันที่ active
      const materialToCurrentMonthOrder = new Map();

      for (const [material, orders] of Object.entries(materialGroups)) {
        // หา active orders เฉพาะเดือนปัจจุบันเท่านั้น
        const currentMonthActiveOrders = (orders as any[]).filter((order) => {
          if (!order.sql_active || !order.basic_start_date) return false;
          const orderMonth = moment(order.basic_start_date).month();
          const orderYear = moment(order.basic_start_date).year();
          return orderMonth === currentMonth && orderYear === currentYear;
        });

        if (currentMonthActiveOrders.length > 0) {
          materialToCurrentMonthOrder.set(
            material,
            currentMonthActiveOrders[0],
          );
        }
      }

      // 4. ค้นหา orders เดือนปัจจุบันเพิ่มเติมจาก database
      const materialsNeedingOrders = [];
      for (const material of Object.keys(materialGroups)) {
        if (!materialToCurrentMonthOrder.has(material)) {
          materialsNeedingOrders.push(material);
        }
      }

      if (materialsNeedingOrders.length > 0) {
        const currentMonthStartDate = moment()
          .tz('Asia/Bangkok')
          .startOf('month')
          .toDate();
        const currentMonthEndDate = moment()
          .tz('Asia/Bangkok')
          .endOf('month')
          .toDate();

        const currentMonthOrders = await this.productionOrderModel
          .find({
            material_number: { $in: materialsNeedingOrders },
            basic_start_date: {
              $gte: currentMonthStartDate,
              $lte: currentMonthEndDate,
            },
            sql_active: true,
          })
          .lean();

        for (const order of currentMonthOrders) {
          materialToCurrentMonthOrder.set(order.material_number, order);
        }
      }

      // 5. อัปเดต syncLogs
      const updateResults = {
        total: pendingSyncLogs.length,
        updated: 0,
        skipped: 0,
        updatedToActive: 0, // order เดิม inactive แล้วเปลี่ยนเป็น active
        updatedToCurrentMonth: 0, // order เดิม active แต่เป็นเดือนเก่า
        waitingForNewOrder: 0, // ไม่มี order เดือนปัจจุบัน
        details: [],
      };

      for (const syncLog of pendingSyncLogs) {
        const originalOrderId = syncLog.aufnr.replace(/^0+/, '');

        // ตรวจสอบ order เดิม
        const isOriginalActive = activeOrderMap.has(originalOrderId);
        const originalOrder = isOriginalActive
          ? activeOrderMap.get(originalOrderId)
          : inactiveOrderMap.get(originalOrderId);

        if (!originalOrder) {
          updateResults.skipped++;
          updateResults.details.push({
            syncLogId: syncLog._id,
            status: 'skipped',
            reason: `Order ${originalOrderId} not found`,
          });
          continue;
        }

        const material = originalOrder.material_number;
        const currentMonthOrder = materialToCurrentMonthOrder.get(material);

        // ถ้าไม่มี order เดือนปัจจุบัน ให้ skip
        if (!currentMonthOrder) {
          updateResults.waitingForNewOrder++;
          updateResults.details.push({
            syncLogId: syncLog._id,
            status: 'waiting',
            reason: `No current month order found for material ${material}. Waiting for new order.`,
            originalOrderId: originalOrderId,
            material: material,
            wasActive: isOriginalActive,
          });
          continue;
        }

        // ตรวจสอบว่าต้องอัปเดตหรือไม่
        let needsUpdate = false;
        let updateReason = '';

        if (!isOriginalActive) {
          // Order เดิม inactive
          needsUpdate = true;
          updateReason =
            'Original order is inactive, switching to current month active order';
          updateResults.updatedToActive++;
        } else if (originalOrder.basic_start_date) {
          // Order เดิม active แต่ตรวจสอบเดือน
          const orderMonth = moment(originalOrder.basic_start_date).month();
          const orderYear = moment(originalOrder.basic_start_date).year();

          if (orderMonth !== currentMonth || orderYear !== currentYear) {
            if (currentMonthOrder.order_id !== originalOrder.order_id) {
              needsUpdate = true;
              updateReason =
                'Order month is not current month, switching to current month order';
              updateResults.updatedToCurrentMonth++;
            }
          }
        }

        if (!needsUpdate) {
          updateResults.skipped++;
          updateResults.details.push({
            syncLogId: syncLog._id,
            status: 'skipped',
            reason: `Order ${originalOrderId} is already valid (current month and active)`,
          });
          continue;
        }

        // อัปเดตทุก logs ที่มี order ID เดียวกัน
        const allLogsWithSameOrderId = orderIdGroups[originalOrderId];
        const newOrderId = currentMonthOrder.order_id.padStart(12, '0');

        // อัปเดทวันที่ตาม order ใหม่
        const newBudat = moment(currentMonthOrder.basic_start_date)
          .tz('Asia/Bangkok')
          .format('YYYYMMDD');

        for (const logToUpdate of allLogsWithSameOrderId) {
          await this.sapSyncLogModel.findByIdAndUpdate(logToUpdate._id, {
            aufnr: newOrderId,
            budat: newBudat,
          });

          updateResults.updated++;
          updateResults.details.push({
            syncLogId: logToUpdate._id,
            status: 'updated',
            originalOrderId: originalOrderId,
            newOrderId: currentMonthOrder.order_id,
            material: material,
            reason: updateReason,
            wasActive: isOriginalActive,
            newOrderDate: currentMonthOrder.basic_start_date,
          });
        }
      }

      return {
        status: 'success',
        message: `Updated ${updateResults.updated} of ${updateResults.total} sync logs. ${updateResults.waitingForNewOrder} logs waiting for new orders.`,
        data: [
          {
            summary: {
              total: updateResults.total,
              updated: updateResults.updated,
              skipped: updateResults.skipped,
              updatedToActive: updateResults.updatedToActive,
              updatedToCurrentMonth: updateResults.updatedToCurrentMonth,
              waitingForNewOrder: updateResults.waitingForNewOrder,
            },
            details: updateResults.details,
          },
        ],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to update orders: ${(error as Error).message}`,
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
}
