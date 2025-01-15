import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'machine_info' })
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

  @Prop({ default: null })
  status: string; // changed from Status

  @Prop({ default: null })
  counter: number; // changed from Counter

  @Prop({ default: null })
  sleep_count: number; // changed from SleepCount

  @Prop({ default: null })
  cycletime: string;

  @Prop({ default: null })
  logtime_count: string; // changed from LogtimeCount

  @Prop({ default: null })
  logtime_status: string; // changed from LogtimeStatus
}

export const MachineInfoSchema = SchemaFactory.createForClass(MachineInfo);
