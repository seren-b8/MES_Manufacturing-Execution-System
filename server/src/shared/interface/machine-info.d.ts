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

export interface PopulatedMachineInfo
  extends Omit<MachineInfo, 'material_cavities'> {
  material_cavities: {
    material_number: string;
    cavity_id: PopulatedCavityData;
  }[];
}
