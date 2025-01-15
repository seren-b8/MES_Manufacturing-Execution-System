import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'log_assign_not_good' }) // changed from log_assign_ng
export class LogAssignNotGood extends Document {
  // changed from LogAssignNG
  @Prop({ default: null })
  work_center: string;

  @Prop({ default: null })
  order_number: string; // changed from order_no

  @Prop({ default: null })
  order_id: string;

  @Prop({ default: null })
  case_number: string; // changed from case_no

  @Prop({ default: null })
  case_description: string; // changed from case_desc

  @Prop({ default: null })
  case_detail: string;

  @Prop({ default: null })
  not_good_quantity: number; // changed from ng_quantity

  @Prop({ default: null })
  log_date: string;
}

export const LogAssignNotGoodSchema =
  SchemaFactory.createForClass(LogAssignNotGood);
