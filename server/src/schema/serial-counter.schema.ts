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

  // เพิ่ม material_number เพื่อรองรับการแยกลำดับตาม part
  @Prop({ required: false, index: true, default: 'default' })
  material_number: string;

  @Prop({ required: true, index: true })
  date: string;

  @Prop({
    required: true,
    enum: ['day', 'night'],
    default: 'day',
  })
  shift: string;

  @Prop({
    required: true,
    eum: ['OK', 'NG'],
    default: 'OK',
  })
  type: string;

  @Prop({ required: true, default: 0 })
  sequence: number;
}

export const SerialCounterSchema = SchemaFactory.createForClass(SerialCounter);

// ปรับปรุง compound index ให้รวม material_number
SerialCounterSchema.index(
  { prefix: 1, machine_number: 1, material_number: 1, date: 1 },
  { unique: true },
);

// Index สำหรับการค้นหาตามวันที่
SerialCounterSchema.index({ date: 1 });

// Index สำหรับการค้นหาตามเครื่องจักรและวันที่
SerialCounterSchema.index({ machine_number: 1, date: 1 });

// Index สำหรับการค้นหาตาม material และวันที่
SerialCounterSchema.index({ material_number: 1, date: 1 });
