// src/material-receipt/material-receipt.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import { SyncReceiptDto } from './dto/sync-receipt.dto';
import { ProcessReceiptDto } from './dto/process-receipt.dto';
import { CancelReceiptDto } from './dto/cancel-receipt.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { MaterialReceiptService } from './receipt.service';
import { Role } from 'src/auth/enum/roles.enum';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { ResponseFormat } from 'src/shared/interface';
import { MaterialReceipt } from 'src/schema/material-receipts.schema';
import { MaterialReceiptItem } from 'src/schema/material-receipt-items';
import { GetUser } from 'src/auth/decorator/get-current-user.decorator';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller('material-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialReceiptController {
  constructor(
    private readonly materialReceiptService: MaterialReceiptService,
  ) {}

  // ==================== SYNC FROM SAP ====================

  /**
   * Sync material receipts from SAP
   * POST /material-receipts/sync
   */
  @Post('sync')
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncReceipts(
    @Body() dto: SyncReceiptDto,
  ): Promise<ResponseFormat<any>> {
    return this.materialReceiptService.syncMaterialReceiptsFromSQL(
      dto.start_date,
      dto.end_date,
    );
  }

  /**
   * Sync today's receipts
   * POST /material-receipts/sync/today
   */
  @Post('sync/today')
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncTodayReceipts(): Promise<ResponseFormat<any>> {
    return this.materialReceiptService.syncTodayReceipts();
  }

  /**
   * Sync recent receipts (last 7 days)
   * POST /material-receipts/sync/recent
   */
  @Post('sync/recent')
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncRecentReceipts(
    @Query('days') days?: number,
  ): Promise<ResponseFormat<any>> {
    return this.materialReceiptService.syncRecentReceipts(days || 7);
  }

  // ==================== QUERY RECEIPTS ====================

  /**
   * Get all receipts with optional filters
   * GET /material-receipts
   * Query params: receipt_status, material_number, start_date, end_date
   */
  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findAll(
    @Query('receipt_status') receiptStatus?: string,
    @Query('material_number') materialNumber?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Promise<ResponseFormat<MaterialReceipt>> {
    return this.materialReceiptService.findAll({
      receipt_status: receiptStatus,
      material_number: materialNumber,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /**
   * Get pending/partial receipts
   * GET /material-receipts/pending
   */
  @Get('pending')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findPending(): Promise<ResponseFormat<MaterialReceipt>> {
    return this.materialReceiptService.findPending();
  }

  /**
   * Get receipt by ID with items
   * GET /material-receipts/:id
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findById(
    @Param('id') id: string,
  ): Promise<ResponseFormat<MaterialReceipt>> {
    return this.materialReceiptService.findById(id);
  }

  /**
   * Get receipt items
   * GET /material-receipts/:id/items
   */
  @Get(':id/items')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getReceiptItems(
    @Param('id') id: string,
  ): Promise<ResponseFormat<MaterialReceiptItem>> {
    return this.materialReceiptService.getReceiptItems(id);
  }

  // ==================== PROCESS RECEIPT ====================

  /**
   * Process receipt (receive materials into locations/positions)
   * POST /material-receipts/:id/process
   */
  @Post(':id/process')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async processReceipt(
    @Param('id') receiptId: string,
    @Body() dto: ProcessReceiptDto,
    @GetUser() userId: string,
  ): Promise<ResponseFormat<MaterialReceiptItem>> {
    return this.materialReceiptService.processReceipt(
      receiptId,
      dto.items,
      userId,
    );
  }

  /**
   * Cancel receipt
   * POST /material-receipts/:id/cancel
   */
  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.MANAGER)
  async cancelReceipt(
    @Param('id') id: string,
    @Body() dto: CancelReceiptDto,
  ): Promise<ResponseFormat<MaterialReceipt>> {
    return this.materialReceiptService.cancelReceipt(id, dto.reason);
  }

  // ==================== RECEIPT ITEMS MANAGEMENT ====================

  /**
   * Delete receipt item (reverse the receive operation)
   * DELETE /material-receipts/items/:itemId
   */
  @Delete('items/:itemId')
  @Roles(Role.ADMIN, Role.MANAGER)
  async deleteReceiptItem(
    @Param('itemId') itemId: string,
    @GetUser() userId: string,
  ): Promise<ResponseFormat<any>> {
    return this.materialReceiptService.deleteReceiptItem(itemId, userId);
  }

  // ==================== STATISTICS ====================

  /**
   * Get receipt statistics
   * GET /material-receipts/stats/summary
   */
  @Get('stats/summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getStats(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Promise<ResponseFormat<any>> {
    // This would be implemented in service
    return {
      status: 'success',
      message: 'Statistics retrieved successfully',
      data: [
        {
          total_receipts: 0,
          pending: 0,
          partial: 0,
          completed: 0,
          cancelled: 0,
          total_quantity: 0,
          processed_quantity: 0,
          remaining_quantity: 0,
        },
      ],
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncTodayReceiptsHourly() {
    console.log('Starting hourly material receipts sync...');

    try {
      const result = await this.materialReceiptService.syncTodayReceipts();

      console.log(`Hourly sync completed: ${JSON.stringify(result.data[0])}`);
    } catch (error) {
      console.error(
        `Hourly sync failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
