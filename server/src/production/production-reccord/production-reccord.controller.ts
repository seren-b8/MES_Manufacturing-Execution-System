import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  CreateProductionRecordDto,
  UpdateProductionRecordDto,
} from '../dto/production-reccord.dto';
import { ProductionRecordService } from './production-reccord.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@Controller('production-records')
@UseGuards(JwtAuthGuard)
export class ProductionRecordController {
  constructor(
    private readonly productionRecordService: ProductionRecordService,
  ) {}

  @Post()
  async create(@Body() createDto: CreateProductionRecordDto) {
    return await this.productionRecordService.create(createDto);
  }

  @Get('assign-employee/:assignEmployeeId')
  async findByAssignEmployee(
    @Param('assignEmployeeId') assignEmployeeId: string,
  ) {
    return await this.productionRecordService.findByAssignEmployee(
      assignEmployeeId,
    );
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductionRecordDto,
  ) {
    return await this.productionRecordService.update(id, updateDto);
  }
}
