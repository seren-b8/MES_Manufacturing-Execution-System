import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { SAPPOReceiptService } from './receipt.service';
import { ReceiveFromSAPPODto, QuerySAPDODto } from './dto/sap-po.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';

import { Role } from 'src/auth/enum/roles.enum';
import { UnifiedReceiptService } from './unified-receipt.service';
import {
  GetEmployeeId,
  GetUser,
  GetUserId,
} from 'src/auth/decorator/get-current-user.decorator';
import { UnifiedReceiveDto } from './dto/unified-receive.dto';

@Controller('material/sap-po')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SAPPOReceiptController {
  constructor(
    private readonly sapPOReceiptService: SAPPOReceiptService,
    private readonly unifiedReceiptService: UnifiedReceiptService,
  ) {}

  /**
   * รับวัตถุดิบจาก SAP PO
   * POST /material/sap-po/receive
   */
  @Post('receive')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.MANAGER)
  async receiveFromSAPPO(
    @Body() dto: ReceiveFromSAPPODto,
    @GetUserId() userId: string,
    @GetEmployeeId() enployeeId: string,
  ) {
    // Override create_by with authenticated user
    dto.header.create_by = userId;

    return this.sapPOReceiptService.receiveFromSAPPO(dto, enployeeId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.MANAGER)
  async receive(
    @Body() dto: UnifiedReceiveDto,
    @GetUserId() userId: string,
    @GetEmployeeId() employeeId: string,
  ) {
    dto.header.create_by = userId;
    return this.unifiedReceiptService.receiveWithMode(dto, employeeId);
  }

  /**
   * ค้นหา DO ตาม DO Number
   * GET /material/sap-po/do/:do_num
   */
  @Get('do/:do_num')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getDOByNumber(@Param('do_num') doNum: string) {
    const doLog = await this.sapPOReceiptService.findByDONumber(doNum);

    return {
      status: 'success',
      message: 'DO retrieved successfully',
      data: [doLog],
    };
  }

  /**
   * ค้นหา DO ทั้งหมด (with filters)
   * GET /material/sap-po/do
   */
  @Get('do')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getAllDOs(@Query() query: QuerySAPDODto) {
    return this.sapPOReceiptService.findAll(query);
  }
}
