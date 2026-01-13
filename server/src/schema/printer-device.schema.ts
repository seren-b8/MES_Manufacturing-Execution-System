// src/printer/schemas/printer-device.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'printer_devices',
  timestamps: true,
  versionKey: false,
})
export class PrinterDevice extends Document {
  @Prop({
    type: String,
    required: true,
  })
  device_name: string; // ชื่ออุปกรณ์ปริ้น

  @Prop({
    type: String,
    required: true,
  })
  ip_device: string; // IP address ของเครื่องปริ้น

  @Prop({ type: Boolean, default: false })
  is_socket: boolean; // false = usb_relay, true = socket

  @Prop({
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active',
  })
  status: string; // สถานะเครื่องปริ้น

  @Prop({
    type: String,
    enum: ['label', 'document', 'receipt', 'other'],
    default: 'label',
  })
  printer_type: string; // ประเภทเครื่องปริ้น

  @Prop({
    type: Object,
    default: {},
  })
  settings: Record<string, any>; // การตั้งค่าเพิ่มเติม

  @Prop({
    type: String,
  })
  location: string; // ตำแหน่งที่ตั้งเครื่องปริ้น

  @Prop({
    type: String,
  })
  description: string; // คำอธิบายเพิ่มเติม
}

export const PrinterDeviceSchema = SchemaFactory.createForClass(PrinterDevice);

// สร้าง index
PrinterDeviceSchema.index({ device_name: 1 }, { unique: true });
PrinterDeviceSchema.index({ status: 1 });
PrinterDeviceSchema.index({ printer_type: 1 });
