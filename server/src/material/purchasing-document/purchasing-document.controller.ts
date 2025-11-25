// purchasing-document.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PurchasingDocumentSyncService } from './purchasing-document-sync.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';

@Controller('purchasing-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasingDocumentController {
  constructor(private readonly syncService: PurchasingDocumentSyncService) {}

  /**
   * Manual sync - ระบุเงื่อนไข
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  async manualSync(
    @Body()
    dto: {
      material?: string;
      plant: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.syncService.syncByParams(dto);
  }

  /**
   * Trigger full sync ทันที
   */
  @Post('sync/all')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  async triggerFullSync() {
    return this.syncService.syncAll();
  }

  /**
   * Sync open orders
   */
  @Post('sync/open')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncOpenOrders() {
    return this.syncService.syncOpenOrders();
  }

  /**
   * Sync specific PO
   */
  @Post('sync/:po_number')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncSinglePO(
    @Param('po_number') poNumber: string,
    @Query('plant') plant: string,
  ) {
    return this.syncService.syncSinglePO(poNumber, plant);
  }
}
