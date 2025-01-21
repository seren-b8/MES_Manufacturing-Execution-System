import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'master_not_good' }) // changed from master_ng
export class MasterNotGood extends Document {
  // changed from MasterNG
  @Prop({ default: null })
  case_english: string; // changed from CASE_EN

  @Prop({ default: null })
  case_thai: string; // changed from CASE_TH

  @Prop({ default: null })
  description: string; // changed from DESCRIPTION
}

export const MasterNotGoodSchema = SchemaFactory.createForClass(MasterNotGood);
