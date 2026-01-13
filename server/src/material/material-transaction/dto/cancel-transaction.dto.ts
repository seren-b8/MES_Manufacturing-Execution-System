// dto/cancel-transaction.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelTransactionDto {
  @IsNotEmpty()
  @IsString()
  transaction_id: string;

  @IsNotEmpty()
  @IsString()
  cancellation_reason: string;

  @IsNotEmpty()
  @IsString()
  user_id: string;
}
