import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, isValidObjectId, Types } from 'mongoose';
import { ProductionOrder } from './production-order.schema';

@Schema({
  collection: 'assign_order',
  timestamps: true,
  versionKey: false,
})
export class AssignOrder extends Document {
  @Prop({
    required: true,
    index: true,
    ref: ProductionOrder.name,
    type: Types.ObjectId,
  })
  production_order_id: Types.ObjectId;

  @Prop({ required: true })
  machine_number: string;

  // Assignment Status
  @Prop({
    type: String,
    enum: ['pending', 'active', 'completed', 'suspended'],
    default: 'pending',
    index: true,
  })
  status: string;

  // Timing Information
  @Prop({ type: Date, required: true, index: true })
  datetime_open_order: Date;

  @Prop({ type: Date })
  datetime_close_order: Date;

  @Prop({ type: Object })
  current_summary: {
    total_good_quantity: number;
    total_not_good_quantity: number;
    last_update: Date;
  };
}

export const AssignOrderSchema = SchemaFactory.createForClass(AssignOrder);
// Indexes for better query performance
