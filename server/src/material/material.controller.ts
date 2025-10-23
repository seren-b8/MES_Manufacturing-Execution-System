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
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { MaterialService } from './material.service';

import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import {
  QueryMaterialDto,
  QueryMaterialInventoryDto,
} from './dto/query-material.dto';

@Controller('materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  /**
   * Get all materials with optional filters
   * @route GET /materials
   */
  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryMaterialDto) {
    return this.materialService.findAll(query);
  }

  @Get('inventory')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getInventory(@Query() query: QueryMaterialInventoryDto) {
    console.log('Received inventory query:', query);
    return this.materialService.findInventoryTable(query);
  }

  /**
   * Search materials by keyword
   * @route GET /materials/search
   */
  @Get('search')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async searchMaterials(@Query('q') searchQuery: string) {
    if (!searchQuery) {
      return {
        status: 'error',
        message: 'Search query parameter "q" is required',
        data: [],
      };
    }
    return this.materialService.searchMaterials(searchQuery);
  }

  /**
   * Get stock breakdown by location for a material
   * @route GET /materials/:materialNumber/stock
   */
  @Get(':materialNumber/stock')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getStockByLocation(@Param('materialNumber') materialNumber: string) {
    return this.materialService.getStockByLocation(materialNumber);
  }

  /**
   * Get total stock for a material
   * @route GET /materials/:materialNumber/total-stock
   */
  @Get(':materialNumber/total-stock')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getTotalStock(@Param('materialNumber') materialNumber: string) {
    const totalStock = await this.materialService.getTotalStock(materialNumber);
    return {
      status: 'success',
      message: 'Total stock retrieved successfully',
      data: [{ material_number: materialNumber, total_stock: totalStock }],
    };
  }

  /**
   * Check stock availability at specific location
   * @route GET /materials/:materialNumber/check-stock
   */
  @Get(':materialNumber/check-stock')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async checkStock(
    @Param('materialNumber') materialNumber: string,
    @Query('location_code') locationCode: string,
    @Query('required_quantity') requiredQuantity: string,
  ) {
    if (!locationCode || !requiredQuantity) {
      return {
        status: 'error',
        message: 'location_code and required_quantity are required',
        data: [],
      };
    }

    const quantity = parseFloat(requiredQuantity);
    const hasStock = await this.materialService.checkStockAvailability(
      materialNumber,
      locationCode,
      quantity,
    );

    return {
      status: 'success',
      message: hasStock ? 'Stock is available' : 'Insufficient stock',
      data: [
        {
          material_number: materialNumber,
          location_code: locationCode,
          required_quantity: quantity,
          is_available: hasStock,
        },
      ],
    };
  }

  @Delete('dev/clear-stock')
  @Roles(Role.ADMIN) // เฉพาะ Admin เท่านั้น
  async clearAllStock() {
    return this.materialService.clearAllStock();
  }
}
