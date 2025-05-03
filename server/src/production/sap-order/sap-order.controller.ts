import { Controller, Post, UseGuards } from '@nestjs/common';
import { SapOrderService } from './sap-order.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Cron, CronExpression } from '@nestjs/schedule';
import { response } from 'express';

@Controller('/sql-order')
@UseGuards(JwtAuthGuard)
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

  @Cron(CronExpression.EVERY_2_HOURS)
  async syncProductionOrdersCron() {
    const response = await this.sqlOrderService.syncProductionOrders();
    if (response.status == 'success') {
      const autoCreatePartRes = this.sqlOrderService.autoCreateNewPart();
      console.log(autoCreatePartRes);
      return response;
    }
    return response;
  }
}
