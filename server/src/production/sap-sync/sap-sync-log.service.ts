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

@Injectable()
export class SapSyncLogService {
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

  /**
   * ดึงข้อมูลและสรุปตาม TID แยกเป็นงานดีและงานเสีย
   * @param tid รหัส Transaction ID
   * @returns สรุปข้อมูลตาม TID
   */
  async getTidSummary(tid: string) {
    try {
      // ค้นหา logs ทั้งหมดที่มี TID ตรงตามที่ระบุ
      const syncLogs = await this.sapSyncLogModel
        .find({ tid })
        .sort({ itemno: 1 })
        .lean();

      if (syncLogs.length === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: `No logs found with TID: ${tid}`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ดึง order ID จาก log แรก
      const firstLog = syncLogs[0];
      const orderId = firstLog.aufnr.replace(/^0+/, '');

      // ดึงข้อมูล order จาก production order
      const order = await this.productionOrderModel
        .findOne({ order_id: orderId })
        .lean();

      // คำนวณจำนวนรวมงานดี/งานเสีย
      let totalGoodQuantity = 0;
      let totalNotGoodQuantity = 0;
      let employeeRecords = [];
      let sncRecords = [];

      syncLogs.forEach((log) => {
        if (log.is_not_good) {
          totalNotGoodQuantity += log.quantity;
        } else {
          totalGoodQuantity += log.quantity;
        }

        // แยกระหว่าง Employee และ SNC
        if (log.employee_id === 'SNC') {
          sncRecords.push(log);
        } else {
          employeeRecords.push(log);
        }
      });

      // รวมข้อมูลงานดี/งานเสียตามพนักงาน
      const employeeSummary = {};
      employeeRecords.forEach((log) => {
        if (!employeeSummary[log.employee_id]) {
          employeeSummary[log.employee_id] = {
            good: 0,
            notGood: 0,
            total: 0,
          };
        }

        if (log.is_not_good) {
          employeeSummary[log.employee_id].notGood += log.quantity;
        } else {
          employeeSummary[log.employee_id].good += log.quantity;
        }

        employeeSummary[log.employee_id].total += log.quantity;
      });

      // รวมข้อมูล SNC
      const sncSummary = {
        good: 0,
        notGood: 0,
        total: 0,
      };

      sncRecords.forEach((log) => {
        if (log.is_not_good) {
          sncSummary.notGood += log.quantity;
        } else {
          sncSummary.good += log.quantity;
        }
        sncSummary.total += log.quantity;
      });

      // ตรวจสอบเดือนของ budat กับ basic_start_date
      let monthCheckStatus = 'unknown';
      let monthCheckMessage = '';

      if (order && order.basic_start_date && firstLog.budat) {
        const orderStartMonth = moment(order.basic_start_date).month();
        const orderStartYear = moment(order.basic_start_date).year();
        const logMonth = moment(firstLog.budat, 'YYYYMMDD').month();
        const logYear = moment(firstLog.budat, 'YYYYMMDD').year();

        if (orderStartMonth === logMonth && orderStartYear === logYear) {
          monthCheckStatus = 'valid';
          monthCheckMessage = 'Month/year of budat matches basic_start_date';
        } else {
          monthCheckStatus = 'invalid';
          monthCheckMessage = `Month/year mismatch: order start date (${moment(order.basic_start_date).format('YYYY-MM')}) vs budat (${moment(firstLog.budat, 'YYYYMMDD').format('YYYY-MM')})`;
        }
      } else {
        monthCheckStatus = 'unknown';
        monthCheckMessage = !order
          ? 'Order not found'
          : !order.basic_start_date
            ? 'Order has no basic_start_date'
            : 'Missing budat';
      }

      // สถิติของ logs
      const statusCounts = {
        pending: syncLogs.filter((log) => log.status === 'pending').length,
        completed: syncLogs.filter((log) => log.status === 'completed').length,
        failed: syncLogs.filter((log) => log.status === 'failed').length,
      };

      // สร้างข้อมูลสรุป
      const summary = {
        tid,
        orderId,
        aufnr: firstLog.aufnr,
        budat: firstLog.budat,
        materialNumber: order?.material_number || 'Unknown',
        materialDescription: order?.material_description || 'Unknown',
        statusCounts,
        quantity: {
          good: totalGoodQuantity,
          notGood: totalNotGoodQuantity,
          total: totalGoodQuantity + totalNotGoodQuantity,
        },
        employeeSummary,
        sncSummary,
        logs: syncLogs.map((log) => ({
          id: log._id,
          itemno: log.itemno,
          employee_id: log.employee_id,
          quantity: log.quantity,
          is_not_good: log.is_not_good,
          agrnd: log.agrnd || null,
          status: log.status,
          errorMessage: log.error_message || null,
        })),
        monthCheck: {
          status: monthCheckStatus,
          message: monthCheckMessage,
          basic_start_date: order?.basic_start_date || null,
        },
      };

      return {
        status: 'success',
        message: `Successfully retrieved summary for TID: ${tid}`,
        data: [summary],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get TID summary: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ดึงข้อมูลและสรุปสำหรับหลาย TIDs
   * @param tids รายการ Transaction IDs
   * @returns สรุปข้อมูลของแต่ละ TID
   */
  async getTidsSummary(tids: string[]) {
    try {
      // ถ้าไม่ได้ระบุ TIDs ให้ดึงทั้งหมด
      if (!tids || tids.length === 0) {
        tids = await this.sapSyncLogModel.distinct('tid');
      }

      // จำกัดจำนวน TIDs เพื่อป้องกันการโหลดข้อมูลมากเกินไป
      if (tids.length > 50) {
        tids = tids.slice(0, 50);
      }

      // สร้าง array สำหรับเก็บผลลัพธ์
      const results = [];

      // ดึงข้อมูลสำหรับแต่ละ TID
      for (const tid of tids) {
        try {
          const result = await this.getTidSummary(tid);
          results.push(result.data[0]);
        } catch (error) {
          // ข้าม TID ที่มีปัญหา
          console.error(
            `Error processing TID ${tid}: ${(error as Error).message}`,
          );
        }
      }

      return {
        status: 'success',
        message: `Successfully retrieved summary for ${results.length} TIDs`,
        data: results,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get TIDs summary: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ดึงข้อมูลสรุปสำหรับ TIDs ที่มีสถานะ pending
   * @returns สรุปข้อมูลของ TIDs ที่มีสถานะ pending
   */
  async getPendingTidsSummary() {
    try {
      // ดึง TIDs ที่มีสถานะ pending
      const pendingTids = await this.sapSyncLogModel.distinct('tid', {
        status: 'pending',
      });

      if (pendingTids.length === 0) {
        return {
          status: 'success',
          message: 'No pending TIDs found',
          data: [],
        };
      }

      return await this.getTidsSummary(pendingTids);
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get pending TIDs summary: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
