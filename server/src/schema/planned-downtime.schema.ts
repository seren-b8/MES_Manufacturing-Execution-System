import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'planned_downtime',
  timestamps: true,
  versionKey: false,
})
export class PlannedDowntime extends Document {
  @Prop({ required: true, index: true })
  machine_number: string;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({
    required: true,
    enum: ['day', 'night', 'all'],
    index: true,
  })
  shift: string;

  @Prop({ required: true })
  planned_downtime_minutes: number;

  @Prop({
    enum: [
      'maintenance',
      'setup',
      'break',
      'material_change',
      'cleaning',
      'other',
    ],
    required: true,
  })
  downtime_type: string;

  @Prop()
  description?: string;

  @Prop({
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
  })
  status: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PlannedDowntimeSchema =
  SchemaFactory.createForClass(PlannedDowntime);

PlannedDowntimeSchema.index({
  machine_number: 1,
  date: 1,
  shift: 1,
});
PlannedDowntimeSchema.index({ status: 1 });
PlannedDowntimeSchema.index({ downtime_type: 1 });
