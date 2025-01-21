import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({
  collection: 'sap_sync_logs',
  timestamps: true,
})
export class SAPSyncLog {
  @Prop({ type: [{ type: Types.ObjectId }], required: true })
  production_record_ids: Types.ObjectId[]; // เปลี่ยนเป็น array

  @Prop({ required: true })
  employee_id: string; // รวมถึง 'SNC'

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  sync_type: 'EMP' | 'SNC';

  @Prop({
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop()
  error_message?: string;

  @Prop({ type: Date })
  sync_timestamp?: Date;
}
