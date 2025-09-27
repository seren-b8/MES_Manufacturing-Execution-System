import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OEEService } from './services/oee.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { machine } from 'os';
import { PerformanceService } from './services/performance.service';
import { TimeFrame } from '../shared/interface/oee';
import { count } from 'console';
import { QualityService } from './services/quality.service';
import { AvailabilityService } from './services/availability.service';
import { Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GetHourlyOEEDto } from './dto/get-hourly-oee.dto';
import {
  MicroCacheInterceptor,
  ShortCacheInterceprot,
} from 'src/machine/interceptors/simple-cache.interceptor';
import { TimeoutInterceptor } from 'src/machine/interceptors/timeout.interceptor';

@Controller('oee')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OEEController {
  constructor(
    private readonly oeeService: OEEService,
    private readonly performanceService: PerformanceService,
    private readonly qualityService: QualityService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get('realtime')
  @UseInterceptors(ShortCacheInterceprot, new TimeoutInterceptor(20000))
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getRealTimeOEE() {
    // return this.oeeService.calculateRealTimeOEE();
    return this.oeeService.realTimeOEE();
  }

  @Get('hourly')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getHourlyOEE(@Query() query: GetHourlyOEEDto) {
    return this.oeeService.getHourlyOEE(query);
  }

  @Get('performance')
  async getPer(@Body() timeFrame: TimeFrame) {
    const data =
      await this.performanceService.getMultiMachinePerformanceArray(timeFrame);
    return data;
  }

  @Get('quality')
  async getQuality(@Body() timeFrame: TimeFrame) {
    const data = await this.qualityService.calculate(timeFrame);
    return data;
  }

  @Get('avalibility')
  async getAvalibility(@Body() timeFrame: TimeFrame) {
    const data =
      await this.availabilityService.getAvailabilityDetails(timeFrame);
    return data;
  }

  @Get('factory')
  async getOEEFactory(@Body() timeFrame: TimeFrame) {
    const data = await this.oeeService.calculateFactoryOEEOnly(timeFrame);
    return data;
  }

  @Get('new-hourly-oee') async getNewHourlyOEE() {
    const data = await this.oeeService.saveHourlyOEE();
    return data;
  }

  @Cron('0 * * * *', {
    name: 'save-hourly-oee',
    timeZone: 'Asia/Bangkok',
  })
  async handleHourlyOEE() {
    // console.log('save hourly OEE...');
    await this.oeeService.saveHourlyOEE();
  }
}
