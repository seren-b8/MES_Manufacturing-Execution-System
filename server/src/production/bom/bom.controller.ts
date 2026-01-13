import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { BOMService } from './bom.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { ResponseFormat } from 'src/shared/interface';
import { Role } from 'src/auth/enum/roles.enum';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller('bom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BOMController {
  constructor(private readonly bomService: BOMService) {}

  // Sync BOM จาก SAP
  @Post('sync')
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncBOMItems(): Promise<ResponseFormat<any>> {
    return this.bomService.syncBOMItems();
  }

  @Get('material/:materialNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getBOMForProduction(
    @Param('materialNumber') materialNumber: string,
    @Query('orderId') orderId?: string,
  ): Promise<ResponseFormat<any>> {
    return this.bomService.getRequiredMaterialsForProduct(
      materialNumber,
      orderId,
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncProductionOrdersCron() {
    try {
      await this.bomService.syncBOMItems();
    } catch (error) {
      console.error('Cron sync error:', error);
    }
  }
}
