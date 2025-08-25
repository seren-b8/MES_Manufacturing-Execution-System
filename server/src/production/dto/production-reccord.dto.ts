import { Types } from 'mongoose';
import { string } from 'yargs';

export class CreateProductionRecordDto {
  assign_order_id: string;
  is_not_good: boolean;
  quantity: number;
  master_not_good_id?: string;
  remark?: string;
}

export class UpdateProductionRecordDto {
  quantity?: number;
  master_not_good_id?: string;
  remark?: string;
  confirmation_status?: 'confirmed' | 'rejected';
  confirmed_by?: Types.ObjectId;
  confirmed_at?: Date; // เพิ่มฟิลด์นี้
  rejection_reason?: string;
}

// Interfaces
interface AssignEmployee {
  _id: Types.ObjectId;
  status: string;
}

interface MasterNotGood {
  _id: Types.ObjectId;
}

export interface labelData {
  color: string;
  date: string;
  part_model: string;
  part_name: string;
  part_code: string;
  mat: string;
  image_url: string;
}

export class PrintRequestDto {
  tag_no?: number; //split จาก serial_number
  customerName?: string;
  jobOrder?: string;
  mat?: string;
  partCode?: string;
  matNo?: string;
  quantityStd?: number;
  producer?: string;
  serial_number?: string;
  machine_number?: string; //ใช้สำหรับดึงข้อมูลเครื่องพิมพ์
  number_of_tags?: number;
}

export class PrintDto {
  tag_no?: number; //split จาก serial_number
  order_id?: string; //มี jobOrder
  sap_no?: string; //มี matNo
  customer_name?: string; //มี customerName
  model?: string;
  supplier?: string; //fixed 'Serenity
  part_code?: string; //มี partCode
  part_name?: string;
  mat?: string; //มี mat
  color?: string;
  producer?: string; //มี producer
  date?: string;
  image_url?: string;
  quantity?: number; //มี quantityStd
  number_of_tags?: number; //มี number_of_tags
  code?: string; //มี serial_number
}

//sale_item_id, sale_round_id, inventery_id, material_no, description, created_at, quantity, cart_number, purchase_order, sale_date, serial_code_mes
export class SalePrintDto {
  material_no?: string;
  quantity?: number;
  device_name: string;
  serial_code_mes?: string;
  tag_no?: number;
  number_of_tags?: number;
}
