import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AssignOrder } from './assign-order.schema';
import { User } from './user.schema';

@Schema({
  collection: 'assign_employee',
  timestamps: true,
  versionKey: false,
})
export class AssignEmployee extends Document {
  // Employee Information
  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
    ref: User.name,
  })
  user_id: Types.ObjectId;

  // Order References
  @Prop({ type: Types.ObjectId, required: true, ref: AssignOrder.name })
  assign_order_id: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  log_date: Date;

  // Assignment Status
  @Prop({
    type: String,
    enum: ['active', 'completed', 'suspended'],
    default: 'active',
  })
  status: string;
}

export const AssignEmployeeSchema =
  SchemaFactory.createForClass(AssignEmployee);

AssignEmployeeSchema.index({ user_id: 1 });
