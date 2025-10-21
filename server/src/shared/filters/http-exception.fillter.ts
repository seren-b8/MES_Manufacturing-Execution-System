// src/shared/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseFormat } from '../interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Extract message from different response formats
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || 'An error occurred';

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
    const errorResponse: ResponseFormat<null> = {
      status: 'error',
      message,
      data: [],
    };

    response.status(status).json(errorResponse);
  }
}
