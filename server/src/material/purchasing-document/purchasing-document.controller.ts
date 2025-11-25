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
import { PurchasingDocumentService } from './purchasing-document.service';
import {
  SyncPurchasingDocumentsDto,
  QueryPurchasingDocumentDto,
} from './dto/purchasing-document.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';

@Controller('purchasing-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasingDocumentController {
  constructor(private readonly poService: PurchasingDocumentService) {}

  /**
   * Sync PO data from external API
   * POST /purchasing-documents/sync
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MANAGER)
  async syncPOData(@Body() dto: SyncPurchasingDocumentsDto) {
    return this.poService.syncFromExternalAPI(dto);
  }

  /**
   * Get all PO documents
   * GET /purchasing-documents
   */
  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getAllPODocuments(@Query() query: QueryPurchasingDocumentDto) {
    return this.poService.findAll(query);
  }

  /**
   * Get specific PO by number and item
   * GET /purchasing-documents/:po_number/:item
   */
  @Get(':po_number/:item')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getPODocument(
    @Param('po_number') poNumber: string,
    @Param('item') item: string,
  ) {
    return this.poService.findByPOAndItem(poNumber, item);
  }
}
