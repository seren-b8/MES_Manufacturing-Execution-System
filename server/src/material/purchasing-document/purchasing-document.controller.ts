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
  ValidationPipe,
} from '@nestjs/common';
import {
  QueryPurchasingDocumentDto,
  SyncPurchasingDocumentDto,
  SyncSinglePODto,
  SyncByPlantDto,
  StatusStatsQueryDto,
  SyncStatsQueryDto,
} from './dto/purchasing-document.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { PurchasingDocumentSyncService } from './purchasing-document-sync.service';
import { PurchasingDocumentService } from './purchasing-document.service';

@Controller('purchasing-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasingDocumentController {
  constructor(
    private readonly syncService: PurchasingDocumentSyncService,
    private readonly purchasingDocumentService: PurchasingDocumentService,
  ) {}

  /**
   * GET /purchasing-documents
   * Query PO documents with filters
   */
  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findAll(
    @Query(new ValidationPipe({ transform: true }))
    query: QueryPurchasingDocumentDto,
  ) {
    return this.purchasingDocumentService.findAll(query);
  }

  /**
   * GET /purchasing-documents/:id
   * Get single PO document by MongoDB _id
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findOne(@Param('id') id: string) {
    return this.purchasingDocumentService.findOne(id);
  }

  // ==================== SYNC ENDPOINTS ====================

  /**
   * POST /purchasing-documents/sync
   * Manual sync with parameters
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  async manualSync(@Body(ValidationPipe) dto: SyncPurchasingDocumentDto) {
    const result = await this.syncService.syncByParams(dto);

    return {
      status: 'success',
      message: `Synced ${result.synced} PO documents from SAP`,
      data: {
        plant: dto.plant,
        material: dto.material,
        synced: result.synced,
        failed: result.failed,
      },
    };
  }

  /**
   * POST /purchasing-documents/sync/all
   * Trigger full sync
   */
  @Post('sync/all')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  async triggerFullSync() {
    const result = await this.syncService.syncAll();

    return {
      status: 'success',
      message: `Full sync completed: ${result.totalSynced} documents synced`,
      data: {
        totalSynced: result.totalSynced,
        failed: result.failed,
        errors: result.errors || [],
      },
    };
  }

  /**
   * POST /purchasing-documents/sync/open
   * Sync open/partial POs
   */
  @Post('sync/open')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncOpenOrders() {
    const result = await this.syncService.syncOpenOrders();

    return {
      status: 'success',
      message: `Synced ${result.totalSynced} open PO documents`,
      data: {
        totalSynced: result.totalSynced,
        failed: result.failed,
      },
    };
  }

  /**
   * POST /purchasing-documents/sync/plant/:plant
   * Sync entire plant
   */
  @Post('sync/plant/:plant')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncByPlant(
    @Param('plant') plant: string,
    @Body(ValidationPipe) dto?: SyncByPlantDto,
  ) {
    const result = await this.syncService.syncByPlant(plant);

    return {
      status: 'success',
      message: `Synced plant ${plant}: ${result.synced} documents`,
      data: {
        plant: result.plant,
        synced: result.synced,
        failed: result.failed,
      },
    };
  }

  /**
   * POST /purchasing-documents/sync/:po_number
   * Sync single PO
   */
  @Post('sync/:po_number')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncSinglePO(
    @Param('po_number') poNumber: string,
    @Query(ValidationPipe) dto: SyncSinglePODto,
  ) {
    const result = await this.syncService.syncSinglePO(poNumber, dto.plant);

    return {
      status: 'success',
      message: `Synced PO ${poNumber}: ${result.synced} items`,
      data: {
        po_number: poNumber,
        plant: dto.plant,
        synced: result.synced,
        items: result.data,
      },
    };
  }

  /**
   * POST /purchasing-documents/sync/stale/mark
   * Mark stale records manually
   */
  @Post('sync/stale/mark')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  async markStaleRecords() {
    const count = await this.syncService.markStaleRecords();

    return {
      status: 'success',
      message: `Marked ${count} stale PO documents as inactive`,
      data: {
        markedCount: count,
      },
    };
  }

  // ==================== STATISTICS ====================

  /**
   * GET /purchasing-documents/stats/sync
   * Get sync statistics
   */
  @Get('stats/sync')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getSyncStats(@Query(ValidationPipe) query: SyncStatsQueryDto) {
    return this.purchasingDocumentService.getSyncStats(query);
  }

  /**
   * GET /purchasing-documents/stats/status
   * Get status statistics
   */
  @Get('stats/status')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getStatusStats(@Query(ValidationPipe) query: StatusStatsQueryDto) {
    return this.purchasingDocumentService.getStatusStats(query);
  }
}
