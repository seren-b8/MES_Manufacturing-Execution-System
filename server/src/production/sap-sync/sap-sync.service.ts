import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SqlService } from 'src/shared/services/sql.service';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import { SAPSyncLog } from 'src/shared/modules/schema/sap_sync_log.schema';
import { SAPDataTransformationService } from './sap-transformmation.service';
import {
  GroupedProductionData,
  ISAPConfirmationLog,
  PopulatedProductionRecord,
} from 'src/shared/interface/sap';

// Define interfaces for raw data structur

@Injectable()
export class SapProductionSyncService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private readonly productionRecordModel: Model<ProductionRecord>,
    @InjectModel(SAPSyncLog.name)
    private readonly sapSyncLogModel: Model<SAPSyncLog>,
    private readonly sqlService: SqlService,
    private readonly sapTransformationService: SAPDataTransformationService,
  ) {}

  private transformProductionRecord(record: any): PopulatedProductionRecord {
    return {
      _id: record._id.toString(),
      assign_order_id: {
        order_id: record.assign_order_id.order_id,
        sequence_no: record.assign_order_id.sequence_no,
        activity: record.assign_order_id.activity,
      },
      master_not_good_id: record.master_not_good_id
        ? {
            case_english: record.master_not_good_id.case_english,
          }
        : undefined,
      assign_employee_ids: record.assign_employee_ids.map((emp) => ({
        user_id: emp.user_id,
      })),
      quantity: record.quantity,
      is_not_good: record.is_not_good,
    };
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
      const employeeCount = record.assign_employee_ids.length;
      const baseQuantity = Math.floor(record.quantity / employeeCount);
      const remainder = record.quantity % employeeCount;

      // Add quantities for each employee
      for (const employee of record.assign_employee_ids) {
        const currentQuantity =
          group.employee_quantities.get(employee.user_id) || 0;
        group.employee_quantities.set(
          employee.user_id,
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
    // Prepare data for transformation
    const sapData = {
      employee_id: syncLog.employee_id,
      order_id: groupedData.order_id,
      sequence_no: groupedData.sequence_no,
      activity: groupedData.activity,
      quantity: syncLog.quantity,
      is_not_good: groupedData.is_not_good,
      case_ng: groupedData.case_ng,
    };

    // Transform data to SAP format
    const transformedData: ISAPConfirmationLog =
      this.sapTransformationService.transformToSAPFormat(sapData);

    // Prepare SQL query
    const query = `
      INSERT INTO OPENQUERY([SNC-HBQ],'SELECT MANDT,TID,ITEMNO,EMPLOYEE,AUFNR,APLFL,VORNR,UVORN,LMNGA,MEINH,XMNGA,RMNGA,RUECK,RMZHL,BUDAT,ISMNG,ISMNGEH,POSTED,MESSAGE,ERDAT,ERZET,ERNAM,WERKS,AGRND,TILE FROM ZIPHT_CONF_LOG') 
      VALUES (
        @mandt,@tid,@itemno,@employee,@aufnr,@aplfl,@vornr,@uvorn,@lmnga,
        @meinh,@xmnga,@rmnga,@rueck,@rmzhl,@budat,@ismng,@ismngeh,
        @posted,@message,@erdat,@erzet,@ernam,@werks,@agrnd,@tile
      )`;

    // Map transformed data to parameters
    const params = Object.entries(transformedData).map(([key, value]) => ({
      name: key.toLowerCase(),
      value: value,
    }));

    return this.sqlService.query(
      query,
      params.map((p) => p.value),
    );
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

      const pendingRecords = rawRecords.map((record) =>
        this.transformProductionRecord(record),
      );

      // Group records by order and operation
      const groupedData = await this.groupProductionRecords(pendingRecords);

      // Create and process sync logs
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
            error_message: error.message,
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
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to sync pending records: ' + error.message,
        data: [],
      };
    }
  }
}
