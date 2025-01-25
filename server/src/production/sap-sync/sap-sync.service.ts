import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SqlService } from 'src/shared/services/sql.service';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import { SAPSyncLog } from 'src/shared/modules/schema/sap_sync_log.schema';
import {
  GroupedProductionData,
  PopulatedProductionRecord,
  PopulatedUser,
  TransformedEmployee,
} from 'src/shared/interface/sap';
import { User } from 'src/shared/modules/schema/user.schema';
import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';
import { ProductionOrder } from 'src/shared/modules/schema/production-order.schema';
import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';

// Define interfaces for raw data structur

@Injectable()
export class SapProductionSyncService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private readonly productionRecordModel: Model<ProductionRecord>,

    @InjectModel(User.name) private readonly userModel: Model<User>,

    @InjectModel(AssignEmployee.name)
    private readonly assignEmployeeModel: Model<AssignEmployee>,

    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,

    @InjectModel(SAPSyncLog.name)
    private readonly sapSyncLogModel: Model<SAPSyncLog>,

    @InjectModel(AssignOrder.name)
    private readonly assignOrderModel: Model<AssignOrder>,

    private readonly sqlService: SqlService,
  ) {}

  private async transformProductionRecord(
    record: any,
  ): Promise<PopulatedProductionRecord> {
    try {
      const productionOrder = await this.productionOrderModel
        .findById(record.assign_order_id.production_order_id)
        .lean();

      if (!productionOrder) {
        throw new Error(
          `Production order not found for ${record.assign_order_id.production_order_id}`,
        );
      }

      const assignEmployees = await this.assignEmployeeModel
        .find({ _id: { $in: record.assign_employee_ids } })
        .select('user_id')
        .populate<{ user_id: PopulatedUser }>('user_id', 'employee_id')
        .lean();

      return {
        _id: record._id.toString(),
        assign_order_id: {
          order_id: productionOrder.order_id,
          sequence_no: productionOrder.sequence_number || '000000', // Default if not present
          activity: productionOrder.activity || '0010', // Default operation
        },
        master_not_good_id: record.master_not_good_id
          ? {
              case_english: record.master_not_good_id.case_english,
            }
          : undefined,
        assign_employee_ids: assignEmployees.map((ae) => ({
          user_id: ae.user_id._id.toString(),
          employee_id: ae.user_id.employee_id,
        })) as TransformedEmployee[],
        quantity: record.quantity,
        is_not_good: record.is_not_good,
      };
    } catch (error) {
      throw new Error(
        `Failed to transform production record: ${(error as Error).message}`,
      );
    }
  }

  private async createSyncLogs(
    productionRecordIds: Types.ObjectId[],
    groupedData: GroupedProductionData,
  ) {
    const logs = [];

    // Create logs for employees
    for (const [employeeId, quantity] of groupedData.employee_quantities) {
      logs.push({
        production_record_ids: productionRecordIds,
        employee_id: employeeId,
        quantity: quantity,
        sync_type: 'EMP',
        status: 'pending',
      });
    }

    // Create log for SNC if exists
    if (groupedData.snc_quantity > 0) {
      logs.push({
        production_record_ids: productionRecordIds,
        employee_id: 'SNC',
        quantity: groupedData.snc_quantity,
        sync_type: 'SNC',
        status: 'pending',
      });
    }

    return this.sapSyncLogModel.insertMany(logs);
  }

  private async groupProductionRecords(
    records: PopulatedProductionRecord[],
  ): Promise<GroupedProductionData[]> {
    const groupedMap = new Map<string, GroupedProductionData>();

    for (const record of records) {
      if (
        !record.assign_order_id?.order_id ||
        !record.assign_order_id?.sequence_no ||
        !record.assign_order_id?.activity
      ) {
        throw new Error(
          `Invalid record data: Missing required fields for record ${record._id}`,
        );
      }

      const key = `${record.assign_order_id.order_id}-${record.assign_order_id.sequence_no}-${record.assign_order_id.activity}-${record.is_not_good}-${record.master_not_good_id?.case_english || ''}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          order_id: record.assign_order_id.order_id,
          sequence_no: record.assign_order_id.sequence_no,
          activity: record.assign_order_id.activity,
          is_not_good: record.is_not_good,
          case_ng: record.master_not_good_id?.case_english,
          employee_quantities: new Map(),
          snc_quantity: 0,
        });
      }

      const group = groupedMap.get(key);
      const employeeCount = record.assign_employee_ids.length || 1;
      const baseQuantity = Math.floor(record.quantity / employeeCount);
      const remainder = record.quantity % employeeCount;

      // Add quantities for each employee
      for (const employee of record.assign_employee_ids) {
        if (!employee?.employee_id) {
          throw new Error(`Invalid employee data for record ${record._id}`);
        }
        const currentQuantity =
          group.employee_quantities.get(employee.employee_id) || 0;
        group.employee_quantities.set(
          employee.employee_id,
          currentQuantity + baseQuantity,
        );
      }

      // Add remainder to SNC quantity
      group.snc_quantity += remainder;
    }

    return Array.from(groupedMap.values());
  }

  private async sendToSap(
    syncLog: SAPSyncLog,
    groupedData: GroupedProductionData,
  ) {
    if (
      !groupedData?.order_id ||
      !groupedData?.sequence_no ||
      !groupedData?.activity
    ) {
      throw new Error('Invalid grouped data: missing required fields');
    }

    const now = new Date();
    const tid = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${syncLog.employee_id}`;

    const query = `
      INSERT INTO OPENQUERY([SNC-HBQ],'SELECT MANDT,TID,ITEMNO,EMPLOYEE,AUFNR,APLFL,VORNR,UVORN,LMNGA,MEINH,XMNGA,RMNGA,RUECK,RMZHL,BUDAT,ISMNG,ISMNGEH,POSTED,MESSAGE,ERDAT,ERZET,ERNAM,WERKS,AGRND,TILE FROM ZIPHT_CONF_LOG') 
      VALUES (
        '700',
      '${tid}',
      1,
      '${syncLog.employee_id}',
      '${groupedData.order_id.padStart(12, '0')}',
      '${groupedData.sequence_no.padStart(6, '0')}',
      '${groupedData.activity.padStart(4, '0')}',
      '',
      ${syncLog.quantity.toFixed(3)},
      'ST',
      ${syncLog.quantity.toFixed(3)},
      0,
      0,
      '',
      CONVERT(VARCHAR(50),GETDATE(),112),
      ${syncLog.quantity.toFixed(3)},
      'STD',
      '',
      '',
      CONVERT(VARCHAR(50),GETDATE(),112),
      REPLACE(CONVERT(VARCHAR(8),GETDATE(),108),':',''),
      'ADMINIT',
      '1620',
      '${groupedData.is_not_good ? groupedData.case_ng || '' : ''}',
      'Team'
      )`;

    // console.log(query);
    return this.sqlService.query(query);
  }

  async syncPendingRecords() {
    try {
      const rawRecords = await this.productionRecordModel
        .find({
          confirmation_status: 'confirmed',
          is_synced_to_sap: false,
        })
        .populate('assign_order_id')
        .populate('master_not_good_id')
        .populate('assign_employee_ids')
        .lean();

      if (rawRecords.length === 0) {
        return {
          status: 'success',
          message: 'No pending records found',
          data: [],
        };
      }

      // Transform records sequentially to maintain order
      const pendingRecords = await Promise.all(
        rawRecords.map((record) => this.transformProductionRecord(record)),
      );

      const groupedData = await this.groupProductionRecords(pendingRecords);
      const recordIds = pendingRecords.map(
        (record) => new Types.ObjectId(record._id),
      );
      const allSyncLogs = [];

      for (const group of groupedData) {
        const syncLogs = await this.createSyncLogs(recordIds, group);
        allSyncLogs.push(...syncLogs);
      }

      // Process sync logs and send to SAP
      for (const syncLog of allSyncLogs) {
        try {
          const group = groupedData.find(
            (g) =>
              (syncLog.sync_type === 'SNC' && g.snc_quantity > 0) ||
              (syncLog.sync_type === 'EMP' &&
                g.employee_quantities.has(syncLog.employee_id)),
          );

          if (!group) {
            throw new Error(
              `No matching group found for sync log ${syncLog._id}`,
            );
          }

          await this.sendToSap(syncLog, group);

          await this.sapSyncLogModel.findByIdAndUpdate(syncLog._id, {
            status: 'completed',
            sync_timestamp: new Date(),
          });
        } catch (error) {
          await this.sapSyncLogModel.findByIdAndUpdate(syncLog._id, {
            status: 'failed',
            error_message: (error as Error).message,
          });
        }
      }

      // Update production records
      await this.productionRecordModel.updateMany(
        { _id: { $in: recordIds } },
        {
          is_synced_to_sap: true,
          sap_sync_timestamp: new Date(),
        },
      );

      return {
        status: 'success',
        message: 'Synced all pending records',
        data: [
          {
            totalRecords: pendingRecords.length,
            syncLogs: allSyncLogs.length,
          },
        ],
      };

      // Rest of the code remains the same
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to sync pending records: ' + (error as Error).message,
        data: [],
      };
    }
  }
  // เพิ่มเมธอดต่อไปนี้ใน SapProductionSyncService

  async getSyncLogs(filter: any) {
    try {
      const logs = await this.sapSyncLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .lean();

      return {
        status: 'success',
        message: 'Retrieved sync logs successfully',
        data: logs,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to retrieve sync logs: ' + (error as Error).message,
        data: [],
      };
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

      // Get production records for this sync log
      const records = await this.productionRecordModel
        .find({
          _id: { $in: syncLog.production_record_ids },
        })
        .populate('assign_order_id')
        .populate('master_not_good_id')
        .populate('assign_employee_ids')
        .lean();

      if (!records.length) {
        throw new Error('No production records found for this sync log');
      }

      const pendingRecords = await Promise.all(
        records.map((record) => this.transformProductionRecord(record)),
      );

      const groupedData = await this.groupProductionRecords(pendingRecords);

      const group = groupedData.find(
        (g) =>
          (syncLog.sync_type === 'SNC' && g.snc_quantity > 0) ||
          (syncLog.sync_type === 'EMP' &&
            g.employee_quantities.has(syncLog.employee_id)),
      );

      if (!group) {
        throw new Error('No matching group found for sync log');
      }

      await this.sendToSap(syncLog, group);

      // Update sync log status
      await this.sapSyncLogModel.findByIdAndUpdate(logId, {
        status: 'completed',
        sync_timestamp: new Date(),
        error_message: null,
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

      await this.sapSyncLogModel.findByIdAndUpdate(logId, {
        status: 'failed',
        error_message: (error as Error).message,
      });

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retry sync log: ' + (error as Error).message,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async syncSpecificRecords(recordIds: Types.ObjectId[]) {
    try {
      const records = await this.productionRecordModel
        .find({
          _id: { $in: recordIds },
          confirmation_status: 'confirmed',
        })
        .populate('assign_order_id')
        .populate('master_not_good_id')
        .populate('assign_employee_ids')
        .lean();

      if (records.length === 0) {
        return {
          status: 'error',
          message: 'No confirmed records found with provided IDs',
          data: [],
        };
      }

      const pendingRecords = await Promise.all(
        records.map((record) => this.transformProductionRecord(record)),
      );

      const groupedData = await this.groupProductionRecords(pendingRecords);
      const allSyncLogs = [];

      for (const group of groupedData) {
        const syncLogs = await this.createSyncLogs(recordIds, group);
        allSyncLogs.push(...syncLogs);
      }

      for (const syncLog of allSyncLogs) {
        try {
          const group = groupedData.find(
            (g) =>
              (syncLog.sync_type === 'SNC' && g.snc_quantity > 0) ||
              (syncLog.sync_type === 'EMP' &&
                g.employee_quantities.has(syncLog.employee_id)),
          );

          if (!group) {
            throw new Error(
              `No matching group found for sync log ${syncLog._id}`,
            );
          }

          await this.sendToSap(syncLog, group);

          await this.sapSyncLogModel.findByIdAndUpdate(syncLog._id, {
            status: 'completed',
            sync_timestamp: new Date(),
          });
        } catch (error) {
          await this.sapSyncLogModel.findByIdAndUpdate(syncLog._id, {
            status: 'failed',
            error_message: (error as Error).message,
          });
        }
      }

      await this.productionRecordModel.updateMany(
        { _id: { $in: recordIds } },
        {
          is_synced_to_sap: true,
          sap_sync_timestamp: new Date(),
        },
      );

      return {
        status: 'success',
        message: 'Synced specific records successfully',
        data: [
          {
            totalRecords: records.length,
            syncLogs: allSyncLogs.length,
          },
        ],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to sync specific records: ' + (error as Error).message,
        data: [],
      };
    }
  }
}
