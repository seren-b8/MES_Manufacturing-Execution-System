import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MasterPart } from './master_parts.schema';

@Schema({ collection: 'master_cavity' })
export class MasterCavity extends Document {
  @Prop({
    type: [{ type: Types.ObjectId, ref: MasterPart.name }],
    required: true,
  })
  parts: Types.ObjectId[];

  @Prop({ required: true })
  cavity: number;

  @Prop()
  runner: number;

  @Prop()
  tonnage: number;

  @Prop()
  cycle_time: number; // เก็บไว้เพื่อ backward compatibility

  @Prop()
  target_cycle_time: number;

  @Prop()
  customer: string;

  @Prop()
  color: string;

  @Prop()
  mat: string;
}

export const MasterCavitySchema = SchemaFactory.createForClass(MasterCavity);
