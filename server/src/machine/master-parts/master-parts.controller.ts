// master-parts.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  UseGuards,
  HttpException,
  UseInterceptors,
  UploadedFile,
  FileTypeValidator,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { MasterPartsService } from './master-parts.service';
import { ResponseFormat } from 'src/shared/interface';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';
import {
  CreateMasterPartDto,
  UpdateMasterPartDto,
} from '../dto/master-parts.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CacheTTL } from '@nestjs/cache-manager';

@Controller('master-parts')
@UseGuards(JwtAuthGuard)
export class MasterPartsController {
  constructor(private readonly masterPartsService: MasterPartsService) {}

  @Get()
  @CacheTTL(3)
  async findAll(@Query() query: any): Promise<ResponseFormat<MasterPart>> {
    return this.masterPartsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResponseFormat<MasterPart>> {
    return this.masterPartsService.findOne(id);
  }

  @Get('material/:materialNumber')
  async findByMaterialNumber(
    @Param('materialNumber') materialNumber: string,
  ): Promise<ResponseFormat<MasterPart>> {
    return this.masterPartsService.findByMaterialNumber(materialNumber);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() createDto: CreateMasterPartDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ): Promise<ResponseFormat<MasterPart>> {
    if (file) {
      console.log('file', file);
    }
    return this.masterPartsService.create(createDto, file);
  }

  @Put()
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Body() updateDto: UpdateMasterPartDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ): Promise<ResponseFormat<MasterPart>> {
    return this.masterPartsService.update(updateDto, file);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseFormat<MasterPart>> {
    return this.masterPartsService.remove(id);
  }

  @Post('update-all-part-info')
  async updateAllPartInfo(): Promise<
    ResponseFormat<{
      totalCount: number;
      updatedCount: number;
      errors: Array<{ materialNumber: string; error: string }>;
    }>
  > {
    try {
      const result = await this.masterPartsService.updateAllPartNumberAndName();
      return {
        status: 'success',
        message: `อัพเดทสำเร็จ ${result.updatedCount} จาก ${result.totalCount} รายการ`,
        data: [result],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
