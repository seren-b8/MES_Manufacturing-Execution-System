import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
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
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from 'src/auth/auth.service';

@Controller('employee')
@UseGuards(JwtAuthGuard, CustomThrottlerGuard)
export class EmployeeController {
  private readonly logger = new Logger(EmployeeController.name);
  constructor(
    private readonly employeeSyncService: EmployeeService,
    private readonly authService: AuthService,
  ) {}

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

  @Cron(CronExpression.EVERY_2_HOURS, {
    name: 'sync-employees-auto',
    timeZone: 'Asia/Bangkok',
  })
  async syncEmployeesAuto() {
    this.logger.log('🔄 Starting scheduled employee sync...');

    try {
      // 1. Sync employees first
      const syncResult = await this.employeeSyncService.syncEmployees();
      this.logger.log('✅ Scheduled employee sync completed');

      // 2. Create missing users
      const authResult = await this.authService.createAllMissingUsers();
      this.logger.log('✅ Scheduled create all missing users completed');

      // 3. Return combined results
      return {
        status: 'success',
        message: 'Employee sync and user creation completed',
        data: [
          {
            employeeSync: syncResult,
            userCreation: authResult,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      this.logger.error('❌ Scheduled employee sync failed:', error);

      // ไม่ throw error เพื่อไม่ให้ cron job หยุดทำงาน
      return {
        status: 'error',
        message: 'Employee sync failed',
        data: [
          {
            error: (error as Error).message,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }
  }
}
