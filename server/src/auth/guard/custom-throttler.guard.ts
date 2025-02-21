import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import {
  Injectable,
  HttpException,
  HttpStatus,
  ExecutionContext,
} from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        status: 'error',
        message: 'จำนวนคำขอมากเกินไป กรุณาลองใหม่ภายหลัง',
        data: [],
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
