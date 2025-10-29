import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MaterialLocation } from './material-location.schema';
import { MaterialPosition } from './material-position.schema';
import { MaterialTransaction } from './material-transaction.schema';
import { User } from './user.schema';
import { MaterialReceipt } from './material-receipts.schema';

@Schema({
  collection: 'material_receipt_items',
  timestamps: true,
  versionKey: false,
})
export class MaterialReceiptItem extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: MaterialReceipt.name,
    required: true,
    index: true,
  })
  material_receipt_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: MaterialLocation.name,
    required: true,
  })
  location_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: MaterialPosition.name,
  })
  position_id?: Types.ObjectId;

  @Prop({ required: true })
  quantity: number;

  @Prop()
  lot_number?: string;

  @Prop({
    type: Types.ObjectId,
    ref: MaterialTransaction.name,
  })
  material_transaction_id?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: User.name,
    required: true,
  })
  received_by: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  received_at: Date;

  @Prop()
  remark?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type MaterialReceiptItemDocument = MaterialReceiptItem & Document;
export const MaterialReceiptItemSchema =
  SchemaFactory.createForClass(MaterialReceiptItem);

// Indexes
MaterialReceiptItemSchema.index({ material_receipt_id: 1 });
MaterialReceiptItemSchema.index({ location_id: 1, received_at: -1 });
MaterialReceiptItemSchema.index({ material_transaction_id: 1 });
MaterialReceiptItemSchema.index({ received_by: 1 });
