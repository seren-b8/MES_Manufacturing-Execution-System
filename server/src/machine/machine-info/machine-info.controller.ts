import {
  Body,
  Controller,
  Get,
  Param,
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

  @Get('work-center/:work_center')
  async findByWorkCenter(@Param('work_center') work_center: string) {
    return await this.machineInfoService.findByWorkCenter(work_center);
  }

  @Get('work-center/:work_center/orders')
  async getProductionOrders(
    @Param('work_center') work_center: string,
    @Query('status') status?: 'pending' | 'active' | 'completed',
  ) {
    return await this.machineInfoService.getProductionOrdersByWorkCenter(
      work_center,
      status,
    );
  }

  @Post(':machineNumber/toggle')
  async toggleCounter(@Param('machineNumber') machineNumber: string) {
    return this.machineInfoService.toggleCounter(machineNumber);
  }
}
