import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { ResponseFormat } from 'src/interface';
import { Employee } from 'src/schema/employee.schema';
import { CreateTempEmployeeDto } from 'src/auth/dto/create-temp-employee.dto';
import { Role } from 'src/auth/enum/roles.enum';
import { UserWithEmployeeData } from 'src/interface/employee';

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

  @Get('find-all-employee')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  async findAllUsers(): Promise<ResponseFormat<Employee[]>> {
    return this.employeeSyncService.findAllEmployee();
  }

  @Get('find-all-user')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findAllEmployee(): Promise<ResponseFormat<UserWithEmployeeData>> {
    return this.employeeSyncService.findAllUsers();
  }

  @Post('create-temp-employee')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async createTempEmployee(
    @Body() createTempEmployeeDto: CreateTempEmployeeDto,
  ): Promise<ResponseFormat<Employee[]>> {
    return this.employeeSyncService.createTempEmpolyee(createTempEmployeeDto);
  }
}
