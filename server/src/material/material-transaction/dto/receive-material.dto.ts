// receive-material.dto.ts
export class ReceiveMaterialDto {
  material_number: string;
  quantity: number;
  to_location_code: string;
  to_position_code?: string;
  lot_number?: string;
  reference_doc: string;
  user_id: string;
  transaction_date?: Date;
}
