import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'assign_order',
  timestamps: true,
})
export class AssignOrder extends Document {
  // Core Assignment Fields
  @Prop({ required: true, index: true })
  order_id: string;

  @Prop({ required: true, index: true })
  machine_number: string;

  @Prop({ required: true })
  work_center: string;

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

  // Shift Information
  @Prop({ type: String, default: null })
  shift: string;

  // Production Parameters
  @Prop({ required: true })
  target_quantity: number;

  @Prop({ default: 0 })
  actual_quantity: number;

  @Prop({ default: 0 })
  scrap_quantity: number;

  @Prop({ required: true })
  plan_cycle_time: number;

  @Prop({ required: true })
  cavity: string;

  // Production Details
  @Prop({ type: Object, default: null })
  production_parameters: {
    weight?: string;
    runner?: string;
    cycle_time?: string;
    setup_time?: string;
    condition_amount?: number;
  };

  // Additional References
  @Prop({ required: true })
  material_number: string;

  @Prop({ required: true })
  line: string;

  @Prop({ type: String, default: null })
  supervisor_id: string;
}

export const AssignOrderSchema = SchemaFactory.createForClass(AssignOrder);

// Indexes for better query performance
AssignOrderSchema.index({ machine_number: 1, status: 1 });
AssignOrderSchema.index({ work_center: 1, datetime_open_order: 1 });
AssignOrderSchema.index({ line: 1, material_number: 1 });
