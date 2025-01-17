// src/machine/machine-info/machine-info.controller.ts

import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Post,
} from '@nestjs/common';
import { MachineInfoService } from './machine-info.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { MachineInfo } from 'src/schema/machine-info.schema';

@Controller('/machine-info')
@UseGuards(JwtAuthGuard)
export class MachineInfoController {
  constructor(private readonly machineInfoService: MachineInfoService) {}

  // GET /machine-info
  // ดึงข้อมูลเครื่องจักรทั้งหมด
  @Get('get-all-machines')
  async getAllMachines() {
    return this.machineInfoService.findAll();
  }

  @Post('create-machine')
  async createMachine(@Body() data: MachineInfo) {
    return this.machineInfoService.createMachine(data);
  }

  @Get('get-machine-info')
  async getMachineInfo() {
    return this.machineInfoService.getWorkCenterSummary();
  }

  // GET /machine-info/:machineNumber
  // ดึงข้อมูลเครื่องจักรตาม machine number
  @Get('find-by-machine-number/:machineNumber')
  async getMachineByNumber(@Param('machineNumber') machineNumber: string) {
    return this.machineInfoService.findByMachineNumber(machineNumber);
  }

  // PUT /machine-info/:machineNumber/status
  // อัพเดทสถานะเครื่องจักร
  @Put(':machineNumber/status')
  async updateStatus(
    @Param('machineNumber') machineNumber: string,
    @Body('status') status: string,
  ) {
    return this.machineInfoService.updateMachineStatus(machineNumber, status);
  }

  // PUT /machine-info/:machineNumber/counter
  // อัพเดทค่า Counter
  @Put(':machineNumber/counter')
  async updateCounter(
    @Param('machineNumber') machineNumber: string,
    @Body('counter') counter: number,
  ) {
    return this.machineInfoService.updateCounter(machineNumber, counter);
  }
}
