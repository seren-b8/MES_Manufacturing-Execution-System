import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  collection: 'assign_employee',
  timestamps: true,
})
export class AssignEmployee extends Document {
  // Employee Information
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'User' })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  work_center: string;

  // Order References
  @Prop({ type: Types.ObjectId, required: true, ref: 'AssignOrder' })
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
