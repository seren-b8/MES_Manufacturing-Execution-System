import { Types } from 'mongoose';

// Updated interfaces
interface IEmployee {
  _id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
}

export interface IUser {
  _id: string;
  employee_id: string;
}

export interface IAssignEmployee {
  _id: string;
  user_id: IUser;
  status: string;
  assign_order_id: string;
}

export interface IEmployeeDetail {
  id: string;
  employee_id: string;
  name: string;
}

export interface PopulatedCavityData {
  cavity: number;
  runner: number;
  parts: {
    material_number: string;
    material_description: string;
    part_number: string;
    part_name: string;
    weight: number;
  }[];
}

// interfaces/machine.interface.ts

export interface PartData {
  _id: Types.ObjectId;
  material_number: string;
  part_number: string;
  part_name: string;
  weight: number;
}

export interface CavityData {
  _id: Types.ObjectId;
  cavity: number;
  runner: number;
  parts: PartData[];
}

export interface MaterialCavity {
  material_number: string;
  cavity_id: Types.ObjectId | CavityData;
}

export interface MachineInfo {
  _id: Types.ObjectId;
  machine_name: string;
  work_center: string;
  machine_number: string;
  line: string;
  status: string;
  counter: number;
  recorded_counter: number;
  is_counter_paused: boolean;
  pause_start_counter?: number;
  cycletime: number;
  tonnage: number;
  material_cavities: MaterialCavity[];
}

export interface ProductionOrder {
  _id: Types.ObjectId;
  order_id: string;
  material_number: string;
  material_description: string;
  target_quantity: number;
  plan_target_day: number;
  plan_cycle_time: number;
}

export interface AssignOrder {
  _id: Types.ObjectId;
  production_order_id: Types.ObjectId | ProductionOrder;
  machine_number: string;
  status: string;
  datetime_open_order: Date;
  current_summary?: {
    total_good_quantity: number;
    total_not_good_quantity: number;
    last_update: Date;
  };
}

export interface PopulatedMachineInfo
  extends Omit<MachineInfo, 'material_cavities'> {
  material_cavities: Array<{
    material_number: string;
    cavity_id: CavityData;
  }>;
}

// Define interfaces for type safety
export interface DailySummaryData {
  total_quantity: number;
  good_quantity: number;
  not_good_quantity: number;
  records_count: number;
}

export interface MachineDetailResponse {
  machine_info: {
    machine_name: string;
    work_center: string;
    machine_number: string;
    line: string;
    status: string;
    counter: number;
    available_counter: number;
    cavity_info: any; // Define proper type if needed
    is_counter_paused: boolean;
    cycle_time: number;
    tonnage: number;
  };
  orders_summary: {
    total_orders: number;
    completed_orders: number;
    pending_orders: number;
    waiting_assign_orders: number;
  };
  daily_production: DailySummaryData & {
    efficiency: number;
    period: {
      start: Date;
      end: Date;
    };
  };
  active_order: any; // Define proper type if needed
  active_employees: {
    count: number;
    details: any[]; // Define proper type if needed
  };
  latest_production: {
    start_time: Date;
    running_time: number;
    efficiency: number;
  } | null;
}

// Type definitions
interface MasterPart {
  _id: string;
  material_number: string;
  part_number: string;
  part_name: string;
  weight: number;
}

export interface MasterCavity {
  _id: string;
  cavity: number;
  runner: number;
  tonnage: number;
  parts: MasterPart[]; // Will be populated
}

export interface CavityData2 {
  cavity: number;
  runner: number;
  tonnage: number;
}

interface BaseMasterPart {
  material_number: string;
  part_number: string;
  part_name: string;
  weight: number;
}

// interface BaseMasterCavity {
//   cavity: number;
//   runner: number;
//   tonnage: number;
//   parts: Types.ObjectId[] | BaseMasterPart[];
// }

// // Extended interfaces for Mongoose documents
// interface MasterPart extends BaseMasterPart {
//   _id: Types.ObjectId;
// }

interface MasterCavity extends BaseMasterCavity {
  _id: Types.ObjectId;
}
export interface CavityAndPartResult {
  cavityData: CavityData2 | null;
  partData: any;
}
