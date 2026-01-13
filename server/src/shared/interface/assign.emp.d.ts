// src/assign/interfaces/assign-employee.interface.ts

import { Document, Types } from 'mongoose';

// Properties ของ AssignEmployee
interface BaseAssignEmployee {
  user_id: Types.ObjectId;
  assign_order_id: Types.ObjectId;
  log_date: Date;
  status: 'active' | 'completed' | 'suspended';
}

// Interface สำหรับ Mongoose Document
export interface IAssignEmployeeDocument extends BaseAssignEmployee, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
