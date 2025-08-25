// src/printer/printer-devices.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import {
  CreatePrinterDeviceDto,
  UpdatePrinterDeviceDto,
} from '../dto/printer.dto';
import { PrinterDevicesService } from './printer.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomThrottlerGuard } from 'src/auth/guard/custom-throttler.guard';
import { ShortCacheInterceprot } from '../interceptors/simple-cache.interceptor';
import { TimeoutInterceptor } from '../interceptors/timeout.interceptor';

@Controller('printer/devices')
@UseGuards(JwtAuthGuard, RolesGuard, CustomThrottlerGuard)
export class PrinterDevicesController {
  constructor(private readonly printerDevicesService: PrinterDevicesService) {}

  @Get('type/:type')
  @Roles(Role.ADMIN, Role.USER)
  findByType(@Param('type') type: string) {
    return this.printerDevicesService.findByType(type);
  }

  @Get(':id/status')
  @Roles(Role.ADMIN, Role.USER)
  checkStatus(@Param('id') id: string) {
    return this.printerDevicesService.checkPrinterStatus(id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.USER)
  findOne(@Param('id') id: string) {
    return this.printerDevicesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updatePrinterDeviceDto: UpdatePrinterDeviceDto,
  ) {
    return this.printerDevicesService.update(id, updatePrinterDeviceDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.printerDevicesService.remove(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createPrinterDeviceDto: CreatePrinterDeviceDto) {
    return this.printerDevicesService.create(createPrinterDeviceDto);
  }

  @Get()
  @UseInterceptors(ShortCacheInterceprot, new TimeoutInterceptor(20000))
  @Roles(Role.ADMIN)
  findAll() {
    return this.printerDevicesService.findAll();
  }

  // @Cron(CronExpression.EVERY_10_SECONDS)
  // checkPrinterStatusCron() {
  //   // console.log('Checking printer status...');
  //   return this.printerDevicesService.updateAllPrintersStatus();
  // }
}
