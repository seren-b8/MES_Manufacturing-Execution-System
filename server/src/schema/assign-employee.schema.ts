import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  collection: 'assign_employee',
  timestamps: true,
})
export class AssignEmployee extends Document {
  // Employee Information
  @Prop({ required: true, index: true, ref: 'Employee' })
  employee_id: string;

  // Assignment Information
  @Prop({ required: true, index: true })
  machine_number: string;

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

// Indexes for better query performance
AssignEmployeeSchema.index({ employee_id: 1, machine_number: 1 });
AssignEmployeeSchema.index({ work_center: 1, status: 1 });
AssignEmployeeSchema.index({ datetime_open_order: 1 });
