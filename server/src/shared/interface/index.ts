// types/index.ts
import { Document, Types } from 'mongoose';

// export interface ResponseFormat<T> {
//   status: 'success' | 'error';
//   message: string;
//   data: T[];
// }

export interface ResponseFormat<T> {
  status: 'success' | 'error';

  message: string;

  data: T[];

  pagination?: {
    total: number;

    page: number;

    limit: number;

    totalPages: number;
  };
}

export interface IAssignEmployee extends Document {
  user_id: string;
  assign_order_id: Types.ObjectId;
  log_date: Date;
  status: string;
}

export interface IAssignOrder extends Document {
  order_id: string;
  sequence_no: string;
  activity: string;
  work_center: string;
  // ...other fields
}

export interface IMasterNotGood extends Document {
  case_english: string;
  case_thai: string;
  description: string;
}

export interface IProductionRecord extends Document {
  _id: Types.ObjectId; // เพิ่ม _id type ชัดเจน
  assign_employee_ids: IAssignEmployee[];
  assign_order_id: IAssignOrder;
  master_not_good_id?: IMasterNotGood;
  is_not_good: boolean;
  quantity: number;
  confirmation_status: string;
  is_synced_to_sap: boolean;
  sap_sync_timestamp?: Date;
}

export interface ISapProductionData {
  employee_id?: string;
  order_id: string;
  sequence_no: string;
  activity: string;
  quantity: number;
  is_not_good: boolean;
  case_ng?: string;
}
