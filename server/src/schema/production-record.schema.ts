import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import * as moment from 'moment-timezone';
import { User, UserSchema } from './user.schema';
import { AssignOrder } from './assign-order.schema';
import { AssignEmployee } from './assign-employee.schema';
import { MasterNotGood } from './master-not-good.schema';
import { SerialCounter } from './serial-counter.schema';

@Schema({
  collection: 'production_records',
  timestamps: true,
  versionKey: false,
})
export class ProductionRecord extends Document {
  @Prop({
    required: true,
    index: true,
    ref: AssignEmployee.name,
    type: [Types.ObjectId],
  })
  assign_employee_ids: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: AssignOrder.name, required: true })
  assign_order_id: Types.ObjectId; // เพิ่มฟิลด์นี้

  @Prop({ required: true, index: true })
  is_not_good: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  quantity: number;

  @Prop({
    type: mongoose.Types.ObjectId,
    ref: MasterNotGood.name,
    required: function (this: ProductionRecord) {
      return this.is_not_good;
    },
  })
  master_not_good_id: mongoose.Types.ObjectId;

  @Prop({ type: String })
  remark: string;

  @Prop({
    required: true,
    unique: true,
  })
  serial_code: string;

  @Prop({
    type: mongoose.Types.ObjectId,
    ref: SerialCounter.name,
    required: true,
  })
  serial_counter_id: mongoose.Types.ObjectId;

  @Prop({
    type: Date,
    required: true,
    index: true,
  })
  production_date: Date;

  // สถานะการ confirm
  @Prop({
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending',
  })
  confirmation_status: string;

  @Prop({ type: Types.ObjectId, ref: User.name })
  confirmed_by: Types.ObjectId;

  @Prop()
  confirmed_at: Date;

  @Prop()
  rejection_reason: string;

  // สถานะการส่ง SAP
  @Prop({ type: Boolean, default: false })
  is_synced_to_sap: boolean;

  @Prop({ type: Date })
  sap_sync_timestamp: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProductionRecordSchema =
  SchemaFactory.createForClass(ProductionRecord);

ProductionRecordSchema.index({ assign_order_id: 1, is_synced_to_sap: 1 });
ProductionRecordSchema.index({ assign_employee_ids: 1, created_at: -1 });
ProductionRecordSchema.index({
  serial_code: 1,
  created_at: -1,
});
// สำหรับการค้นหา records ที่รอการซิงค์กับ SAP
ProductionRecordSchema.index({
  confirmation_status: 1,
  is_synced_to_sap: 1,
});

// สำหรับการจัดกลุ่มตามวันที่
ProductionRecordSchema.index({
  createdAt: 1,
});

// สำหรับการค้นหา records ตามสถานะการยืนยัน
ProductionRecordSchema.index({
  confirmation_status: 1,
});

// สำหรับการค้นหาและกรองตามใบสั่งงานและสถานะการยืนยัน
ProductionRecordSchema.index({
  assign_order_id: 1,
  confirmation_status: 1,
});

// Compound index สำหรับการค้นหาและกรองที่ซับซ้อน
ProductionRecordSchema.index({
  assign_order_id: 1,
  is_not_good: 1,
  confirmation_status: 1,
});

// สำหรับการรายงานและสรุปผลการผลิตตามช่วงเวลา
ProductionRecordSchema.index({
  createdAt: 1,
  assign_order_id: 1,
  is_not_good: 1,
});

// Auto-calculate production_date based on createdAt and Thailand timezone
ProductionRecordSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('createdAt')) {
    // Use moment-timezone with Asia/Bangkok
    const recordDate = this.createdAt
      ? moment(this.createdAt).tz('Asia/Bangkok')
      : moment().tz('Asia/Bangkok');

    const cutoffHour = 8; // 8:00 AM

    // If before 8:00 AM, use previous day
    if (recordDate.hour() < cutoffHour) {
      recordDate.subtract(1, 'days');
    }

    // Set to start of day (00:00:00)
    recordDate.startOf('day');

    this.production_date = recordDate.toDate();
  }
  next();
});

// Validation for not-good records
ProductionRecordSchema.pre('validate', function (next) {
  if (this.is_not_good && !this.master_not_good_id) {
    this.invalidate(
      'master_not_good_id',
      'master_not_good_id is required for not-good records',
    );
  }
  next();
});
