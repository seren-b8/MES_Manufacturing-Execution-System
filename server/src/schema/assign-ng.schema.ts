import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class AssignNG extends Document {
  @Prop({ default: null })
  CASE_NO: string;

  @Prop({ default: null })
  CASE_Desc: string;

  @Prop({ default: null })
  CASE_Detail: string;

  @Prop({ default: null })
  NG: number;

  @Prop({ default: null })
  WorkCenter: string;

  @Prop({ default: null })
  Order_ID: string;

  @Prop({ default: null })
  _idOrder: string;

  @Prop({ default: null })
  Logdate: string;
}

export const AssignNGSchema = SchemaFactory.createForClass(AssignNG);
