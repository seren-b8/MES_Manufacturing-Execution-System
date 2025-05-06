import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  collection: 'serial_counters',
  timestamps: true,
})
export class SerialCounter extends Document {
  @Prop({ required: true })
  prefix: string;

  @Prop({ required: true })
  machine_number: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true, default: 0 })
  sequence: number;
}

export const SerialCounterSchema = SchemaFactory.createForClass(SerialCounter);

// สร้าง compound index ที่ unique
SerialCounterSchema.index(
  { prefix: 1, machine_number: 1, date: 1 },
  { unique: true },
);
