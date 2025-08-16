// DTOs
export class CreatePlanningDto {
  machine_number: string;
  planned_date: Date;
  plan_type: 'sap_order' | 'draft_plan';
  production_order_id?: string;
  material_id?: string;
  total_order_quantity: number;
  planned_quantity?: number;
  sequence_order: number;
  estimated_hours?: number;
  man_power?: { day: number; night: number };
  remark?: string;
  planned_by?: string;
}

export class UpdatePlanningDto {
  planned_quantity?: number;
  sequence_order?: number;
  estimated_hours?: number;
  man_power?: { day: number; night: number };
  status?: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  remark?: string;
}

export class PlanningQueryDto {
  machine_number?: string;
  planned_date?: Date;
  plan_type?: 'sap_order' | 'draft_plan';
  status?: string;
}
