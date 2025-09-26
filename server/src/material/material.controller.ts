// src/material/material.controller.ts (Updated)
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MaterialService } from './material.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { StockOperationDto, TransferStockDto } from './dto/stock-operation.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';

@Controller('materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(@Body() createMaterialDto: CreateMaterialDto) {
    return this.materialService.create(createMaterialDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findAll() {
    return this.materialService.findAll();
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getMaterialStats() {
    return this.materialService.getMaterialStats();
  }

  @Get('low-stock')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getLowStockMaterials(@Query('threshold') threshold?: string) {
    const thresholdValue = threshold ? parseInt(threshold) : 10;
    return this.materialService.getLowStockMaterials(thresholdValue);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findById(@Param('id') id: string) {
    return this.materialService.findById(id);
  }

  @Get('number/:materialNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findByMaterialNumber(@Param('materialNumber') materialNumber: string) {
    return this.materialService.findByMaterialNumber(materialNumber);
  }

  @Get(':id/stock')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getStock(@Param('id') id: string, @Query() query: StockQueryDto) {
    return this.materialService.getStock(id, query);
  }

  @Get(':id/stock/position/:locationId/:positionCode')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getStockByPosition(
    @Param('id') materialId: string,
    @Param('locationId') locationId: string,
    @Param('positionCode') positionCode: string,
    @Query('lotNumber') lotNumber?: string,
  ) {
    return this.materialService.getStockByPosition(
      materialId,
      locationId,
      positionCode,
      lotNumber,
    );
  }

  @Get('location/:locationId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findMaterialsByLocation(
    @Param('locationId') locationId: string,
    @Query('includePositions') includePositions?: string,
  ) {
    const includePos = includePositions === 'true';
    return this.materialService.findMaterialsByLocation(locationId, includePos);
  }

  @Get(':id/movement-summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getMaterialMovementSummary(
    @Param('id') materialId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.materialService.getMaterialMovementSummary(
      materialId,
      startDate,
      endDate,
    );
  }

  @Post('stock/initialize')
  @Roles(Role.ADMIN, Role.MANAGER)
  async initializeStock(@Body() stockOperationDto: StockOperationDto) {
    return this.materialService.initializeStock(stockOperationDto);
  }

  @Post('stock/transfer')
  @Roles(Role.ADMIN, Role.MANAGER)
  async transferStock(@Body() transferStockDto: TransferStockDto) {
    return this.materialService.transferStock(transferStockDto);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() updateMaterialDto: UpdateMaterialDto,
  ) {
    return this.materialService.update(id, updateMaterialDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async delete(@Param('id') id: string) {
    return this.materialService.delete(id);
  }
}
