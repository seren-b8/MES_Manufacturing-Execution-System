import { Controller, Post, UseGuards } from '@nestjs/common';
import { SqlOrderService } from './sql-order.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@Controller('/sql-order')
@UseGuards(JwtAuthGuard)
export class SqlOrderController {
  constructor(private readonly sqlOrderService: SqlOrderService) {}

  @Post('sync')
  async syncProductionOrders() {
    return await this.sqlOrderService.syncProductionOrders();
  }
}
