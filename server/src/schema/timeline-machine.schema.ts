import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class TimelineMachine extends Document {
  @Prop({ default: null })
  MC_No: string;

  @Prop({ default: null })
  Status: string;

  @Prop({ type: Date, default: null })
  DATETIME: Date;
}

export const TimelineMachineSchema =
  SchemaFactory.createForClass(TimelineMachine);
