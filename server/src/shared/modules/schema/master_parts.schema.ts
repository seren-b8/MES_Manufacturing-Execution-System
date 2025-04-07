import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ collection: 'master_parts' })
export class MasterPart extends Document {
  @Prop()
  _id: mongoose.Types.ObjectId;

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

  @Prop()
  part_model: string;

  @Prop()
  image_url: string;
}

export const MasterPartSchema = SchemaFactory.createForClass(MasterPart);
