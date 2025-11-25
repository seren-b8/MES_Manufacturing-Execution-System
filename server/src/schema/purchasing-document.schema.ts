// purchasing-document.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'purchasing_documents',
  timestamps: true,
  versionKey: false,
})
export class PurchasingDocument extends Document {
  @Prop({ required: true, index: true })
  purchasing_document: string; // PO Number

  @Prop({ required: true })
  item: string; // Item number

  @Prop({ type: Date, required: true, index: true })
  doc_date: Date; // Document date

  @Prop({ required: true, index: true })
  material: string; // Material number

  @Prop({ required: true })
  part_name: string; // Part description

  @Prop({ required: true })
  order_qty: number; // Order quantity

  @Prop({ required: true })
  order_unit: string; // Unit of measurement

  @Prop({ required: true, index: true })
  plant: string; // Plant code

  // Additional fields for tracking
  @Prop({ default: 0 })
  received_qty: number; // จำนวนที่รับแล้ว

  @Prop({ default: 0 })
  remaining_qty: number; // จำนวนคงเหลือ

  @Prop({
    type: String,
    enum: ['open', 'partial', 'completed', 'cancelled'],
    default: 'open',
    index: true,
  })
  status: string;

  @Prop({ type: Date })
  last_received_date: Date; // วันที่รับล่าสุด

  createdAt?: Date;
  updatedAt?: Date;
}

export const PurchasingDocumentSchema =
  SchemaFactory.createForClass(PurchasingDocument);

// Indexes
PurchasingDocumentSchema.index(
  { purchasing_document: 1, item: 1 },
  { unique: true },
);
PurchasingDocumentSchema.index({ material: 1, plant: 1 });
PurchasingDocumentSchema.index({ status: 1, doc_date: -1 });
PurchasingDocumentSchema.index({ doc_date: -1 });

// Pre-save middleware to calculate remaining_qty
PurchasingDocumentSchema.pre('save', function (next) {
  this.remaining_qty = this.order_qty - this.received_qty;

  // Update status based on received quantity
  if (this.received_qty === 0) {
    this.status = 'open';
  } else if (this.received_qty >= this.order_qty) {
    this.status = 'completed';
  } else {
    this.status = 'partial';
  }

  next();
});
