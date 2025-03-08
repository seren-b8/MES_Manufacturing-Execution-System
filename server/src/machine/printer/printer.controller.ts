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

@Controller('printer/devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrinterDevicesController {
  constructor(private readonly printerDevicesService: PrinterDevicesService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createPrinterDeviceDto: CreatePrinterDeviceDto) {
    return this.printerDevicesService.create(createPrinterDeviceDto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.printerDevicesService.findAll();
  }

  @Get('type/:type')
  @Roles(Role.ADMIN, Role.USER)
  findByType(@Param('type') type: string) {
    return this.printerDevicesService.findByType(type);
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

  @Get(':id/status')
  @Roles(Role.ADMIN, Role.USER)
  checkStatus(@Param('id') id: string) {
    return this.printerDevicesService.checkPrinterStatus(id);
  }
}
