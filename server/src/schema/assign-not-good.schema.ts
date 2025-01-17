import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'assign_not_good',
})
export class AssignNotGood extends Document {
  @Prop({
    type: Types.ObjectId,
    required: true,
    ref: 'AssignEmployee',
    index: true,
  })
  assign_employee_id: Types.ObjectId;

  // Not Good Details
  @Prop({ required: true, ref: 'MasterNotGood' })
  master_not_good_id: string;

  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ type: String, default: null })
  inspector_id: string;

  // Status
  @Prop({
    type: String,
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending',
  })
  status: string;
}

export const AssignNotGoodSchema = SchemaFactory.createForClass(AssignNotGood);

// Indexes for better query performance
AssignNotGoodSchema.index({ machine_number: 1, log_date: 1 });
AssignNotGoodSchema.index({ work_center: 1, status: 1 });
AssignNotGoodSchema.index({ operator_id: 1, shift: 1 });
