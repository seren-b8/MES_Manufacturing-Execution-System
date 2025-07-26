import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ProductionOrderService } from './production-order.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CustomThrottlerGuard } from 'src/auth/guard/custom-throttler.guard';

@Controller('/production-orders')
@UseGuards(JwtAuthGuard, CustomThrottlerGuard)
export class ProductionOrderController {
  constructor(
    private readonly productionOrderService: ProductionOrderService,
  ) {}

  @Get('active')
  async findActiveOrders() {
    return this.productionOrderService.findActiveOrders();
  }

  @Get('work-center/:workCenter')
  async findByWorkCenter(@Param('workCenter') workCenter: string) {
    return this.productionOrderService.findByWorkCenter(workCenter);
  }

  @Get('date-range')
  async findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.productionOrderService.findByDateRange(startDate, endDate);
  }

  @Get('job-waiting')
  async getjobWaiting(@Query('workCenter') workCenter: string) {
    return this.productionOrderService.getJobWaiting(workCenter);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.productionOrderService.findById(id);
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.productionOrderService.findAll(query);
  }
}
