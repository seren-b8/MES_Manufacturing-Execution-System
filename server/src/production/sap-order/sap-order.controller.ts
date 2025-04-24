import { Controller, Post, UseGuards } from '@nestjs/common';
import { SapOrderService } from './sap-order.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller('/sql-order')
@UseGuards(JwtAuthGuard)
export class SqlOrderController {
  constructor(private readonly sqlOrderService: SapOrderService) {}

  @Post('sync')
  async syncProductionOrders() {
    return await this.sqlOrderService.syncProductionOrders();
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async syncProductionOrdersCron() {
    return await this.sqlOrderService.syncProductionOrders();
  }
}
