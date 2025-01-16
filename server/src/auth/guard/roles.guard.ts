// guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enum/roles.enum';
import { ROLES_KEY } from '../decorator/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // ตรวจสอบว่ามี user และ role หรือไม่
    if (!user || !user.role) {
      throw new ForbiddenException({
        status: 'error',
        message: 'ไม่พบข้อมูลสิทธิ์การใช้งานของผู้ใช้',
        data: [],
      });
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    if (!hasRole) {
      throw new ForbiddenException({
        status: 'error',
        message: `ไม่มีสิทธิ์เข้าถึง - ต้องการสิทธิ์: ${requiredRoles.join(', ')}`,
        data: [],
      });
    }

    return true;
  }
}
