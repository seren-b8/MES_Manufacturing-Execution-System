import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { ProductionPlanningService } from './planning.service';
import {
  CreatePlanningDto,
  PlanningQueryDto,
  UpdatePlanningDto,
} from '../dto/planning.dto';
import { GetUserId } from 'src/auth/decorator/get-current-user.decorator';
import { Cron } from '@nestjs/schedule';
import {
  MicroCacheInterceptor,
  ShortCacheInterceptor,
} from 'src/machine/interceptors/simple-cache.interceptor';

@Controller('production-planning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductionPlanningController {
  constructor(
    private readonly productionPlanningService: ProductionPlanningService,
  ) {}

  // Create new planning
  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @GetUserId() userId: string,
    @Body() createPlanningDto: CreatePlanningDto,
  ) {
    return this.productionPlanningService.create(createPlanningDto, userId);
  }

  // Get all planning with optional filters
  @Get()
  @UseInterceptors(MicroCacheInterceptor)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findAll(@Query() query: PlanningQueryDto) {
    return this.productionPlanningService.findAll(query);
  }

  // Get planning by machine and date
  @Get('machine/:machineNumber/date/:date')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findByMachineAndDate(
    @Param('machineNumber') machineNumber: string,
    @Param('date') date: string,
  ) {
    return this.productionPlanningService.findByMachineAndDate(
      machineNumber,
      date,
    );
  }

  // Get planning by ID
  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findById(@Param('id') id: string) {
    return this.productionPlanningService.findById(id);
  }

  // Update planning
  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() updatePlanningDto: UpdatePlanningDto,
  ) {
    return this.productionPlanningService.update(id, updatePlanningDto);
  }

  // Update planning status
  @Put(':id/status')
  @Roles(Role.ADMIN, Role.MANAGER)
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.productionPlanningService.updateStatus(id, status);
  }

  // Reorder planning sequences
  @Put('machine/:machineNumber/reorder')
  async reorderSequences(
    @Param('machineNumber') machineNumber: string,
    @Body('sequences') sequences: { id: string; sequence: number }[],
  ) {
    return this.productionPlanningService.reorderSequences(
      machineNumber,
      sequences,
    );
  }

  // Delete planning
  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    return this.productionPlanningService.delete(id);
  }

  // Dashboard endpoints

  // Get today's planning overview
  @Get('dashboard/today')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getTodayOverview() {
    const today = new Date().toISOString().split('T')[0];
    return this.productionPlanningService.findAll({
      planned_date: new Date(today),
    });
  }

  // Get planning by machine (all dates)
  @Get('machine/:machineNumber')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findByMachine(
    @Param('machineNumber') machineNumber: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const query: any = { machine_number: machineNumber };

    if (startDate && endDate) {
      query.planned_date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    return this.productionPlanningService.findAll(query);
  }

  // Get planning by status
  @Get('status/:status')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findByStatus(@Param('status') status: string) {
    return this.productionPlanningService.findAll({ status });
  }

  // Get draft plans
  @Get('type/draft')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getDraftPlans() {
    return this.productionPlanningService.findAll({ plan_type: 'draft_plan' });
  }

  // Get SAP order plans
  @Get('type/sap-orders')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getSAPOrderPlans() {
    return this.productionPlanningService.findAll({ plan_type: 'sap_order' });
  }

  // Bulk operations

  // Bulk create planning from SAP orders
  @Post('bulk/from-sap-orders')
  @Roles(Role.ADMIN, Role.MANAGER)
  async bulkCreateFromSAPOrders(
    @GetUserId() userId: string,
    @Body()
    orders: {
      production_order_id: string;
      machine_number: string;
      planned_date: Date;
      sequence_order: number;
    }[],
  ) {
    const results = await Promise.all(
      orders.map((order) =>
        this.productionPlanningService.create(
          {
            ...order,
            plan_type: 'sap_order',
            total_order_quantity: 0, // Will be populated from SAP order
          },
          userId,
        ),
      ),
    );

    return {
      status: 'success',
      message: `Created ${results.length} planning records from SAP orders`,
      data: results.map((r) => r.data[0]),
    };
  }

  // Bulk status update
  @Put('bulk/status')
  @Roles(Role.ADMIN, Role.MANAGER)
  async bulkUpdateStatus(@Body() updates: { ids: string[]; status: string }) {
    const results = await Promise.all(
      updates.ids.map((id) =>
        this.productionPlanningService.updateStatus(id, updates.status),
      ),
    );

    return {
      status: 'success',
      message: `Updated status for ${results.length} planning records`,
      data: results.map((r) => r.data[0]),
    };
  }

  // Reporting endpoints

  // Get machine utilization
  @Get('reports/machine-utilization')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getMachineUtilization(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const query: any = {};

    if (startDate && endDate) {
      query.planned_date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    return this.productionPlanningService.findAll(query);
  }

  // Get planning summary by date range
  @Get('reports/summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getPlanningSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('machineNumber') machineNumber?: string,
  ) {
    const query: any = {};

    if (startDate && endDate) {
      query.planned_date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (machineNumber) {
      query.machine_number = machineNumber;
    }

    return this.productionPlanningService.findAll(query);
  }

  // ใน ProductionPlanningController
  @Put(':id/bind-order')
  @Roles(Role.ADMIN, Role.MANAGER)
  async bindOrder(
    @Param('id') planningId: string,
    @Body() body: { production_order_id: string },
  ) {
    return this.productionPlanningService.bindProductionOrder(
      planningId,
      body.production_order_id,
    );
  }

  @Put(':id/unbind-order')
  @Roles(Role.ADMIN, Role.MANAGER)
  async unbindOrder(@Param('id') planningId: string) {
    return this.productionPlanningService.unbindProductionOrder(planningId);
  }

  @Get('available-orders/:materialId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getAvailableOrders(@Param('materialId') materialId: string) {
    return this.productionPlanningService.getAvailableOrders(materialId);
  }

  // ใน Controller หรือ Service
  @Cron('*/5 * * * *') // ทุก 5 นาที
  async autoSyncPlanningStatus() {
    try {
      await this.productionPlanningService.syncAllPlanningStatus();
    } catch (error) {
      console.error('Auto-sync planning status failed:', error);
    }
  }
}
