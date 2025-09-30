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
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import {
  CreateProductionRecordDto,
  PrintRequestDto,
  SalePrintDto,
  UpdateProductionRecordDto,
} from '../dto/production-reccord.dto';
import { ProductionRecordService } from './production-reccord.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Types } from 'mongoose';
import {
  ProductionDailySummary,
  ProductionStageOverview,
  ProductionStageSummary,
  ResponseFormat,
} from 'src/shared/interface';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GetUserId } from 'src/auth/decorator/get-current-user.decorator';
import { SapProductionSyncService } from '../sap-sync/sap-sync.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { CustomThrottlerGuard } from 'src/auth/guard/custom-throttler.guard';
import { machine } from 'os';
import { CacheTTL } from '@nestjs/cache-manager';
import { MicroCacheInterceptor } from 'src/machine/interceptors/simple-cache.interceptor';
import { TimeoutInterceptor } from 'src/machine/interceptors/timeout.interceptor';
import { ProductionRecordQueryDto } from '../dto/production-reccord-query.dto';

@Controller('production-records')
export class ProductionRecordController {
  constructor(
    private readonly productionRecordService: ProductionRecordService,
    private readonly sapSyncService: SapProductionSyncService,
  ) {}

  @Get('find-by-serial/:serial_code')
  // @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  async findBySerial(@Param('serial_code') serialCode: string) {
    return await this.productionRecordService.findBySerial(serialCode);
  }

  @Get('daily')
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  async getdaily() {
    const date = new Date();
    return await this.productionRecordService.getDailySummary(date);
  }

  @Get('summary/by-stage')
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getSummaryByStage(): Promise<ResponseFormat<ProductionStageSummary>> {
    return this.productionRecordService.findSummaryByStage();
  }

  @Get('summary/stage-overview')
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getStageOverview(): Promise<ResponseFormat<ProductionStageOverview>> {
    return this.productionRecordService.getStageOverview();
  }

  // Controller
  @Post('create-batch')
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  async createBatch(
    @Body()
    createData: {
      create_production_record: CreateProductionRecordDto[];
      machine_number?: string;
    },
    @GetUserId() userId: string,
  ): Promise<ResponseFormat<ProductionRecord>> {
    if (
      !createData.create_production_record ||
      createData.create_production_record.length === 0 ||
      createData.create_production_record.length > 2
    ) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Array must contain 1-2 production records only',
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.productionRecordService.createReccordBatch(
      createData.create_production_record,
      userId,
      createData.machine_number,
    );
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
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR) // Adjust roles as needed
  async printLabel(@Body() data: PrintRequestDto) {
    return this.productionRecordService.printLabel(data);
  }

  @Post('sale-print')
  async salePrint(@Body() data: SalePrintDto[]) {
    return this.productionRecordService.printSaleLabel(data);
  }
  //!print-label

  @Get('daily-summary')
  @UseGuards(JwtAuthGuard)
  async getDailySummary(
    @Body('assign_order_id') assignOrderId: string,
    @Body('shift_type') shiftType: 'morning' | 'night' | 'all',
  ) {
    return await this.productionRecordService.findSummaryByOrderId(
      assignOrderId,
      shiftType,
    );
  }

  @Get('factory-summary')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard)
  async getFactorySummary(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Promise<ResponseFormat<ProductionDailySummary>> {
    return this.productionRecordService.findSummaryAllMachines(
      startDate,
      endDate,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductionRecordDto,
  ) {
    const result = await this.productionRecordService.update(id, updateDto);

    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    return await this.productionRecordService.delete(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @GetUserId() userId: string,
    @Body() createDto: CreateProductionRecordDto,
  ) {
    return await this.productionRecordService.create(createDto, userId);
  }

  @Get()
  async findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        whitelist: true,
      }),
    )
    query: ProductionRecordQueryDto,
  ) {
    console.log(query);
    return this.productionRecordService.findAll(query);
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async syncDailyRecords() {
    return this.productionRecordService.autoConfirmOldNGRecords();
  }
}
