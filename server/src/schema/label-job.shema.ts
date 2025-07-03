import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Document } from 'mongoose';
import { ProductionRecord } from './production-record.schema';
import { CoProductRecord } from './co-product-reccord.shema';

@Schema({
  collection: 'label_jobs',
  timestamps: true,
  versionKey: false,
})
export class LabelJob extends Document {
  // Main records
  @Prop({ type: [Types.ObjectId], ref: ProductionRecord.name })
  production_record_ids: Types.ObjectId[];

  // Co-product records
  @Prop({ type: [Types.ObjectId], ref: CoProductRecord.name })
  co_product_record_ids?: Types.ObjectId[];

  @Prop({ required: true })
  label_type:
    | '1_part'
    | '2_part'
    | 'co_product_combined'
    | 'co_product_separate';

  @Prop({ type: Types.ObjectId, ref: 'PrinterDevice', required: true })
  printer_id: Types.ObjectId;

  // Position mapping for 2_part/co_product_combined
  @Prop({ type: Object })
  position_mapping?: {
    position_1: { type: 'main' | 'co'; record_id: Types.ObjectId };
    position_2?: { type: 'main' | 'co'; record_id: Types.ObjectId };
  };

  @Prop({ required: true })
  image_path: string;

  @Prop()
  image_size?: number; // ขนาดไฟล์ (bytes)

  @Prop({
    enum: ['pending', 'generated', 'sent', 'printed', 'failed'],
    default: 'pending',
  })
  status: string;

  // Reprint fields
  @Prop({ type: Types.ObjectId, ref: 'LabelJob' })
  original_job_id?: Types.ObjectId;

  @Prop({ default: false })
  is_reprint: boolean;

  @Prop({ default: 1 })
  reprint_count: number;

  @Prop({ default: 1 })
  copies: number;

  @Prop()
  error_message?: string;

  // เพิ่มฟิลด์เหล่านี้ (ถ้าต้องการ)
  @Prop()
  printed_at?: Date; // วันเวลาที่ปริ้นจริง

  @Prop()
  generated_by?: Types.ObjectId; // ผู้สร้าง label

  createdAt?: Date;
  updatedAt?: Date;
}

export const LabelJobSchema = SchemaFactory.createForClass(LabelJob);

// Indexes (เพิ่มอีกหน่อย)
LabelJobSchema.index({ status: 1 });
LabelJobSchema.index({ printer_id: 1, createdAt: -1 });
LabelJobSchema.index({ original_job_id: 1 });
LabelJobSchema.index({ production_record_ids: 1 });
LabelJobSchema.index({ is_reprint: 1 });
LabelJobSchema.index({ label_type: 1 }); // เพิ่ม
LabelJobSchema.index({ createdAt: -1 }); // เพิ่ม
LabelJobSchema.index({ status: 1, createdAt: -1 }); // compound index
