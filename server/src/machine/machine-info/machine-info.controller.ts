import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MachineInfoService } from './machine-info.service';

import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CreateMachineInfoDto } from '../dto/machine-info.dto';
import { MachineInfo } from 'src/shared/modules/schema/machine-info.schema';
import { ResponseFormat } from 'src/shared/interface';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';

// Controller
@Controller('machine-info')
@UseInterceptors(CacheInterceptor)
@UseGuards(JwtAuthGuard)
export class MachineInfoController {
  constructor(private readonly machineInfoService: MachineInfoService) {}

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

  // @Get('work-center/:work_center')
  // async findByWorkCenter(@Param('work_center') work_center: string) {
  //   return await this.machineInfoService.findByWorkCenter(work_center);
  // }

  @Post(':machineNumber/toggle')
  async toggleCounter(@Param('machineNumber') machineNumber: string) {
    return this.machineInfoService.toggleCounter(machineNumber);
  }

  @Get('analysis')
  async getMachineStatusAnalysis(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Query('machine_numbers') machineNumbers?: string,
    @Query('interval_minutes', new ParseIntPipe({ optional: true }))
    intervalMinutes: number = 10,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // แปลง machine_numbers string เป็น array
    const machines = machineNumbers?.split(',').filter(Boolean);

    return await this.machineInfoService.getMachineStatusByPeriod(
      start,
      end,
      intervalMinutes,
      machines,
    );
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
}
