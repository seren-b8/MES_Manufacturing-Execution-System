import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';

@Injectable()
export class SapSyncValidationService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private readonly productionRecordModel: Model<ProductionRecord>,
  ) {}

  async validateProductionRecord(
    record: ProductionRecord,
  ): Promise<string | null> {
    // 1. ตรวจสอบสถานะการยืนยัน
    if (record.confirmation_status !== 'confirmed') {
      return 'Record must be confirmed before syncing';
    }

    // 2. ตรวจสอบว่าได้ซิงค์ไปแล้วหรือยัง
    if (record.is_synced_to_sap) {
      return 'Record has already been synced to SAP';
    }

    // 3. ตรวจสอบข้อมูลงานเสีย
    if (record.is_not_good && !record.master_not_good_id) {
      return 'Not good record must have master_not_good_id';
    }

    // 4. ตรวจสอบจำนวนที่ผลิต
    if (record.quantity <= 0) {
      return 'Production quantity must be greater than 0';
    }

    // 5. ตรวจสอบการมอบหมายพนักงาน
    if (!record.assign_employee_ids?.length) {
      return 'Record must have assigned employees';
    }

    return null;
  }

  validateGroupedData(groupedData: any): string | null {
    // 1. ตรวจสอบข้อมูลพื้นฐาน
    if (
      !groupedData.order_id ||
      !groupedData.sequence_no ||
      !groupedData.activity
    ) {
      return 'Missing required fields in grouped data';
    }

    // 2. ตรวจสอบข้อมูลพนักงาน
    if (
      groupedData.employee_quantities.size === 0 &&
      groupedData.snc_quantity === 0
    ) {
      return 'No employee quantities or SNC quantity found';
    }

    // 3. ตรวจสอบข้อมูลงานเสีย
    if (groupedData.is_not_good && !groupedData.case_ng) {
      return 'Not good record must have case_ng';
    }

    // 4. ตรวจสอบความถูกต้องของจำนวน
    for (const [_, quantity] of groupedData.employee_quantities) {
      if (quantity <= 0) {
        return 'Employee quantities must be greater than 0';
      }
    }
    if (groupedData.snc_quantity < 0) {
      return 'SNC quantity cannot be negative';
    }

    return null;
  }

  validateSyncLog(syncLog: any): string | null {
    // 1. ตรวจสอบข้อมูลพื้นฐาน
    if (!syncLog.production_record_ids?.length) {
      return 'Missing production record references';
    }

    // 2. ตรวจสอบประเภทการซิงค์
    if (!['EMP', 'SNC'].includes(syncLog.sync_type)) {
      return 'Invalid sync type';
    }

    // 3. ตรวจสอบรหัสพนักงาน
    if (syncLog.sync_type === 'EMP' && !syncLog.employee_id) {
      return 'Employee sync must have employee_id';
    }
    if (syncLog.sync_type === 'SNC' && syncLog.employee_id !== 'SNC') {
      return 'SNC sync must have employee_id as "SNC"';
    }

    // 4. ตรวจสอบจำนวน
    if (typeof syncLog.quantity !== 'number' || syncLog.quantity <= 0) {
      return 'Invalid quantity';
    }

    return null;
  }
}
