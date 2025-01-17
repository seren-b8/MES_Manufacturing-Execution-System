import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  collection: 'production_records',
  timestamps: true,
})
export class ProductionRecord extends Document {
  @Prop({
    required: true,
    index: true,
    ref: 'AssignEmployee',
    type: Types.ObjectId,
  })
  assign_employee_id: Types.ObjectId;

  @Prop({ required: true, index: true })
  is_not_good: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  quantity: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'MasterNotGood',
    required: function (this: ProductionRecord) {
      return this.is_not_good;
    },
  })
  master_not_good_id: Types.ObjectId;

  @Prop({ type: String })
  remark: string;
}

export const ProductionRecordSchema =
  SchemaFactory.createForClass(ProductionRecord);
