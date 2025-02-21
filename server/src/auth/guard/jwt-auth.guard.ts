import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Check for different error scenarios
    if (info) {
      // ตรวจสอบประเภทของข้อผิดพลาด
      if (info instanceof Error) {
        if (info.name === 'TokenExpiredError') {
          // กรณี token หมดอายุ
          throw new HttpException(
            {
              status: 'error',
              message: 'Token has expired',
              data: [],
            },
            HttpStatus.UNAUTHORIZED,
          );
        } else if (info.name === 'JsonWebTokenError') {
          // กรณี token ไม่ถูกต้อง (รูปแบบผิด, ลายเซ็นไม่ตรง)
          throw new HttpException(
            {
              status: 'error',
              message: 'Invalid token format',
              data: [],
            },
            HttpStatus.UNAUTHORIZED,
          );
        }
      } else if (typeof info === 'string' && info.includes('No auth token')) {
        // กรณีไม่มี token
        throw new HttpException(
          {
            status: 'error',
            message: 'Authentication token is missing',
            data: [],
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    // กรณีมีข้อผิดพลาดอื่นๆ หรือไม่มี user
    if (err || !user) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Unauthorized access',
          data: [],
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return user;
  }
}
