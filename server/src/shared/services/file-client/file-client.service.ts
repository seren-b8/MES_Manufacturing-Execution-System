// file-client.service.ts - สำหรับเชื่อมต่อกับ file microservice
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class FileClientService {
  private readonly baseUrl: string;
  private readonly authToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // อ่านค่า configuration จาก .env หรือ config service
    this.baseUrl = this.configService.get<string>('FILE_SERVICE_URL');
    this.authToken = this.configService.get<string>('FILE_SERVICE_TOKEN');
  }

  /**
   * สร้าง HTTP headers พร้อม token authentication
   */
  private getHeaders(isFormData = false): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.authToken}`,
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  /**
   * อัพโหลดไฟล์เดียว
   * @param file ไฟล์ที่ต้องการอัพโหลด
   * @param path พาธที่ต้องการเก็บไฟล์
   * @param newFilename ชื่อไฟล์ใหม่ (ถ้าไม่ระบุจะใช้ชื่อเดิม)
   * @returns ข้อมูลไฟล์ที่อัพโหลด
   */
  async uploadFile(
    file: Express.Multer.File,
    path: string,
    newFilename?: string,
  ): Promise<any> {
    try {
      const formData = new FormData();

      // กำหนดชื่อไฟล์ใหม่ถ้ามีการระบุ
      const filename = newFilename || file.originalname;

      formData.append('file', file.buffer, {
        filename: filename,
        contentType: file.mimetype,
      });
      formData.append('path', path);

      // เพิ่มชื่อไฟล์ใหม่เข้าไปใน form data (ถ้า microservice รองรับ)
      if (newFilename) {
        formData.append('filename', newFilename);
      }

      const config: AxiosRequestConfig = {
        headers: {
          ...this.getHeaders(true),
          ...formData.getHeaders(),
        },
      };

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}/file-management/upload/one`,
          formData,
          config,
        ),
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
  /**
   * จัดการ error จากการเรียก API
   */
  private handleError(error: any): never {
    if (error.response) {
      // มี response จาก server แต่เป็น error status code
      const statusCode =
        error.response.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorData = error.response.data || {
        message: 'Unknown error occurred',
      };

      throw new HttpException(
        errorData.message || 'File service error',
        statusCode,
      );
    } else if (error.request) {
      // ไม่ได้รับ response จาก server
      throw new HttpException(
        'File service is not responding',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } else {
      // เกิด error ก่อนทำ request
      throw new HttpException(
        `Error setting up request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
