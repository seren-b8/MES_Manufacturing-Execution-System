// src/material/material-transaction/transaction.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { ReceiveMaterialDto } from '../dto/receive-material.dto';
import { TransferMaterialDto } from '../dto/transfer-material.dto';
import { ConsumeMaterialDto } from '../dto/consume-material.dto';
import { TransactionFiltersDto } from '../dto/transaction-filters.dto';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('receive')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async receiveMaterial(@Body() receiveMaterialDto: ReceiveMaterialDto) {
    return this.transactionService.receiveMaterial(receiveMaterialDto);
  }

  @Post('transfer')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async transferMaterial(@Body() transferMaterialDto: TransferMaterialDto) {
    return this.transactionService.transferMaterial(transferMaterialDto);
  }

  @Post('consume')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async consumeMaterial(@Body() consumeMaterialDto: ConsumeMaterialDto) {
    return this.transactionService.consumeMaterial(consumeMaterialDto);
  }

  @Post('bulk-consume')
  @Roles(Role.ADMIN, Role.MANAGER)
  async processBulkConsumption(@Body() consumptions: ConsumeMaterialDto[]) {
    return this.transactionService.processBulkConsumption(consumptions);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getTransactionHistory(@Query() filters: TransactionFiltersDto) {
    return this.transactionService.getTransactionHistory(filters);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getTransactionById(@Param('id') id: string) {
    return this.transactionService.getTransactionById(id);
  }

  @Get('material/:materialId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getTransactionsByMaterial(@Param('materialId') materialId: string) {
    return this.transactionService.getTransactionsByMaterial(materialId);
  }

  @Get('location/:locationId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getTransactionsByLocation(@Param('locationId') locationId: string) {
    return this.transactionService.getTransactionsByLocation(locationId);
  }

  @Get('position/:locationId/:positionCode')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getTransactionsByPosition(
    @Param('locationId') locationId: string,
    @Param('positionCode') positionCode: string,
  ) {
    return this.transactionService.getTransactionsByPosition(
      locationId,
      positionCode,
    );
  }

  @Get('position/:locationId/:positionCode/stock')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getPositionCurrentStock(
    @Param('locationId') locationId: string,
    @Param('positionCode') positionCode: string,
  ) {
    return this.transactionService.getPositionCurrentStock(
      locationId,
      positionCode,
    );
  }

  @Get('material/:materialId/consumption-summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getMaterialConsumptionSummary(
    @Param('materialId') materialId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transactionService.getMaterialConsumptionSummary(
      materialId,
      startDate,
      endDate,
    );
  }
}
