import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { MaterialReceiptItem } from './material-receipt-items';
import { MaterialTransaction } from './material-transaction.schema';

export interface SAPDOItem {
  po_doc: string;
  material: string;
  del_qty: number;
  material_receipt_item_id?: Types.ObjectId;
  material_transaction_id?: Types.ObjectId;
  process_status: 'pending' | 'completed' | 'failed';
  error_message?: string;
}

@Schema({
  collection: 'sap_do_logs',
  timestamps: true,
  versionKey: false,
})
export class SAPDOLog extends Document {
  @Prop({ required: true, unique: true, index: true })
  do_num: string; // DO Number จาก SAP

  @Prop({ required: true })
  invoice_no: string;

  @Prop({ required: true })
  outbound: string;

  @Prop({ type: Date, required: true, index: true })
  del_date: Date;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  created_by: Types.ObjectId;

  @Prop({ required: true })
  employee_id: string;

  @Prop({ enum: ['N', 'Y'], default: 'N' })
  sap_sync_status?: 'N' | 'Y'; // เพิ่ม

  @Prop({ type: Date })
  sap_sync_timestamp?: Date; // เพิ่ม

  @Prop({
    type: [
      {
        po_doc: { type: String, required: true },
        material: { type: String, required: true },
        del_qty: { type: Number, required: true },
        material_receipt_item_id: {
          type: Types.ObjectId,
          ref: MaterialReceiptItem.name,
        },
        material_transaction_id: {
          type: Types.ObjectId,
          ref: MaterialTransaction.name,
        },
        process_status: {
          type: String,
          enum: ['pending', 'completed', 'failed'],
          default: 'pending',
        },
        error_message: { type: String },
      },
    ],
    required: true,
  })
  items: SAPDOItem[];

  @Prop({
    type: String,
    enum: ['pending', 'processing', 'completed', 'partial_failed', 'failed'],
    default: 'pending',
    index: true,
  })
  overall_status: string;

  @Prop()
  processing_notes?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SAPDOLogSchema = SchemaFactory.createForClass(SAPDOLog);

// Indexes
SAPDOLogSchema.index({ do_num: 1 }, { unique: true });
SAPDOLogSchema.index({ invoice_no: 1 });
SAPDOLogSchema.index({ overall_status: 1 });
SAPDOLogSchema.index({ createdAt: -1 });
SAPDOLogSchema.index({ 'items.material': 1 });
SAPDOLogSchema.index({ 'items.po_doc': 1 });
