export interface MachineInfo {
  work_center: string;
  machine_number: string;
  status: string;
  counter: number;
  cycle_time: number;
}

export interface ProductionOrder {
  _id: Types.ObjectId;
  order_id: string;
  material_number: string;
  material_description: string;
  target_quantity: number;
  work_center: string;
  basic_start_date: Date;
  basic_finish_date: Date;
  assign_stage: boolean;
}

export interface AssignOrder {
  _id: Types.ObjectId;
  production_order_id: Types.ObjectId | ProductionOrder;
  machine_number: string;
  status: string;
  datetime_open_order: Date;
  current_summary: {
    total_good_quantity: number;
    total_not_good_quantity: number;
    last_update: Date;
  };
}
