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
            assign_order_id: { $ne: null }, // เพิ่มเงื่อนไขนี้
          })
          .select(
            'quantity is_not_good assign_employee_ids assign_order_id master_not_good_id createdAt production_date',
          )
          .populate([
            {
              path: 'assign_order_id',
              match: { _id: { $ne: null } },
              populate: {
                path: 'production_order_id',
                match: { _id: { $ne: null } },
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

        if (pendingRecords.length === 0) {
          console.warn(
            `No records found at page ${currentPage}, breaking loop`,
          );
          break;
        }
        const validRecords = pendingRecords.filter((record) => {
          const assignOrder = record.assign_order_id as any;
          return assignOrder?.production_order_id;
        });

        if (validRecords.length === 0) {
          return {
            status: 'success',
            message: 'No valid records found for sync',
            data: [],
          };
        }

        // ประมวลผล batch นี้ โดยส่ง orderTidMap เข้าไปด้วย
        const batchProcessed = await this.createSyncLogsFromRecords(
          validRecords,
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

      // วันที่ปัจจุบันในรูปแบบที่ต้องการ
      const currentDate = moment().tz('Asia/Bangkok');
      const currentMonth = currentDate.month();
      const currentYear = currentDate.year();

      // วันที่ 1 ของเดือนปัจจุบัน ในรูปแบบ YYYYMMDD
      const firstDayOfCurrentMonth = moment()
        .tz('Asia/Bangkok')
        .startOf('month')
        .format('YYYYMMDD');

      // 1. ตรวจสอบและปรับ budat ให้ตรงกับเดือนปัจจุบันก่อน
      const updatedSyncLogs = [];

      for (const syncLog of pendingSyncLogs) {
        // สร้าง copy ของ syncLog เพื่อไม่แก้ไขข้อมูลต้นฉบับ
        const updatedLog = { ...syncLog };

        // ตรวจสอบเดือนของ budat
        const budatMonth = moment(syncLog.budat, 'YYYYMMDD').month();
        const budatYear = moment(syncLog.budat, 'YYYYMMDD').year();

        // ถ้าเดือนไม่ตรงกับเดือนปัจจุบัน ให้ปรับเป็นวันที่ 1 ของเดือนปัจจุบัน
        if (budatMonth !== currentMonth || budatYear !== currentYear) {
          updatedLog.budat = firstDayOfCurrentMonth;

          // อัพเดท budat ใน database
          await this.sapSyncLogModel.findByIdAndUpdate(syncLog._id, {
            budat: firstDayOfCurrentMonth,
          });
        }

        updatedSyncLogs.push(updatedLog);
      }

      // 2. แปลง aufnr เป็น order_id โดยตัด 0 ด้านหน้าออก
      const orderIds = updatedSyncLogs.map((log) => {
        return log.aufnr.replace(/^0+/, '');
      });

      // 3. ดึงข้อมูล production orders
      const productionOrders = await this.productionOrderModel
        .find({ order_id: { $in: orderIds } })
        .lean();

      // สร้าง map เพื่อค้นหาข้อมูล order ได้เร็วขึ้น
      const orderMap = new Map();
      for (const order of productionOrders) {
        orderMap.set(order.order_id, order);
      }

      // 4. ตรวจสอบความถูกต้องของเดือนเทียบกับ order
      const validLogs = [];
      const invalidLogs = [];

      for (const syncLog of updatedSyncLogs) {
        const orderId = syncLog.aufnr.replace(/^0+/, '');
        const order = orderMap.get(orderId);

        if (!order || !order.basic_start_date) {
          invalidLogs.push({
            syncLogId: syncLog._id,
            aufnr: syncLog.aufnr,
            orderId: orderId,
            reason: !order
              ? `Order ${orderId} not found in production orders`
              : `Order ${orderId} has no basic_start_date`,
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

      // จัดกลุ่ม logs ตาม order ID (aufnr) และเลือกเพียง 1 รายการต่อกลุ่ม
      const orderIdGroups = {};

      // จัดกลุ่มตาม order ID
      allPendingSyncLogs.forEach((log) => {
        const orderId = log.aufnr.replace(/^0+/, ''); // ตัด leading zeros
        if (!orderIdGroups[orderId]) {
          orderIdGroups[orderId] = [];
        }
        orderIdGroups[orderId].push(log);
      });

      // เลือก 1 รายการต่อ order ID
      const pendingSyncLogs = Object.values(orderIdGroups).map(
        (logs) => logs[0],
      );

      if (pendingSyncLogs.length === 0) {
        return {
          status: 'success',
          message: 'No pending sync logs found',
          data: [],
        };
      }

      // จัดกลุ่ม logs ตาม material number
      // ใช้สำหรับหา order ที่มี material เดียวกัน แต่เดือนต่างกัน
      const groupedByMaterialAndOrder = {};

      // 1. จัดกลุ่ม logs และดึงข้อมูล orders
      // สร้าง array ของ order IDs ที่ต้องการดึงข้อมูล
      const orderIds = pendingSyncLogs.map((log) =>
        log.aufnr.replace(/^0+/, ''),
      );

      // ดึงข้อมูล production orders
      const productionOrders = await this.productionOrderModel
        .find({ order_id: { $in: orderIds } })
        .lean();

      // สร้าง map จาก order_id ไปยัง order object
      const orderMap = new Map();
      for (const order of productionOrders) {
        orderMap.set(order.order_id, order);

        // จัดกลุ่มตาม material_number
        if (order.material_number) {
          if (!groupedByMaterialAndOrder[order.material_number]) {
            groupedByMaterialAndOrder[order.material_number] = {};
          }
          groupedByMaterialAndOrder[order.material_number][order.order_id] =
            order;
        }
      }

      // 2. หา orders ที่มีเดือนตรงกับเดือนปัจจุบัน
      const currentDate = moment().tz('Asia/Bangkok');
      const currentMonth = currentDate.month();
      const currentYear = currentDate.year();

      // สร้าง map ของ material_number ไปยัง current month order
      const materialToCurrentMonthOrder = new Map();

      for (const [material, orders] of Object.entries(
        groupedByMaterialAndOrder,
      )) {
        for (const [orderId, order] of Object.entries(orders)) {
          if (order.basic_start_date) {
            const orderStartMonth = moment(order.basic_start_date).month();
            const orderStartYear = moment(order.basic_start_date).year();

            if (
              orderStartMonth === currentMonth &&
              orderStartYear === currentYear
            ) {
              materialToCurrentMonthOrder.set(material, order);
              break; // เมื่อพบ order ที่มีเดือนตรงกับเดือนปัจจุบันแล้ว ไม่ต้องค้นหาต่อ
            }
          }
        }
      }

      // 3. ค้นหา orders ที่มีเดือนล่าสุดสำหรับแต่ละ material ที่ไม่มี current month order
      const materialToLatestOrder = new Map();

      for (const [material, orders] of Object.entries(
        groupedByMaterialAndOrder,
      )) {
        if (materialToCurrentMonthOrder.has(material)) {
          continue; // ถ้ามี current month order แล้ว ข้ามไป
        }

        let latestOrder = null;
        let latestDate = null;

        for (const [orderId, order] of Object.entries(orders)) {
          if (order.basic_start_date) {
            const orderDate = moment(order.basic_start_date);

            if (!latestDate || orderDate.isAfter(latestDate)) {
              latestDate = orderDate;
              latestOrder = order;
            }
          }
        }

        if (latestOrder) {
          materialToLatestOrder.set(material, latestOrder);
        }
      }

      // 4. ค้นหา orders เพิ่มเติมที่มีเดือนเป็นเดือนปัจจุบัน
      // สำหรับ material ที่ยังไม่มี current month order
      const materialsNeedingCurrentMonthOrder = Array.from(
        materialToLatestOrder.keys(),
      );

      if (materialsNeedingCurrentMonthOrder.length > 0) {
        const currentMonthStartDate = moment()
          .tz('Asia/Bangkok')
          .startOf('month')
          .toDate();
        const currentMonthEndDate = moment()
          .tz('Asia/Bangkok')
          .endOf('month')
          .toDate();

        const additionalOrders = await this.productionOrderModel
          .find({
            material_number: { $in: materialsNeedingCurrentMonthOrder },
            basic_start_date: {
              $gte: currentMonthStartDate,
              $lte: currentMonthEndDate,
            },
          })
          .lean();

        // เพิ่ม orders ที่พบเข้าไปใน map
        for (const order of additionalOrders) {
          materialToCurrentMonthOrder.set(order.material_number, order);
        }
      }

      // 5. อัปเดต syncLogs
      const updateResults = {
        total: pendingSyncLogs.length,
        updated: 0,
        skipped: 0,
        details: [],
      };

      for (const syncLog of pendingSyncLogs) {
        const originalOrderId = syncLog.aufnr.replace(/^0+/, '');
        const originalOrder = orderMap.get(originalOrderId);

        if (!originalOrder) {
          updateResults.skipped++;
          updateResults.details.push({
            syncLogId: syncLog._id,
            status: 'skipped',
            reason: `Order ${originalOrderId} not found`,
          });
          continue;
        }

        // ค้นหา logs ทั้งหมดที่มี order ID เดียวกัน เพื่ออัปเดตทั้งกลุ่ม
        const allLogsWithSameOrderId = await this.sapSyncLogModel.find({
          aufnr: syncLog.aufnr,
          status: 'pending',
        });

        // ตรวจสอบว่า order มีเดือนเป็นเดือนปัจจุบันหรือไม่
        if (originalOrder.basic_start_date) {
          const orderStartMonth = moment(
            originalOrder.basic_start_date,
          ).month();
          const orderStartYear = moment(originalOrder.basic_start_date).year();

          if (
            orderStartMonth === currentMonth &&
            orderStartYear === currentYear
          ) {
            // Order มีเดือนเป็นเดือนปัจจุบันอยู่แล้ว
            updateResults.skipped++;
            updateResults.details.push({
              syncLogId: syncLog._id,
              status: 'skipped',
              reason: `Order ${originalOrderId} already has current month date`,
            });
            continue;
          }
        }

        // ค้นหา current month order สำหรับ material เดียวกัน
        const material = originalOrder.material_number;
        const currentMonthOrder = materialToCurrentMonthOrder.get(material);

        if (!currentMonthOrder) {
          updateResults.skipped++;
          updateResults.details.push({
            syncLogId: syncLog._id,
            status: 'skipped',
            reason: `No current month order found for material ${material}`,
          });
          continue;
        }

        // อัปเดต syncLog ด้วย order ใหม่
        const newOrderId = currentMonthOrder.order_id.padStart(12, '0');

        // อัปเดตทุก logs ที่มี order ID เดียวกัน
        for (const logToUpdate of allLogsWithSameOrderId) {
          await this.sapSyncLogModel.findByIdAndUpdate(logToUpdate._id, {
            aufnr: newOrderId,
          });

          updateResults.updated++;
          updateResults.details.push({
            syncLogId: logToUpdate._id,
            status: 'updated',
            originalOrderId: originalOrderId,
            newOrderId: currentMonthOrder.order_id,
            material: material,
          });
        }
      }

      return {
        status: 'success',
        message: `Updated ${updateResults.updated} of ${updateResults.total} sync logs`,
        data: [updateResults],
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

  // async processProductionSync(
  //   productionRecordIds: Types.ObjectId[],
  //   groupedData: GroupedProductionData,
  // ): Promise<void> {
  //   // สร้าง TID เดียวสำหรับทุกรายการในกลุ่มเดียวกัน
  //   const sharedTid = await this.validationService.createTID();

  //   // สร้างข้อมูลสำหรับส่ง SAP ทั้งหมดก่อน
  //   const syncLogEntries: SAPSyncLog[] = [];
  //   let itemCounter = 1; // เริ่มนับ item จาก 1

  //   for (const [employeeId, quantity] of groupedData.employee_quantities) {
  //     const syncLog = await this.createSyncLogEntryWithSharedTid(
  //       productionRecordIds,
  //       employeeId,
  //       quantity,
  //       'EMP',
  //       groupedData,
  //       sharedTid,
  //       itemCounter++,
  //     );
  //     syncLogEntries.push(syncLog);
  //   }

  //   // สร้าง entry สำหรับ SNC ถ้ามี
  //   if (groupedData.snc_quantity > 0) {
  //     const sncSyncLog = await this.createSyncLogEntryWithSharedTid(
  //       productionRecordIds,
  //       'SNC',
  //       groupedData.snc_quantity,
  //       'SNC',
  //       groupedData,
  //       sharedTid,
  //       itemCounter++,
  //     );
  //     syncLogEntries.push(sncSyncLog);
  //   }

  //   await this.sendToSapInBatches(syncLogEntries);
  // }
}
