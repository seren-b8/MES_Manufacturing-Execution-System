import { Types } from 'mongoose';

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
  confirmed_by?: string;
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
