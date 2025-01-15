export class CreateAssignOrderDto {
  order_id: string;
  machine_number: string;
  work_center: string;
  target_quantity: number;
  plan_cycle_time: number;
  cavity: string;
  material_number: string;
  line: string;
  shift?: string;
}
