import { Controller, Get, Post } from '@nestjs/common';
import { EmployeeService } from './employee.service';

@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeSyncService: EmployeeService) {}

  @Post('sync')
  async syncEmployees() {
    return await this.employeeSyncService.syncEmployees();
  }

  @Get('status')
  async getSyncStatus() {
    return await this.employeeSyncService.getSyncStatus();
  }

  @Get('validate')
  async validateSync() {
    return await this.employeeSyncService.validateSync();
  }
}
