import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class User extends Document {
  @Prop({ default: null })
  EMP_ID: string;

  @Prop()
  Auth: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
