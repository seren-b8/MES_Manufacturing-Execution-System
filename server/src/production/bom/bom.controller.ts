import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { BOMService } from './bom.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { ResponseFormat } from 'src/shared/interface';
import { BOMItem } from 'src/schema/bom-items.schema';
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

  // ดึง BOM ตาม material number
  @Get('material/:materialNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getBOMByMaterial(
    @Param('materialNumber') materialNumber: string,
  ): Promise<ResponseFormat<BOMItem>> {
    return this.bomService.getBOMByMaterial(materialNumber);
  }

  // คำนวณความต้องการวัตถุดิบ
  @Get('calculate/:materialNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async calculateMaterialRequirement(
    @Param('materialNumber') materialNumber: string,
    @Query('quantity') quantity: string,
  ): Promise<ResponseFormat<any>> {
    const targetQuantity = Number(quantity) || 0;
    return this.bomService.calculateMaterialRequirement(
      materialNumber,
      targetQuantity,
    );
  }

  // ดึง BOM สำหรับ production order
  @Get('order/:orderId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getBOMForOrder(
    @Param('orderId') orderId: string,
  ): Promise<ResponseFormat<any>> {
    return this.bomService.getBOMForOrder(orderId);
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
