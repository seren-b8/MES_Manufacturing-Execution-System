import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  collection: 'material_receipts',
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class MaterialReceipt extends Document {
  // ข้อมูลจาก SAP
  @Prop({ required: true, index: true })
  plant: string;

  @Prop({ required: true, index: true })
  material_number: string;

  @Prop({ required: true })
  short_text: string;

  @Prop({ required: true })
  movement_type: string;

  @Prop({ type: Date, required: true, index: true })
  received_date: Date;

  @Prop({ required: true, default: 0 })
  total_received_quantity: number;

  @Prop({ default: 0 })
  processed_quantity: number;

  @Prop({ default: 0 })
  remaining_quantity: number;

  @Prop({
    type: String,
    enum: ['pending', 'partial', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
  })
  receipt_status: string;

  @Prop({ required: true })
  unit: string;

  @Prop()
  material_group_desc: string;

  @Prop()
  material_group_desc2: string;

  // ข้อมูลเพิ่มเติมสำหรับ MES
  @Prop({
    type: String,
    enum: ['pending', 'processed', 'failed'],
    default: 'pending',
    index: true,
  })
  sync_status: string;

  @Prop()
  sync_error?: string;

  @Prop({ type: Date })
  processed_at?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export type MaterialReceiptDocument = MaterialReceipt & Document;
export const MaterialReceiptSchema =
  SchemaFactory.createForClass(MaterialReceipt);

// Indexes
MaterialReceiptSchema.index({ plant: 1, received_date: -1 });
MaterialReceiptSchema.index({ material_number: 1, received_date: -1 });
MaterialReceiptSchema.index({ sync_status: 1, received_date: -1 });
MaterialReceiptSchema.index({ movement_type: 1 });
MaterialReceiptSchema.index({ receipt_status: 1 });

// Virtual
MaterialReceiptSchema.virtual('receipt_items', {
  ref: 'MaterialReceiptItem',
  localField: '_id',
  foreignField: 'material_receipt_id',
});
