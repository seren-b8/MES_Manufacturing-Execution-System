// src/shared/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseFormat } from '../interface'; // ตรวจสอบ path ให้ถูกต้อง

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status: number;
    let message: string;
    let data: any[] = []; // 1. สร้างตัวแปร data รอไว้ (Default เป็น [])

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Extract message and data from different response formats
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resObj = exceptionResponse as any;

        message = resObj.message || 'An error occurred';

        // 2. เช็คว่าใน Exception มีการส่ง property 'data' มาด้วยหรือไม่
        if (resObj.data) {
          data = resObj.data;
        }
        // (Optional) เสริม: ถ้ามีการส่ง property 'errors' มา (เช่นจาก SAP โดยตรง) ให้ยัดใส่ data ให้เลย
        else if (resObj.errors) {
          data = [resObj.errors];
        }

        // Handle array of messages (from class-validator)
        if (Array.isArray(message)) {
          message = message.join(', ');
        }
      } else {
        message = 'An error occurred';
      }
    } else {
      // Unknown errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';

      // Log unexpected errors for debugging
      console.error('Unexpected error:', exception);
    }

    // Standard error response format
    const errorResponse: ResponseFormat<any> = {
      status: 'error',
      message,
      data: data, // 3. ใช้ค่า data ที่ดึงมาได้ (ถ้าไม่มีจะเป็น [])
    };

    response.status(status).json(errorResponse);
  }
}
