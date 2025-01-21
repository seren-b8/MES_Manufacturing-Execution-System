import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'master_cavity' })
export class MasterCavity extends Document {
  @Prop({ default: null })
  material_number: string; // changed from Mat_No

  @Prop({ default: null })
  material_description: string; // changed from Mat_Desc

  @Prop({ default: null })
  part_number_1: string; // changed from part_no1

  @Prop({ default: null })
  part_number_2: string; // changed from part_no2

  @Prop({ default: null })
  part_name_1: string; // changed from part_name1

  @Prop({ default: null })
  part_name_2: string; // changed from part_name2

  @Prop({ default: null })
  color: string;

  @Prop({ default: null })
  cavity: number;

  @Prop({ default: null })
  weight: number;

  @Prop({ default: null })
  runner: number;

  @Prop({ default: null })
  tonnage: number; // changed from ton

  @Prop({ default: null })
  cycle_time: number;

  @Prop({ default: null })
  customer: string;
}

export const MasterCavitySchema = SchemaFactory.createForClass(MasterCavity);
