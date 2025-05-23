import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ExcelService } from './excel.service';
import * as fs from 'fs';

@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
    }),
  )
  async uploadExcel(@UploadedFile() file: Express.Multer.File) {
    try {
      const data = this.excelService.readExcelFile(file.path);

      fs.unlinkSync(file.path);

      return {
        message: 'Upload successful',
        count: data.length,
        data: data,
      };
    } catch (error) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return {
        message: 'Upload failed',
        error: (error as Error).message,
      };
    }
  }
}
