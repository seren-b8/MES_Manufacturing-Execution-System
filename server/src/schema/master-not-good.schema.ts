import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'master_not_good' }) // changed from master_ng
export class MasterNotGood extends Document {
  // changed from MasterNG
  @Prop({ default: null })
  case_number: string; // changed from CASE_NO

  @Prop({ default: null })
  case_english: string; // changed from CASE_EN

  @Prop({ default: null })
  case_thai: string; // changed from CASE_TH
}

export const MasterNotGoodSchema = SchemaFactory.createForClass(MasterNotGood);
