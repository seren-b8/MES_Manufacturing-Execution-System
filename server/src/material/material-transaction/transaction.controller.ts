// src/material/material-transaction/transaction.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';

import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { ConsumeMaterialDto } from './dto/consume-material.dto';
import { TransferMaterialDto } from './dto/transfer-material.dto';
import { ReceiveMaterialDto } from './dto/receive-material.dto';
import { GetUserId } from 'src/auth/decorator/get-current-user.decorator';

@Controller('material-transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // ===== Transaction Operations =====

  /**
   * Receive material into location
   * @route POST /material-transactions/receive
   */
  @Post('receive')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  async receiveMaterial(
    @Body() dto: ReceiveMaterialDto,
    @GetUserId() userId: string,
  ) {
    return this.transactionService.receiveMaterial({ ...dto, user_id: userId });
  }

  /**
   * Transfer material between locations
   * @route POST /material-transactions/transfer
   */
  @Post('transfer')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  async transferMaterial(
    @Body() dto: TransferMaterialDto,
    @GetUserId() userId: string,
  ) {
    return this.transactionService.transferMaterial({
      ...dto,
      user_id: userId,
    });
  }

  /**
   * Consume material for production
   * @route POST /material-transactions/consume
   */
  @Post('consume')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  async consumeMaterial(
    @Body() dto: ConsumeMaterialDto,
    @GetUserId() userId: string,
  ) {
    return this.transactionService.consumeMaterial({
      ...dto,
      user_id: userId,
    });
  }

  // ===== Query Operations =====

  /**
   * Get all transactions with filters
   * @route GET /material-transactions
   */
  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryTransactionDto) {
    return this.transactionService.findAll(query);
  }

  /**
   * Get transactions by material number
   * @route GET /material-transactions/by-material/:materialNumber
   */
  @Get('by-material/:materialNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findByMaterial(@Param('materialNumber') materialNumber: string) {
    return this.transactionService.findByMaterial(materialNumber);
  }

  /**
   * Get transactions by location
   * @route GET /material-transactions/by-location/:locationCode
   */
  @Get('by-location/:locationCode')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findByLocation(@Param('locationCode') locationCode: string) {
    return this.transactionService.findByLocation(locationCode);
  }

  /**
   * Get transactions by production order
   * @route GET /material-transactions/by-order/:orderId
   */
  @Get('by-order/:orderId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findByProductionOrder(@Param('orderId') orderId: string) {
    return this.transactionService.findByProductionOrder(orderId);
  }

  /**
   * Get transactions by user
   * @route GET /material-transactions/by-user/:userId
   */
  @Get('by-user/:userId')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async findByUser(
    @Param('userId') userId: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.transactionService.findByUser(userId, start, end);
  }

  // ===== Statistics & Reports =====

  /**
   * Get transaction summary for a material
   * @route GET /material-transactions/summary/:materialNumber
   */
  @Get('summary/:materialNumber')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getTransactionSummary(
    @Param('materialNumber') materialNumber: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    if (!startDate || !endDate) {
      return {
        status: 'error',
        message: 'start_date and end_date query parameters are required',
        data: [],
      };
    }

    return this.transactionService.getTransactionSummary(
      materialNumber,
      new Date(startDate),
      new Date(endDate),
    );
  }

  /**
   * Get material consumption by machine
   * @route GET /material-transactions/consumption/by-machine/:machineNumber
   */
  @Get('consumption/by-machine/:machineNumber')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getConsumptionByMachine(
    @Param('machineNumber') machineNumber: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    if (!startDate || !endDate) {
      return {
        status: 'error',
        message: 'start_date and end_date query parameters are required',
        data: [],
      };
    }

    return this.transactionService.getConsumptionByMachine(
      machineNumber,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
