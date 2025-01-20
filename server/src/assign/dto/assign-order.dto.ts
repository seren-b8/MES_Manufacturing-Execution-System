// DTOs
export class CreateAssignOrderDto {
  production_order_id: string;
  machine_number: string;
}
export type OrderStatus = 'pending' | 'active' | 'completed' | 'suspended';
export interface UpdateAssignOrderDto {
  status?: OrderStatus;
  datetime_close_order?: Date;
  current_summary?: {
    total_good_quantity: number;
    total_not_good_quantity: number;
    last_update: Date;
  };
}

// Interface for AssignOrder
export interface AssignOrder {
  status: OrderStatus;
  datetime_close_order?: Date;
  current_summary?: {
    total_good_quantity: number;
    total_not_good_quantity: number;
    last_update: Date;
  };
}
