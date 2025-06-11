import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { MachineInfoService } from './machine-info.service';

import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CreateMachineInfoDto, SetCounterDto } from '../dto/machine-info.dto';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { ResponseFormat } from 'src/shared/interface';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import * as moment from 'moment-timezone';
import { MachineAnalysisCacheInterceptor } from '../interceptors/machine-analysis-cache.interceptor';
import { TimeoutInterceptor } from '../interceptors/timeout.interceptor';
import { SimpleCacheInterceptor } from '../interceptors/simple-cache.interceptor';
import { Cron } from '@nestjs/schedule';

// Controller
@Controller('machine-info')
@UseInterceptors(CacheInterceptor)
@UseGuards(JwtAuthGuard)
export class MachineInfoController {
  private readonly logger = new Logger(MachineInfoController.name);

  constructor(private readonly machineInfoService: MachineInfoService) {}

  // @Get('work-center/:work_center')
  // async findByWorkCenter(@Param('work_center') work_center: string) {
  //   return await this.machineInfoService.findByWorkCenter(work_center);
  // }

  @Post(':machineNumber/toggle')
  async toggleCounter(@Param('machineNumber') machineNumber: string) {
    return this.machineInfoService.toggleCounter(machineNumber);
  }

  @Get('analysis')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UseInterceptors(SimpleCacheInterceptor, new TimeoutInterceptor(20000))
  async getMachineAnalysis(
    @Query('start_date') start_date: string,
    @Query('end_date') end_date: string,
    @Query('interval_minutes', new DefaultValuePipe(10), ParseIntPipe)
    interval_minutes: number,
    @Query('machine_numbers') machine_numbers?: string,
  ) {
    // ตรวจสอบว่า start_date และ end_date ถูกต้อง
    if (!start_date || !end_date) {
      return {
        status: 'error',
        message: 'Both start_date and end_date are required',
        data: [],
      };
    }

    try {
      // แปลงวันที่เป็น Date object ในเขตเวลาไทย
      const startDate = moment(start_date).tz('Asia/Bangkok').toDate();
      const endDate = moment(end_date).tz('Asia/Bangkok').toDate();

      // แปลง machine_numbers เป็น array (ถ้ามี)
      const machineArray = machine_numbers
        ? machine_numbers.split(',')
        : undefined;

      // ตรวจสอบว่า intervalMinutes มีค่าที่เหมาะสม
      const intervalMinutes = Math.max(1, Math.min(interval_minutes, 60));

      // เรียกใช้ service
      return this.machineInfoService.getMachineStatusByPeriod(
        startDate,
        endDate,
        intervalMinutes,
        machineArray,
      );
    } catch (error) {
      return {
        status: 'error',
        message: `Invalid date format: ${(error as Error).message}`,
        data: [],
      };
    }
  }

  @Post('reset-counter')
  async resetCounter(@Query('machine_number') machineNumber: string) {
    return await this.machineInfoService.resetCounter(machineNumber);
  }

  // ดึงข้อมูลเครื่องพิมพ์ของเครื่องจักร
  @Get(':id/printer')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  getMachinePrinter(@Param('id') id: string) {
    return this.machineInfoService.getMachinePrinter(id);
  }

  // เพิ่มหรืออัพเดทเครื่องพิมพ์ให้กับเครื่องจักร
  @Post(':id/printer')
  @Roles(Role.ADMIN)
  assignPrinterToMachine(
    @Param('id') id: string,
    @Body() body: { printer_id: string },
  ) {
    return this.machineInfoService.assignPrinterToMachine(id, body.printer_id);
  }

  // ลบเครื่องพิมพ์ออกจากเครื่องจักร
  @Delete(':id/printer')
  @Roles(Role.ADMIN)
  removePrinterFromMachine(@Param('id') id: string) {
    return this.machineInfoService.removePrinterFromMachine(id);
  }

  // ดึงข้อมูลเครื่องจักรทั้งหมดพร้อมเครื่องพิมพ์
  @Get('with-printers')
  @Roles(Role.ADMIN)
  getAllMachinesWithPrinters() {
    return this.machineInfoService.getAllMachinesWithPrinters();
  }

  // ค้นหาเครื่องจักรตามเครื่องพิมพ์
  @Get('by-printer/:printerId')
  @Roles(Role.ADMIN, Role.MANAGER)
  findMachinesByPrinter(@Param('printerId') printerId: string) {
    return this.machineInfoService.findMachinesByPrinter(printerId);
  }

  @Put('counter/:machineNumber')
  @Roles(Role.ADMIN)
  setMachineCounter(
    @Param('machineNumber') machineNumber: string,
    @Body() setCounterDto: SetCounterDto,
  ) {
    return this.machineInfoService.setMachineCounter(
      machineNumber,
      setCounterDto.counter,
    );
  }

  @Post()
  async createMachineInfo(
    @Body() createDto: CreateMachineInfoDto,
  ): Promise<ResponseFormat<MachineInfo>> {
    return await this.machineInfoService.createMachineInfo(createDto);
  }

  @Get()
  @CacheTTL(3)
  async getAllMachinesDetails() {
    return await this.machineInfoService.getAllMachinesDetails();
  }

  @Cron('0 1 * * *', {
    name: 'resetMachineCounterDaily',
    timeZone: 'UTC', // UTC time to match Thailand timezone (UTC+7)
  })
  async autoDailyMachineCounterReset() {
    const thaiTime = moment().tz('Asia/Bangkok');
    this.logger.log(
      `Starting daily machine counter reset at ${thaiTime.format('YYYY-MM-DD HH:mm:ss')} (Thailand Time)`,
    );

    try {
      // รีเซ็ต counter ของเครื่องจักรทั้งหมด
      const result =
        await this.machineInfoService.resetAllMachineCounter('all');

      if (result.status === 'success' && result.data.length > 0) {
        const summary = result.data[0];
        this.logger.log(
          `Daily machine counter reset completed successfully: ` +
            `${summary.success_count} success, ${summary.failure_count} failed, ${summary.skipped_count} skipped`,
        );

        // Log รายละเอียดของเครื่องที่รีเซ็ตไม่สำเร็จ
        if (summary.failure_count > 0) {
          const failedMachines = summary.details
            .filter((detail) => detail.status === 'failed')
            .map((detail) => `${detail.machine_number}: ${detail.error}`)
            .join(', ');

          this.logger.warn(
            `Failed to reset counters for machines: ${failedMachines}`,
          );
        }

        // สร้าง log สำหรับการติดตาม
        await this.createResetLog(summary);
      } else {
        this.logger.error(
          `Daily machine counter reset failed: ${result.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error during daily machine counter reset: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
  createResetLog(summary: any) {
    throw new Error('Method not implemented.');
  }
}
