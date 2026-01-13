import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Document } from 'mongoose';
import { ProductionRecord } from './production-record.schema';
import { AssignEmployee } from './assign-employee.schema';
import { AssignOrder } from './assign-order.schema';

@Schema({
  collection: 'co_product_records',
  timestamps: true,
  versionKey: false,
})
export class CoProductRecord extends Document {
  @Prop({ type: Types.ObjectId, ref: AssignOrder.name, required: true })
  assign_order_id: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
    ref: AssignEmployee.name,
    type: [Types.ObjectId],
  })
  assign_employee_ids: Types.ObjectId[];

  @Prop({ required: true })
  co_quantity: number;

  @Prop({ required: true })
  serial_code: string;

  @Prop({ type: Date, required: true })
  production_date: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CoProductRecordSchema =
  SchemaFactory.createForClass(CoProductRecord);

// Indexes
CoProductRecordSchema.index({ main_production_record_id: 1 });
CoProductRecordSchema.index({ co_material_number: 1 });
CoProductRecordSchema.index({ serial_code: 1 }, { unique: true });
CoProductRecordSchema.index({ production_date: 1 });
