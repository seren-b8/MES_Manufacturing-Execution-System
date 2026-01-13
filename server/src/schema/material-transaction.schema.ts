import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MaterialLocation } from './material-location.schema';
import { User } from './user.schema';
import { MachineInfo } from './machine-info.schema';
import { ProductionOrder } from './production-order.schema';
import { Material } from './material.schema';
import { MaterialPosition } from './material-position.schema';

@Schema({
  collection: 'material_transaction',
  timestamps: true,
  versionKey: false,
})
export class MaterialTransaction extends Document {
  @Prop({
    required: true,
    enum: ['receive', 'transfer', 'consume', 'cancellation'],
  })
  transaction_type: string;

  @Prop({ type: Types.ObjectId, ref: Material.name, required: true })
  material_id: Types.ObjectId;

  @Prop({ required: true })
  quantity: number;

  @Prop({ type: Date, default: Date.now })
  transaction_date: Date;

  @Prop({ type: Types.ObjectId, ref: MaterialLocation.name })
  from_location_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: MaterialLocation.name })
  to_location_id: Types.ObjectId;

  // Position References (เพิ่มใหม่)
  @Prop({ type: Types.ObjectId, ref: MaterialPosition.name })
  from_position_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: MaterialPosition.name })
  to_position_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name })
  user_id: Types.ObjectId;

  @Prop()
  reference_doc: string;

  // Lot Number (เพิ่มบรรทัดนี้)
  @Prop()
  lot_number?: string;

  // Fields ที่อาจเพิ่มเข้ามาเพื่อรองรับการเชื่อมโยงกับ Production Order และ Machine
  @Prop({ type: Types.ObjectId, ref: ProductionOrder.name })
  production_order_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: MachineInfo.name })
  machine_id: Types.ObjectId;

  // Cancellation fields
  @Prop({ default: false, index: true })
  is_cancelled: boolean;

  @Prop({ type: Types.ObjectId, ref: MaterialTransaction.name })
  cancelled_transaction_id?: Types.ObjectId; // Transaction ที่ถูกยกเลิก

  @Prop({ type: Types.ObjectId, ref: MaterialTransaction.name })
  cancelled_by_transaction_id?: Types.ObjectId; // ถูกยกเลิกโดย transaction ไหน

  @Prop({ type: Types.ObjectId, ref: User.name })
  cancelled_by_user?: Types.ObjectId;

  @Prop()
  cancelled_at?: Date;

  @Prop()
  cancellation_reason?: string;
}

export type MaterialTransactionDocument = MaterialTransaction & Document;
export const MaterialTransactionSchema =
  SchemaFactory.createForClass(MaterialTransaction);

MaterialTransactionSchema.index({ material_id: 1, transaction_date: -1 });
MaterialTransactionSchema.index({ from_location_id: 1, transaction_date: -1 });
MaterialTransactionSchema.index({ to_location_id: 1, transaction_date: -1 });
MaterialTransactionSchema.index({ from_position_id: 1 });
MaterialTransactionSchema.index({ to_position_id: 1 });
MaterialTransactionSchema.index({ production_order_id: 1 });
MaterialTransactionSchema.index({ user_id: 1, transaction_date: -1 });
MaterialTransactionSchema.index({ lot_number: 1 });
MaterialTransactionSchema.index({ transaction_type: 1, transaction_date: -1 });
