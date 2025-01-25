import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
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

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('is_not_good') isNotGood?: boolean,
    @Query('confirmation_status') confirmationStatus?: string,
    @Query('is_synced_to_sap') isSyncedToSap?: boolean,
  ) {
    const query: any = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (isNotGood !== undefined) {
      query.is_not_good = isNotGood;
    }

    if (confirmationStatus) {
      query.confirmation_status = confirmationStatus;
    }

    if (isSyncedToSap !== undefined) {
      query.is_synced_to_sap = isSyncedToSap;
    }

    return await this.productionRecordService.findAll(query, page, limit);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductionRecordDto,
  ) {
    return await this.productionRecordService.update(id, updateDto);
  }
}
