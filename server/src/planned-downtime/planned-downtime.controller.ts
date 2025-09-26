import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { PlannedDowntimeService } from './planned-downtime.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { CreatePlannedDowntimeDto } from './dto/create-planned-downtime.dto';
import { UpdatePlannedDowntimeDto } from './dto/update-planned-downtime.dto';
import { BulkCreatePlannedDowntimeDto } from './dto/bulk-create-planned-downtime.dto';
import { BulkCreateByTemplateDto } from './dto/bulk-create-by-template.dto';
import { PlannedDowntime } from 'src/schema/planned-downtime.schema';
import { ResponseFormat } from 'src/shared/interface';

// planned-downtime.controller.ts
@Controller('planned-downtime')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlannedDowntimeController {
  constructor(
    private readonly plannedDowntimeService: PlannedDowntimeService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(@Body() dto: CreatePlannedDowntimeDto) {
    return this.plannedDowntimeService.create(dto);
  }

  // เพิ่มใน planned-downtime.controller.ts

  @Post('bulk')
  @Roles(Role.ADMIN, Role.MANAGER)
  async bulkCreate(@Body() dto: BulkCreatePlannedDowntimeDto) {
    return this.plannedDowntimeService.bulkCreate(dto);
  }

  @Post('bulk/template')
  @Roles(Role.ADMIN, Role.MANAGER)
  async bulkCreateByTemplate(@Body() dto: BulkCreateByTemplateDto) {
    return this.plannedDowntimeService.bulkCreateByTemplate(dto);
  }

  @Delete('bulk')
  @Roles(Role.ADMIN, Role.MANAGER)
  async bulkDelete(
    @Body()
    dto: {
      machine_numbers: string[];
      dates: string[];
      shifts: string[];
    },
  ) {
    return this.plannedDowntimeService.bulkDelete(
      dto.machine_numbers,
      dto.dates,
      dto.shifts,
    );
  }

  @Get('machine/:machine/date/:date')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findByMachineAndDate(
    @Param('machine') machine: string,
    @Param('date') date: string,
    @Query('shift') shift?: string,
  ) {
    return this.plannedDowntimeService.findByMachineAndDate(
      machine,
      date,
      shift,
    );
  }

  @Get('total/:machine/:date/:shift')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getTotalPlannedDowntime(
    @Param('machine') machine: string,
    @Param('date') date: string,
    @Param('shift') shift: string,
  ) {
    const total = await this.plannedDowntimeService.getTotalPlannedDowntime(
      machine,
      date,
      shift,
    );
    return {
      status: 'success',
      message: 'Total planned downtime calculated',
      data: [{ total_minutes: total }],
    };
  }

  @Get('range')
  async findDowntimeByDateRange(
    // รับค่าจาก Query Parameters ใน URL
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('shift') shift?: string,
  ): Promise<ResponseFormat<PlannedDowntime[]>> {
    // ตรวจสอบว่ามีการส่ง startDate และ endDate มาหรือไม่
    if (!startDate || !endDate) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Missing required query parameters: startDate and endDate',
          data: [],
        },
        HttpStatus.BAD_REQUEST, // ส่งรหัส 400 Bad Request
      );
    }

    try {
      // เรียกใช้ Service Method
      return await this.plannedDowntimeService.findByDateRange(
        startDate,
        endDate,
        shift,
      );
    } catch (error) {
      // Service Method ได้ throw HttpException ไว้แล้ว แต่เราสามารถจัดการ error เพิ่มเติมได้ที่นี่
      throw error;
    }
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(@Param('id') id: string, @Body() dto: UpdatePlannedDowntimeDto) {
    return this.plannedDowntimeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async delete(@Param('id') id: string) {
    return this.plannedDowntimeService.delete(id);
  }
}
