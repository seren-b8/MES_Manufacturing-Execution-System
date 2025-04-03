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
  PrintRequestDto,
  UpdateProductionRecordDto,
} from '../dto/production-reccord.dto';
import { ProductionRecordService } from './production-reccord.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Types } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GetUserId } from 'src/auth/decorator/get-current-user.decorator';
import { SapProductionSyncService } from '../sap-sync/sap-sync.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';

@Controller('production-records')
export class ProductionRecordController {
  constructor(
    private readonly productionRecordService: ProductionRecordService,
    private readonly sapSyncService: SapProductionSyncService,
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

  //!print-label
  @Post('print-label')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR) // Adjust roles as needed
  async printLabel(@Body() data: PrintRequestDto) {
    return this.productionRecordService.printLabel(data);
  }
  //!print-label

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
