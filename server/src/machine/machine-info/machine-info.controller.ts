import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MachineInfoService } from './machine-info.service';

import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

// Controller
@Controller('machine-info')
@UseGuards(JwtAuthGuard)
export class MachineInfoController {
  constructor(private readonly machineInfoService: MachineInfoService) {}

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
}
