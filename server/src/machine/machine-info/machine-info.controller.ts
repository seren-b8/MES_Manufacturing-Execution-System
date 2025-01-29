import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MachineInfoService } from './machine-info.service';

import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CreateMachineInfoDto } from '../dto/machine-info.dto';
import { promises } from 'dns';
import { Response } from 'express';
import { MachineInfo } from 'src/shared/modules/schema/machine-info.schema';
import { ResponseFormat } from 'src/shared/interface';

// Controller
@Controller('machine-info')
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
}
