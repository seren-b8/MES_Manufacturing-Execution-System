import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({
  collection: 'sap_sync_logs',
  timestamps: true,
})
export class SAPSyncLog {
  // MongoDB id
  _id: Types.ObjectId; // เพิ่ม _id
  // ข้อมูลอ้างอิง
  @Prop({ type: [{ type: Types.ObjectId }], required: true })
  production_record_ids: Types.ObjectId[];

  // ข้อมูลพื้นฐาน
  @Prop({ required: true })
  employee_id: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  sync_type: 'EMP' | 'SNC';

  // ข้อมูลสถานะ
  @Prop({
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop()
  error_message?: string;

  @Prop({ type: Date })
  sync_timestamp?: Date;

  // ข้อมูลสำหรับ SAP ที่ต้องเก็บ
  @Prop({ required: true })
  tid: string; // Transaction ID

  @Prop({ required: true })
  itemno: number; // Item sequence number

  @Prop({ required: true })
  aufnr: string; // Production order number

  @Prop({ required: true })
  aplfl: string; // Operation counter/sequence

  @Prop({ required: true })
  vornr: string; // Operation number

  @Prop({ required: true })
  budat: string; // Posting date

  @Prop({ required: true })
  erdat: string; // Creation date

  @Prop({ required: true })
  erzet: string; // Creation time

  // ข้อมูลงานเสีย
  @Prop({ required: true })
  is_not_good: boolean;

  @Prop()
  agrnd?: string; // Reason code (for NG only)

  @Prop({ type: Number, default: 60 })
  cycle_time_per_unit?: number; //Cycle time per unit (in seconds)
}

export const SAPSyncLogSchema = SchemaFactory.createForClass(SAPSyncLog);

// สร้าง indexes ที่จำเป็น
SAPSyncLogSchema.index({ tid: 1 });
SAPSyncLogSchema.index({ status: 1 });
SAPSyncLogSchema.index({ employee_id: 1, sync_timestamp: -1 });
SAPSyncLogSchema.index({ production_record_ids: 1 });
SAPSyncLogSchema.index({ aufnr: 1, aplfl: 1, vornr: 1 });
