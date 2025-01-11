import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class MasterNG extends Document {
  @Prop({ default: null })
  CASE_NO: string;

  @Prop({ default: null })
  CASE_EN: string;

  @Prop({ default: null })
  CASE_TH: string;
}

export const MasterNGSchema = SchemaFactory.createForClass(MasterNG);
