import { Types } from 'mongoose';

export class CreateProductionRecordDto {
  assign_employee_id: string;
  is_not_good: boolean;
  quantity: number;
  master_not_good_id?: string;
  remark?: string;
}

export class UpdateProductionRecordDto {
  quantity?: number;
  master_not_good_id?: string;
  remark?: string;
}

// Interfaces
interface AssignEmployee {
  _id: Types.ObjectId;
  status: string;
}

interface MasterNotGood {
  _id: Types.ObjectId;
}
