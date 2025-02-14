// src/auth/decorators/get-current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// ดึงเฉพาะ sub (user id)
export const GetUserId = createParamDecorator(
  (data: undefined, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.sub;
  },
);

// ดึงข้อมูล user ทั้งหมด หรือเฉพาะ field ที่ต้องการ
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data) {
      return request.user[data];
    }
    return request.user;
  },
);
