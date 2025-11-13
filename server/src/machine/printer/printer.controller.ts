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
import { PrinterDevicesService } from './service/printer-devices.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomThrottlerGuard } from 'src/auth/guard/custom-throttler.guard';
import { ShortCacheInterceptor } from '../interceptors/simple-cache.interceptor';
import { TimeoutInterceptor } from '../interceptors/timeout.interceptor';
import { ResponseFormat } from 'src/shared/interface';
import { PrinterOperationService } from './service/printer-operation.service';

@Controller('printer/devices')
@UseGuards(JwtAuthGuard, RolesGuard, CustomThrottlerGuard)
export class PrinterDevicesController {
  constructor(
    private readonly printerDevicesService: PrinterDevicesService,
    private readonly printerOperationService: PrinterOperationService,
  ) {}

  @Get('all-status')
  checkPrinterStatus() {
    console.log('Checking printer status...');
    return this.printerDevicesService.updateAllPrintersStatus();
  }

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

  /**
   * Test printer connection
   * POST /printer/test/:printerId
   */
  @Post('test/:printerIP')
  @Roles(Role.ADMIN, Role.MANAGER)
  async testPrinter(
    @Param('printerIP') printerIP: string,
  ): Promise<ResponseFormat<any>> {
    return this.printerOperationService.testPrinter(printerIP);
  }

  @Post('test-print-from-url')
  @Roles(Role.ADMIN, Role.MANAGER)
  async testPrintFromUrl(
    @Body() body: { url: string; printerIP: string },
  ): Promise<any> {
    return this.printerOperationService.printFromUrl(
      body.url,
      body.printerIP,
      true,
      1,
    );
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createPrinterDeviceDto: CreatePrinterDeviceDto) {
    return this.printerDevicesService.create(createPrinterDeviceDto);
  }

  @Get()
  @UseInterceptors(ShortCacheInterceptor, new TimeoutInterceptor(20000))
  @Roles(Role.ADMIN)
  findAll() {
    return this.printerDevicesService.findAll();
  }

  @Cron('*/2 * * * *')
  checkPrinterStatusCron() {
    // console.log('Checking printer status...');
    return this.printerDevicesService.updateAllPrintersStatus();
  }
}
