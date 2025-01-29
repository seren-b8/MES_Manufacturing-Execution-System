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

// export interface PopulatedMachineInfo
//   extends Omit<MachineInfo, 'material_cavities'> {
//   material_cavities: {
//     material_number: string;
//     cavity_id: PopulatedCavityData;
//   }[];
// }

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
