import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'assign_not_good',
})
export class AssignNotGood extends Document {
  // Reference to AssignOrder
  @Prop({
    type: Types.ObjectId,
    required: true,
    ref: 'AssignOrder',
    index: true,
  })
  assign_order_id: Types.ObjectId;

  // Machine and Order Information
  @Prop({ required: true, index: true })
  machine_number: string;

  @Prop({ required: true })
  order_id: string;

  @Prop({ required: true })
  work_center: string;

  // Not Good Details
  @Prop({ required: true })
  case_id: string;

  @Prop({ required: true })
  case_desc: string;

  @Prop({ type: String, default: null })
  case_detail: string;

  @Prop({ required: true, min: 0 })
  not_good_quantity: number;

  // Timing and Shift Information
  @Prop({ type: Date, required: true, index: true })
  log_date: Date;

  @Prop({ type: String, required: true })
  shift: string;

  // Employee Information
  @Prop({ required: true })
  operator_id: string;

  @Prop({ type: String, default: null })
  inspector_id: string;

  // Status
  @Prop({
    type: String,
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending',
  })
  status: string;

  // Quality Information
  @Prop({ type: Object, default: null })
  quality_details: {
    inspection_result?: string;
    corrective_action?: string;
    root_cause?: string;
    prevention_measures?: string;
  };
}

export const AssignNotGoodSchema = SchemaFactory.createForClass(AssignNotGood);

// Indexes for better query performance
AssignNotGoodSchema.index({ machine_number: 1, log_date: 1 });
AssignNotGoodSchema.index({ work_center: 1, status: 1 });
AssignNotGoodSchema.index({ operator_id: 1, shift: 1 });
