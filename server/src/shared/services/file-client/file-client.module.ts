// file-client.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { FileClientService } from './file-client.service';

@Module({
  imports: [
    // นำเข้า HttpModule สำหรับทำ HTTP request ไปยัง microservice
    HttpModule.register({
      timeout: 30000, // timeout 30 วินาที
      maxRedirects: 5,
    }),
    // ตรวจสอบว่ามีการโหลด ConfigModule แล้วหรือไม่
    ConfigModule.forRoot({
      isGlobal: true, // ถ้ายังไม่มีการโหลด ConfigModule ให้โหลดเป็น global
    }),
  ],
  providers: [FileClientService],
  exports: [FileClientService], // export service เพื่อให้โมดูลอื่นสามารถนำไปใช้ได้
})
export class FileClientModule {}
