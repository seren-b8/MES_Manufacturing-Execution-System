import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import {
  Injectable,
  HttpException,
  HttpStatus,
  ExecutionContext,
} from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  // เพิ่ม async และ Promise<string>
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.employee_id || `anonymous-${req.ip}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const userInfo = request.user?.employee_id || 'Anonymous';

    // Log เพื่อ debug
    console.log(`Rate limit exceeded for user: ${userInfo}, IP: ${request.ip}`);

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
