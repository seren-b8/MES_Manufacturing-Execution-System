import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class ProductionComponent extends Document {
  @Prop({ default: null })
  Plant: string;

  @Prop({ default: null })
  BS_StartDate: string;

  @Prop({ default: null })
  BS_FinishDate: string;

  @Prop({ default: null })
  Order_ID: string;

  @Prop({ default: null })
  Mat_No: string;

  @Prop({ default: null })
  MatDesc: string;

  @Prop({ default: null })
  TargetQty: number;

  @Prop({ default: null })
  Unit: string;

  @Prop({ default: null })
  MRP_Controller: string;

  @Prop({ default: null })
  ProdSup: string;

  @Prop({ default: null })
  SequenceNo: string;

  @Prop({ default: null })
  Activity: string;

  @Prop({ default: null })
  BOMItem: string;

  @Prop({ default: null })
  Component: string;

  @Prop({ default: null })
  ComponentDesc: string;

  @Prop({ default: null })
  ReqQty: number;

  @Prop({ default: null })
  Unit_ReqQty: string;

  @Prop({ default: null })
  OptShortText: string;

  @Prop({ default: null })
  WorkCenter: string;
}

export const ProductionComponentSchema =
  SchemaFactory.createForClass(ProductionComponent);
