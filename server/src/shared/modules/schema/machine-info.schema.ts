import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: false, collection: 'machine_info' })
export class MachineInfo extends Document {
  @Prop({ default: null })
  line: string; // changed from Line

  @Prop({ default: null })
  machine_number: string; // changed from MC_No

  @Prop({ default: null })
  machine_name: string; // changed from MC_Name

  @Prop({ default: null })
  tonnage: number; // changed from Ton

  @Prop({ default: null })
  work_center: string; // changed from Workcenter

  @Prop({ default: 'OFF' })
  status: string; // changed from Status

  @Prop({ default: 0 })
  counter: number; // ค่าจาก PLC

  @Prop({ default: 0 })
  recorded_counter: number; // ค่าที่บันทึกไปแล้ว

  @Prop({ default: 0 })
  available_counter: number; // ค่าที่สามารถบันทึกได้ (counter - recorded_counter)

  @Prop({ default: false })
  is_counter_paused: boolean;

  @Prop({ default: null })
  pause_start_counter: number; // เก็บค่า counter ตอนเริ่ม pause

  @Prop({ default: 0 })
  sleep_count: number; // changed from SleepCount

  @Prop({ default: 0 })
  cycletime: string;

  @Prop({ default: 0 })
  logtime_count: string; // changed from LogtimeCount

  @Prop({ default: 0 })
  logtime_status: string; // changed from LogtimeStatus

  @Prop({ default: null })
  updated_at: Date;
}

export const MachineInfoSchema = SchemaFactory.createForClass(MachineInfo);
