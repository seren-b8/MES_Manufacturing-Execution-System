import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ExcelService } from './excel.service';
import * as fs from 'fs';
import { CustomThrottlerGuard } from 'src/auth/guard/custom-throttler.guard';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Role } from 'src/auth/enum/roles.enum';
import { Roles } from 'src/auth/decorator/roles.decorator';

@Controller('excel')
@UseGuards(JwtAuthGuard, CustomThrottlerGuard)
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  @Post('upload')
  @Roles(Role.ADMIN)
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
