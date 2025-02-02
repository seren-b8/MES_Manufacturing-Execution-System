import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
  Delete,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  CreateProductionRecordDto,
  UpdateProductionRecordDto,
} from '../dto/production-reccord.dto';
import { ProductionRecordService } from './production-reccord.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Types } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import axios from 'axios';

interface PrintRequestDto {
  customerName?: string;
  model?: string;
  jobOrder?: string;
  partCode?: string;
  mat?: string;
  color?: string;
  partName?: string;
  matNo?: string;
  quantityStd?: number;
  producer?: string;
  serial_number?: string;
}

@Controller('production-records')
export class ProductionRecordController {
  private readonly PRINT_SERVICE_URL = 'http://172.101.21.52:5000/printtest';

  constructor(
    private readonly productionRecordService: ProductionRecordService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createDto: CreateProductionRecordDto) {
    return await this.productionRecordService.create(createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('is_not_good') isNotGood?: boolean,
    @Query('confirmation_status') confirmationStatus?: string,
    @Query('is_synced_to_sap') isSyncedToSap?: boolean,
    @Query('assign_order_id') assignOrderId?: string,
    @Query('serial_code') serialCode?: string,
  ) {
    const query: any = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (assignOrderId) {
      if (!Types.ObjectId.isValid(assignOrderId)) {
        throw new BadRequestException('Invalid assign_order_id format');
      }
      query.assign_order_id = new Types.ObjectId(assignOrderId);
    }

    if (isNotGood !== undefined) {
      query.is_not_good = isNotGood;
    }

    if (confirmationStatus) {
      query.confirmation_status = confirmationStatus;
    }

    if (isSyncedToSap !== undefined) {
      query.is_synced_to_sap = isSyncedToSap;
    }

    if (serialCode !== undefined) {
      query.serial_code = serialCode;
    }

    return await this.productionRecordService.findAll(query, page, limit);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductionRecordDto,
  ) {
    return await this.productionRecordService.update(id, updateDto);
  }

  @Get('daily')
  @UseGuards(JwtAuthGuard)
  async getdaily() {
    const date = new Date();
    return await this.productionRecordService.getDailySummary(date);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    return await this.productionRecordService.delete(id);
  }

  @Post('confirm-by-serial')
  async confirmBySerial(
    @Body('serial_code') serialCode: string,
    @Body('employee_id') employeeId: string,
  ) {
    return await this.productionRecordService.confirmBySerial(
      serialCode,
      employeeId,
    );
  }

  @Post('print-label')
  async printLabel(
    @Body() data: PrintRequestDto,
  ): Promise<ResponseFormat<any>> {
    try {
      const printPayload = {
        form_data: {
          customerName: data?.customerName ?? '-',
          model: data?.model ?? '-',
          supplier: 'Serenity',
          jobOrder: data?.jobOrder ?? '-',
          partCode: data?.partCode ?? '-',
          mat: data?.mat ?? '-',
          color: data?.color ?? '-',
          partName: data?.partName ?? '-',
          matNo: data?.matNo,
          quantityStd: data?.quantityStd,
          producer: data?.producer,
          date: new Date().toISOString().split('T')[0],
        },
        serial_number: data?.serial_number,
        state: '1',
      };

      const response = await axios.post(this.PRINT_SERVICE_URL, printPayload);

      return {
        status: 'success',
        message: 'Print request sent successfully',
        data: [response.data],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message || 'Failed to send print request',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
