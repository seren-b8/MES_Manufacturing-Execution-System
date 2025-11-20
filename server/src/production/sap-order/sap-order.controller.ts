import { Controller, Post, UseGuards } from '@nestjs/common';
import { SapOrderService } from './sap-order.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Cron, CronExpression } from '@nestjs/schedule';
import { response } from 'express';
import { CustomThrottlerGuard } from 'src/auth/guard/custom-throttler.guard';

@Controller('/sql-order')
@UseGuards(JwtAuthGuard, CustomThrottlerGuard)
export class SqlOrderController {
  constructor(private readonly sqlOrderService: SapOrderService) {}

  @Post('sync')
  async syncProductionOrders() {
    const response = await this.sqlOrderService.syncProductionOrders();
    if (response.status == 'success') {
      const autoCreatePartRes = this.sqlOrderService.autoCreateNewPart();
      console.log(autoCreatePartRes);
      return response;
    }
    return response;
  }

  @Cron('15 * * * *')
  async syncProductionOrdersCron() {
    try {
      console.log('Starting production order sync...');

      const response = await this.sqlOrderService.syncProductionOrders();

      if (response.status === 'success') {
        await this.sqlOrderService.activateOrder();
        await this.sqlOrderService.autoCreateNewPart();
      } else {
        console.error('Sync failed:', response.message);
      }
    } catch (error) {
      console.error('Cron sync error:', error);
    }
  }
}
