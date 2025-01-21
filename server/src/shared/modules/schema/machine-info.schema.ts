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
  counter: number; // changed from Counter

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
