// transaction-response.dto.ts
export class TransactionResponseDto {
  _id: string;
  transaction_type: string;
  material_number: string;
  material_description: string;
  quantity: number;
  from_location?: string;
  to_location?: string;
  reference_doc?: string;
  user_id: string;
  transaction_date: Date;
  createdAt: Date;
}
