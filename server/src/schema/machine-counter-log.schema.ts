import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'machine_counter_log',
  timestamps: true,
  versionKey: false,
})
export class MachineCounterLog extends Document {
  @Prop({
    type: String,
    required: true,
    index: true,
  })
  machine_number: string;

  @Prop({
    type: Number,
    required: true,
  })
  counter_value: number;

  @Prop({
    type: Number,
    required: true,
  })
  previous_value: number;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  is_reset_suspected: boolean;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  is_abnormal_change: boolean;

  @Prop({
    type: Number,
    required: true,
  })
  time_since_last_update_ms: number;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  forced_by_time_threshold: boolean;

  createdAt?: Date; // จาก timestamps: true
}

export const MachineCounterLogSchema =
  SchemaFactory.createForClass(MachineCounterLog);

// สร้าง compound index หลักสำหรับการค้นหา
MachineCounterLogSchema.index({ machine_number: 1, createdAt: -1 });

// สร้าง TTL index สำหรับลบข้อมูลเก่า (30 วัน)
MachineCounterLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);
