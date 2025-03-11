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
import { Cron, CronExpression } from '@nestjs/schedule';
import { GetUserId } from 'src/auth/decorator/get-current-user.decorator';
import { SapProductionSyncService } from '../sap-sync/sap-sync.service';
import { MachineInfoService } from 'src/machine/machine-info/machine-info.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { DateRangeSummaryData } from 'src/shared/interface/product';

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
  machine_number?: string; // เพิ่มฟิลด์รับค่า machine_id
}

@Controller('production-records')
export class ProductionRecordController {
  private readonly PRINT_SERVICE_URL = 'http://172.101.21.52:5000/printtest';

  constructor(
    private readonly productionRecordService: ProductionRecordService,
    private readonly sapSyncService: SapProductionSyncService,
    private readonly machineInfoService: MachineInfoService, // เพิ่ม service ของ machine-info
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @GetUserId() userId: string,
    @Body() createDto: CreateProductionRecordDto,
  ) {
    return await this.productionRecordService.create(createDto, userId);
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
    const result = await this.productionRecordService.update(id, updateDto);

    // // Check if confirmation_status is 'confirmed'
    // if (updateDto.confirmation_status === 'confirmed') {
    //   // Call syncPendingRecords if confirmation_status is 'confirmed'
    //   await this.sapSyncService.syncPendingRecords();
    // }

    return result;
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
      let printerIp = '172.101.21.52'; // ค่าเริ่มต้น

      // ถ้ามีการระบุ machine_id
      if (data.machine_number) {
        // ดึงข้อมูลเครื่องพิมพ์ของเครื่องจักร
        const machineResponse = await this.machineInfoService.getMachinePrinter(
          data.machine_number,
        );

        // ตรวจสอบว่ามีข้อมูลเครื่องพิมพ์หรือไม่
        if (
          machineResponse.status === 'success' &&
          machineResponse.data.length > 0
        ) {
          const printer = machineResponse.data[0];

          // ถ้าเครื่องพิมพ์มีสถานะ active ให้ใช้ IP ของเครื่องพิมพ์นั้น
          if (printer.status === 'active') {
            printerIp = printer.ip_device;
          } else {
            // ถ้าเครื่องพิมพ์ไม่มีสถานะ active ให้ใช้ค่าเริ่มต้น
            console.warn(
              `Printer ${printer.device_name} is not active, using default printer`,
            );
          }
        } else {
          // ถ้าไม่พบเครื่องพิมพ์สำหรับเครื่องจักรนี้
          console.warn(
            `No printer found for machine ${data.machine_number}, using default printer`,
          );
        }
      }

      // สร้าง URL สำหรับการส่งคำขอพิมพ์
      const printServiceUrl = `http://${printerIp}:5000/printtest`;

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

      // ทำการส่งคำขอพิมพ์ไปยังเครื่องพิมพ์
      const response = await axios.post(printServiceUrl, printPayload);

      return {
        status: 'success',
        message: `Print request sent successfully to printer at ${printerIp}`,
        data: [
          {
            ...response.data,
            printer_ip: printerIp,
          },
        ],
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

  @Get('daily-summary')
  async getDailySummary(
    @Body('assign_order_id') assignOrderId: string,
    @Body('shift_type') shiftType: 'morning' | 'night' | 'all',
  ) {
    return await this.productionRecordService.findSummaryByOrderId(
      assignOrderId,
      shiftType,
    );
  }

  // รายงานสรุปการผลิตทั้งโรงงาน
  @Get('factory-summary')
  @Roles(Role.ADMIN)
  async getFactorySummary(
    @Query('shift_type') shiftType: 'morning' | 'night' | 'all' = 'all',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Promise<ResponseFormat<any>> {
    return this.productionRecordService.findSummaryAllMachines(
      shiftType,
      startDate,
      endDate,
    );
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async syncDailyRecords() {
    // console.log('Syncing daily records at', new Date());
    return this.productionRecordService.autoConfirmOldNGRecords();
  }
}
