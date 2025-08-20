import { Body, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OEEService } from './services/oee.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { machine } from 'os';
import { PerformanceService } from './services/performance.service';
import { TimeFrame } from '../shared/interface/oee';
import { count } from 'console';

@Controller('oee')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OEEController {
  constructor(
    private readonly oeeService: OEEService,
    private readonly performanceService: PerformanceService,
  ) {}

  @Get('realtime/:machineNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getRealTimeOEE(@Param('machineNumber') machineNumber: string) {
    return this.oeeService.calculateRealTimeOEE(machineNumber);
  }

  @Get('calculate/:machineNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async calculateOEE(
    @Param('machineNumber') machineNumber: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('shiftType') shiftType?: 'day' | 'night',
  ) {
    // TODO: Validate and parse query parameters
    // TODO: Create timeframe object
    // TODO: Call OEE calculation service
    return { message: 'Calculate OEE endpoint' };
  }

  @Get('hourly/:machineNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getHourlyOEE(
    @Param('machineNumber') machineNumber: string,
    @Query('date') date: string,
  ) {
    // TODO: Parse date parameter
    return this.oeeService.getHourlyOEE(machineNumber, new Date(date));
  }

  //   @Get('daily/:machineNumber')
  //   @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  //   async getDailyOEE(
  //     @Param('machineNumber') machineNumber: string,
  //     @Query('date') date: string
  //   ) {
  //     // TODO: Parse date parameter
  //     return this.oeeService.getDailyOEE(machineNumber, new Date(date));
  //   }

  @Get('trends/:machineNumber')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getOEETrends(
    @Param('machineNumber') machineNumber: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('interval') interval: 'hourly' | 'daily' = 'daily',
  ) {
    // TODO: Implement OEE trends analysis
    return { message: 'OEE trends endpoint' };
  }

  @Get('per')
  async getPer(@Body() timeFrame: TimeFrame) {
    console.log(
      'get per test :' + timeFrame.machine_number + ' ' + timeFrame.start_time,
    );
    const data = await this.performanceService.getCycleTime(
      timeFrame.machine_number,
      timeFrame,
    );

    return { count: data.length };
  }
}
