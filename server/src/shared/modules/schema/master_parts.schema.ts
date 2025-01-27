import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'master_parts' })
export class MasterPart extends Document {
  @Prop({ required: true, unique: true })
  material_number: string;

  @Prop()
  material_description: string;

  @Prop()
  part_number: string;

  @Prop()
  part_name: string;

  @Prop()
  weight: number;
}

export const MasterPartSchema = SchemaFactory.createForClass(MasterPart);
