import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import { SAPSyncLog } from 'src/shared/modules/schema/sap_sync_log.schema';

@Injectable()
export class SapSyncValidationService {
  constructor(
    @InjectModel(SAPSyncLog.name)
    private readonly sapSyncLogModel: Model<SAPSyncLog>,
  ) {}
  private readonly EMP_ID_MAX_LENGTH = 11;
  private readonly TID_MAX_LENGTH = 32;
  private readonly SAP_FIELD_CONSTRAINTS = {
    MANDT: { maxLength: 3, required: true },
    TID: { maxLength: 32, required: true },
    EMPLOYEE: { maxLength: 11, required: true },
    AUFNR: { maxLength: 12, required: true },
    APLFL: { maxLength: 6, required: true },
    VORNR: { maxLength: 4, required: true },
    UVORN: { maxLength: 4, required: false },
    MEINH: { maxLength: 3, required: true },
    ISMNGEH: { maxLength: 3, required: true },
    ERNAM: { maxLength: 12, required: true },
    WERKS: { maxLength: 4, required: true },
    AGRND: { maxLength: 4, required: false },
    TILE: { maxLength: 20, required: true },
  };

  validateSAPFields(data: {
    employeeId: string;
    orderId: string;
    sequenceNo: string;
    activity: string;
  }): void {
    const validations = [
      {
        field: 'employeeId',
        value: data.employeeId,
        maxLength: 11,
        required: true,
      },
      { field: 'orderId', value: data.orderId, maxLength: 12, required: true },
      {
        field: 'sequenceNo',
        value: data.sequenceNo,
        maxLength: 6,
        required: true,
      },
      { field: 'activity', value: data.activity, maxLength: 4, required: true },
    ];

    const errors = validations
      .map(({ field, value, maxLength, required }) => {
        if (required && !value) {
          return `${field} is required`;
        }
        if (value && value.length > maxLength) {
          return `${field} exceeds maximum length of ${maxLength} characters`;
        }
        return null;
      })
      .filter((error) => error !== null);

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  async validateProductionRecord(
    record: ProductionRecord,
  ): Promise<string | null> {
    if (!record) {
      return 'Production record is required';
    }

    if (record.confirmation_status !== 'confirmed') {
      return 'Record must be confirmed before syncing';
    }

    if (record.is_synced_to_sap) {
      return 'Record has already been synced to SAP';
    }

    if (record.is_not_good && !record.master_not_good_id) {
      return 'Not good record must have master_not_good_id';
    }

    if (!this.isValidQuantity(record.quantity)) {
      return 'Invalid production quantity';
    }

    if (!record.assign_employee_ids?.length) {
      return 'Record must have assigned employees';
    }

    if (!record.assign_order_id) {
      return 'Record must have assigned order';
    }

    return null;
  }

  validateGroupedData(groupedData: any): string | null {
    if (!groupedData) {
      return 'Grouped data is required';
    }

    if (!this.isValidOrderId(groupedData.order_id)) {
      return 'Invalid order ID format';
    }

    if (!this.isValidSequenceNo(groupedData.sequence_no)) {
      return 'Invalid sequence number format';
    }

    if (!this.isValidActivity(groupedData.activity)) {
      return 'Invalid activity format';
    }

    if (
      groupedData.employee_quantities.size === 0 &&
      groupedData.snc_quantity === 0
    ) {
      return 'No employee quantities or SNC quantity found';
    }

    if (groupedData.is_not_good && !this.isValidCaseNG(groupedData.case_ng)) {
      return 'Invalid not good case format';
    }

    for (const [empId, quantity] of groupedData.employee_quantities) {
      if (!this.isValidEmployeeId(empId)) {
        return `Invalid employee ID format: ${empId}`;
      }
      if (!this.isValidQuantity(quantity)) {
        return `Invalid quantity for employee ${empId}`;
      }
    }

    if (!this.isValidSNCQuantity(groupedData.snc_quantity)) {
      return 'Invalid SNC quantity';
    }

    return null;
  }

  validateSyncLog(syncLog: any): string | null {
    if (!syncLog) {
      return 'Sync log is required';
    }

    if (!syncLog.production_record_ids?.length) {
      return 'Missing production record references';
    }

    if (!this.isValidSyncType(syncLog.sync_type)) {
      return 'Invalid sync type';
    }

    if (syncLog.sync_type === 'EMP') {
      if (!this.isValidEmployeeId(syncLog.employee_id)) {
        return 'Invalid employee ID format';
      }
    } else if (syncLog.sync_type === 'SNC' && syncLog.employee_id !== 'SNC') {
      return 'SNC sync must have employee_id as "SNC"';
    }

    if (!this.isValidQuantity(syncLog.quantity)) {
      return 'Invalid quantity format';
    }

    if (syncLog.is_not_good && !this.isValidCaseNG(syncLog.agrnd)) {
      return 'Invalid not good case format';
    }

    return null;
  }

  private isValidOrderId(orderId: string): boolean {
    return Boolean(orderId && orderId.length <= 12 && /^\d+$/.test(orderId));
  }

  private isValidSequenceNo(sequenceNo: string): boolean {
    return Boolean(
      sequenceNo && sequenceNo.length <= 6 && /^\d+$/.test(sequenceNo),
    );
  }

  private isValidActivity(activity: string): boolean {
    return Boolean(activity && activity.length <= 4 && /^\d+$/.test(activity));
  }

  private isValidEmployeeId(employeeId: string): boolean {
    if (employeeId === 'SNC') {
      console.log('Special case, allowing');
      return true;
    }

    return Boolean(
      employeeId &&
        employeeId.length <= this.EMP_ID_MAX_LENGTH &&
        /^[A-Za-z0-9]+$/.test(employeeId),
    );
  }

  private isValidQuantity(quantity: number): boolean {
    return (
      typeof quantity === 'number' && quantity > 0 && quantity <= 999999.999
    );
  }

  private isValidSNCQuantity(quantity: number): boolean {
    return typeof quantity === 'number' && quantity >= 0 && quantity < 1;
  }

  private isValidCaseNG(caseNG: string): boolean {
    return Boolean(
      caseNG && caseNG.length <= 4 && /^[A-Za-z0-9]+$/.test(caseNG),
    );
  }

  private isValidSyncType(syncType: string): boolean {
    return ['EMP', 'SNC'].includes(syncType);
  }

  validateAndTruncateField(
    value: string,
    fieldName: keyof typeof this.SAP_FIELD_CONSTRAINTS,
  ): string {
    const constraint = this.SAP_FIELD_CONSTRAINTS[fieldName];
    if (!constraint) {
      throw new Error(`Unknown field: ${fieldName}`);
    }

    if (constraint.required && !value) {
      throw new Error(`Field ${fieldName} is required`);
    }

    return value ? value.substring(0, constraint.maxLength) : '';
  }

  validateAndTruncateEmployeeId(employeeId: string): string {
    if (!employeeId) {
      throw new Error('Employee ID is required');
    }
    if (!this.isValidEmployeeId(employeeId)) {
      throw new Error('Invalid employee ID format');
    }
    return employeeId.substring(0, this.EMP_ID_MAX_LENGTH);
  }

  async createTID(): Promise<string> {
    try {
      // คำนำหน้าพื้นฐานสำหรับ TID
      const base = 'TID';

      // กำหนดความยาวของส่วนต่อท้าย
      const suffixLength = 17; // ปรับเป็น 17 ตัวอักษร

      // ค้นหาเรคอร์ดล่าสุดเพื่อดึงรหัสที่ถูกสร้างล่าสุด
      const lastRecord = await this.sapSyncLogModel
        .findOne()
        .sort({ tid: -1 })
        .lean()
        .exec();

      // กำหนดค่าเริ่มต้นให้กับส่วนต่อท้าย
      let nextSuffix = 'B4F60E209F1369AB01'; // ค่าเริ่มต้นที่มีความยาว 17 ตัวอักษร

      if (lastRecord && lastRecord.tid) {
        // แยกส่วนต่อท้ายออกจากรหัสที่สร้างล่าสุด
        const lastGenerated = lastRecord.tid.slice(base.length);

        // ตรวจสอบว่ารูปแบบถูกต้อง
        if (/^[0-9A-F]+$/.test(lastGenerated)) {
          // เพิ่มค่าเลขฐานสิบหกและจัดรูปแบบให้เป็นตัวอักษรพิมพ์ใหญ่
          nextSuffix = (BigInt(`0x${lastGenerated}`) + BigInt(1))
            .toString(16)
            .toUpperCase()
            .padStart(suffixLength, '0');
        }
      }

      // รวมคำนำหน้าและส่วนต่อท้าย
      return `${base}${nextSuffix}`;
    } catch (error) {
      console.error('Error generating TID:', error);

      // ในกรณีที่มีข้อผิดพลาด ใช้ timestamp เป็นค่าสำรอง
      const timestamp = new Date().getTime().toString(16).toUpperCase();
      return `TID${timestamp.padStart(17, '0')}`;
    }
  }
}
