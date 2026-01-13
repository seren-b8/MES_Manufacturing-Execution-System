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
    enum: ['OK', 'NG'],
    default: 'OK',
  })
  type: string;

  @Prop({ required: true, default: 0 })
  sequence: number;
}

export const SerialCounterSchema = SchemaFactory.createForClass(SerialCounter);

SerialCounterSchema.index(
  {
    prefix: 1,
    machine_number: 1,
    material_number: 1,
    date: 1,
    shift: 1,
    type: 1,
  },
  {
    unique: true,
    name: 'unique_serial_counter_full', // ตั้งชื่อ index ให้ชัดเจน
  },
);

SerialCounterSchema.index(
  {
    date: 1,
    type: 1,
  },
  {
    name: 'date_type_index',
  },
);

SerialCounterSchema.index(
  {
    machine_number: 1,
    date: 1,
    type: 1,
  },
  {
    name: 'machine_date_type_index',
  },
);

SerialCounterSchema.index(
  {
    material_number: 1,
    date: 1,
    type: 1,
  },
  {
    name: 'material_date_type_index',
  },
);

SerialCounterSchema.index(
  {
    prefix: 1,
    type: 1,
  },
  {
    name: 'prefix_type_index',
  },
);

SerialCounterSchema.index(
  {
    machine_number: 1,
    type: 1,
    createdAt: -1,
  },
  {
    name: 'machine_type_recent_index',
  },
);
