import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'oee_hourly',
  timestamps: true,
  versionKey: false,
})
export class OEEHourly extends Document {
  @Prop({ required: true, index: true })
  machine_number: string;

  @Prop({ required: true, index: true })
  hour: Date;

  @Prop({
    required: true,
    enum: ['day', 'night'],
    index: true,
  })
  shift_type: 'day' | 'night';

  @Prop({ required: true })
  oee: number;

  @Prop({ required: true })
  quality: number;

  @Prop({ required: true })
  availability: number;

  @Prop({ required: true })
  performance: number;

  @Prop({ required: true })
  total_pieces: number;

  @Prop({ required: true })
  good_pieces: number;
}

export const OEEHourlySchema = SchemaFactory.createForClass(OEEHourly);

// Compound indexes
OEEHourlySchema.index({ machine_number: 1, hour: -1 });
OEEHourlySchema.index({ hour: 1, shift_type: 1 });

// TTL index (30 days)
OEEHourlySchema.index({ hour: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
