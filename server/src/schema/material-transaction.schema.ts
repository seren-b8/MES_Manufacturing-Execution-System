import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MaterialLocation } from './material-location.schema';
import { User } from './user.schema';
import { MachineInfo } from './machine-info.schema';
import { ProductionOrder } from './production-order.schema';
import { Material } from './material.schema';

@Schema({ collection: 'material_transaction' })
export class MaterialTransaction {
  @Prop({ required: true, enum: ['receive', 'transfer', 'consume'] })
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

  @Prop({ type: Types.ObjectId, ref: User.name })
  user_id: Types.ObjectId;

  @Prop()
  reference_doc: string;

  // Fields ที่อาจเพิ่มเข้ามาเพื่อรองรับการเชื่อมโยงกับ Production Order และ Machine
  @Prop({ type: Types.ObjectId, ref: ProductionOrder.name })
  production_order_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: MachineInfo.name })
  machine_id: Types.ObjectId;
}

export type TransactionDocument = MaterialTransaction & Document;
export const TransactionSchema =
  SchemaFactory.createForClass(MaterialTransaction);
