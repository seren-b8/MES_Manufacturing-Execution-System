// DTOs
export class CreateAssignOrderDto {
  production_order_id: string;
  machine_number: string;
}

export class UpdateAssignOrderDto {
  status?: 'pending' | 'active' | 'completed' | 'suspended';
  datetime_close_order?: Date;
  current_summary?: {
    total_good_quantity: number;
    total_not_good_quantity: number;
    last_update: Date;
  };
}

// Interface for AssignOrder
interface AssignOrder {
  production_order_id: string;
  machine_number: string;
  status: 'pending' | 'active' | 'completed' | 'suspended';
  datetime_open_order: Date;
  datetime_close_order?: Date;
  current_summary: {
    total_good_quantity: number;
    total_not_good_quantity: number;
    last_update: Date;
  };
}
