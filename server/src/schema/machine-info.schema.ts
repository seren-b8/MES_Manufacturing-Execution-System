import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class MachineInfo extends Document {
  @Prop({ default: null })
  Line: string;

  @Prop({ default: null })
  MC_No: string;

  @Prop({ default: null })
  MC_Name: string;

  @Prop({ default: null })
  Ton: number;

  @Prop({ default: null })
  Workcenter: string;

  @Prop({ default: null })
  Status: string;

  @Prop({ default: null })
  Counter: number;

  @Prop({ default: null })
  SleepCount: number;

  @Prop({ default: null })
  LogtimeCount: string;

  @Prop({ default: null })
  LogtimeStatus: string;
}

export const MachineInfoSchema = SchemaFactory.createForClass(MachineInfo);
