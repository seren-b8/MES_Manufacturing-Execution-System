import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({
  collection: 'sap_sync_logs',
  timestamps: true,
})
export class SAPSyncLog {
  @Prop({ type: Types.ObjectId, ref: 'ProductionRecord', required: true })
  production_record_id: Types.ObjectId;

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
