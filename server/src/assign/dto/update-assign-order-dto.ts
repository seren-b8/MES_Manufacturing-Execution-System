export class UpdateAssignOrderDto {
  status?: 'pending' | 'active' | 'completed' | 'suspended';
  actual_quantity?: number;
  scrap_quantity?: number;
  production_parameters?: {
    weight?: string;
    runner?: string;
    cycle_time?: string;
    setup_time?: string;
    condition_amount?: number;
  };
  supervisor_id?: string;
}
