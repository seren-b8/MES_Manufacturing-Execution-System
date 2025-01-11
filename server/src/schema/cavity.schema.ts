import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class Cavity extends Document {
  @Prop({ default: null })
  Mat_No: string;

  @Prop({ default: null })
  Mat_Desc: string;

  @Prop({ default: null })
  part_no1: string;

  @Prop({ default: null })
  part_no2: string;

  @Prop({ default: null })
  part_name1: string;

  @Prop({ default: null })
  part_name2: string;

  @Prop({ default: null })
  color: string;

  @Prop({ default: null })
  cavity: number;

  @Prop({ default: null })
  weight: number;

  @Prop({ default: null })
  runner: number;

  @Prop({ default: null })
  ton: number;

  @Prop({ default: null })
  cycle_time: number;

  @Prop({ default: null })
  customer: string;
}

export const CavitySchema = SchemaFactory.createForClass(Cavity);
