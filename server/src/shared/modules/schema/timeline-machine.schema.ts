import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'timeline_machine' })
export class TimelineMachine extends Document {
  @Prop({ default: null })
  machine_number: string; // changed from MC_No

  @Prop({ default: null })
  status: string;

  @Prop({ type: Date, default: null })
  datetime: Date; // changed from DATETIME
}

export const TimelineMachineSchema =
  SchemaFactory.createForClass(TimelineMachine);
