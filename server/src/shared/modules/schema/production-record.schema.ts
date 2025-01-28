import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  collection: 'production_records',
  timestamps: true,
  versionKey: false,
})
export class ProductionRecord extends Document {
  @Prop({
    required: true,
    index: true,
    ref: 'AssignEmployee',
    type: [Types.ObjectId],
  })
  assign_employee_ids: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'AssignOrder', required: true })
  assign_order_id: Types.ObjectId; // เพิ่มฟิลด์นี้

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

  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  serial_code: string;

  // สถานะการ confirm
  @Prop({
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending',
  })
  confirmation_status: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  confirmed_by: Types.ObjectId;

  @Prop()
  confirmed_at: Date;

  @Prop()
  rejection_reason: string;

  // สถานะการส่ง SAP
  @Prop({ type: Boolean, default: false })
  is_synced_to_sap: boolean;

  @Prop({ type: Date })
  sap_sync_timestamp: Date;
}

export const ProductionRecordSchema =
  SchemaFactory.createForClass(ProductionRecord);

ProductionRecordSchema.index({ assign_order_id: 1, is_synced_to_sap: 1 });
ProductionRecordSchema.index({ assign_employee_ids: 1, created_at: -1 });
ProductionRecordSchema.index({ serial_code: 1 });
ProductionRecordSchema.index({
  serial_code: 1,
  created_at: -1,
});
