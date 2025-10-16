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

  // ===== Statistics & Reports =====

  @Get('consumption-by-shift')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async queryConsumptionByShift(
    @Query() query: { date: string; shift: 'day' | 'night' },
  ) {
    return this.transactionService.summarizeConsumptionByShift(query);
  }
}
