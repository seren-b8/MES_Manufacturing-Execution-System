import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'serial_counters',
  timestamps: true,
  versionKey: false,
})
export class SerialCounter extends Document {
  @Prop({ required: true, index: true })
  prefix: string;

  @Prop({ required: true, index: true })
  machine_number: string;

  @Prop({ required: true, index: true })
  date: string;

  @Prop({ required: true, default: 0 })
  sequence: number;
}

export const SerialCounterSchema = SchemaFactory.createForClass(SerialCounter);

// สร้าง compound index เพื่อความรวดเร็วในการค้นหาและป้องกันการซ้ำ
SerialCounterSchema.index(
  { prefix: 1, machine_number: 1, date: 1 },
  { unique: true },
);
