// transfer-material.dto.ts
export class TransferMaterialDto {
  material_number: string;
  quantity: number;
  from_location_code: string;
  from_position_code?: string;
  to_location_code: string;
  to_position_code?: string;
  lot_number?: string;
  reference_doc?: string;
  user_id: string;
  transaction_date?: Date;
}
