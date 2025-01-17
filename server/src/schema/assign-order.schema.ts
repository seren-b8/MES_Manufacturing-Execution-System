import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, isValidObjectId, Types } from 'mongoose';

@Schema({
  collection: 'assign_order',
  timestamps: true,
})
export class AssignOrder extends Document {
  // Core Assignment Fields
  @Prop({
    required: true,
    index: true,
    ref: 'ProductionOrder',
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
}

export const AssignOrderSchema = SchemaFactory.createForClass(AssignOrder);

// Indexes for better query performance
