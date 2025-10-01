import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { ResponseFormat } from 'src/shared/interface';
import { Employee } from 'src/schema/employee.schema';
import { CreateTempEmployeeDto } from 'src/auth/dto/create-temp-employee.dto';
import { Role } from 'src/auth/enum/roles.enum';
import { UserWithEmployeeData } from 'src/shared/interface/employee';
import { CacheTTL } from '@nestjs/cache-manager';
import { CustomThrottlerGuard } from 'src/auth/guard/custom-throttler.guard';
import { TimeoutInterceptor } from 'src/machine/interceptors/timeout.interceptor';
import { ShortCacheInterceptor } from 'src/machine/interceptors/simple-cache.interceptor';
import { Cron } from '@nestjs/schedule';

@Controller('employee')
@UseGuards(JwtAuthGuard, CustomThrottlerGuard)
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
  @UseInterceptors(ShortCacheInterceptor, new TimeoutInterceptor(20000))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @CacheTTL(3)
  async findAllUsers(): Promise<ResponseFormat<Employee>> {
    return this.employeeSyncService.findAllEmployee();
  }

  @Get('find-all-user')
  @UseInterceptors(ShortCacheInterceptor, new TimeoutInterceptor(20000))
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
  ): Promise<ResponseFormat<Employee>> {
    return this.employeeSyncService.createTempEmpolyee(createTempEmployeeDto);
  }

  @Cron('0 * * * *', {
    name: 'save-hourly-oee',
    timeZone: 'Asia/Bangkok',
  })
  async syncEmployeesAuto() {
    return await this.employeeSyncService.syncEmployees();
  }
}
