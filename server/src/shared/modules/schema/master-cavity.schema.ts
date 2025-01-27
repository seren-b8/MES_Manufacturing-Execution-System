import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'master_cavity' })
export class MasterCavity extends Document {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'MasterPart' }], required: true })
  parts: Types.ObjectId[];

  @Prop({ required: true })
  cavity: number;

  @Prop()
  runner: number;

  @Prop()
  tonnage: number;

  @Prop()
  cycle_time: number;

  @Prop()
  customer: string;

  @Prop()
  color: string;
}

export const MasterCavitySchema = SchemaFactory.createForClass(MasterCavity);
