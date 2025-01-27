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
} from '@nestjs/common';
import { MasterPartsService } from './master-parts.service';
import { ResponseFormat } from 'src/shared/interface';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';
import {
  CreateMasterPartDto,
  UpdateMasterPartDto,
} from '../dto/master-parts.dto';

@Controller('master-parts')
@UseGuards(JwtAuthGuard)
export class MasterPartsController {
  constructor(private readonly masterPartsService: MasterPartsService) {}

  @Get()
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
  async create(
    @Body() createDto: CreateMasterPartDto,
  ): Promise<ResponseFormat<MasterPart>> {
    return this.masterPartsService.create(createDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMasterPartDto,
  ): Promise<ResponseFormat<MasterPart>> {
    return this.masterPartsService.update(id, updateDto);
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
