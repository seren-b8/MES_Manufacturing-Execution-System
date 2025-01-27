import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

  @Prop({ default: 'OFF', enum: ['ON', 'OFF', 'ALARM', 'SETUP'] })
  status: string; // changed from Status

  @Prop({ default: 0 })
  counter: number; // ค่าจาก PLC

  @Prop({ default: 0 })
  recorded_counter: number; // ค่าที่บันทึกไปแล้ว

  @Prop({ default: false })
  is_counter_paused: boolean;

  @Prop({ default: null })
  pause_start_counter: number; // เก็บค่า counter ตอนเริ่ม pause

  @Prop({
    type: [
      {
        material_number: String,
        cavity_id: { type: Types.ObjectId, ref: 'MasterCavity' },
      },
    ],
  })
  material_cavities: {
    material_number: string;
    cavity_id: Types.ObjectId;
  }[];

  @Prop({ default: 0 })
  sleep_count: number; // changed from SleepCount

  @Prop({ default: 0 })
  cycletime: number; // changed from CycleTime

  @Prop({ default: 0 })
  logtime_count: number; // changed from LogtimeCount

  @Prop({ default: 0 })
  logtime_status: number; // changed from LogtimeStatus

  @Prop()
  updated_at: Date;
}

export const MachineInfoSchema = SchemaFactory.createForClass(MachineInfo);
