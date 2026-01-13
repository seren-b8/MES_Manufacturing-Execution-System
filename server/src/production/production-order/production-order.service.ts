import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import moment = require('moment-timezone');
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { machine } from 'os';

@Injectable()
export class ProductionOrderService {
  constructor(
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,

    @InjectModel(AssignOrder.name)
    private readonly assignOderModel: Model<AssignOrder>,
  ) {}

  async findAll(query: any = {}): Promise<ResponseFormat<ProductionOrder>> {
    try {
      const { sql_active = 'true', ...otherFilters } = query;

      const orders = await this.productionOrderModel
        .find({
          sql_active: sql_active === 'true',
          ...otherFilters,
        })
        .sort({ basic_start_date: -1 })
        .lean();

      return {
        status: 'success',
        message: 'Retrieved production orders successfully',
        data: orders,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to retrieve production orders: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a production order by ID
   */
  async findById(id: string): Promise<ResponseFormat<ProductionOrder>> {
    try {
      const order = await this.productionOrderModel.findById(id).lean();

      if (!order) {
        throw new HttpException(
          {
            status: 'error',
            message: `Production order ${id} not found`,
            data: [],
          } as ResponseFormat<never>,
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Retrieved production order successfully',
        data: [order],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to retrieve production order' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get production orders by work center
   */
  async findByWorkCenter(
    workCenter: string,
  ): Promise<ResponseFormat<ProductionOrder[]>> {
    try {
      const orders = await this.productionOrderModel
        .find({ work_center: workCenter })
        .sort({ basic_start_date: -1 })
        .lean();

      return {
        status: 'success',
        message: `Retrieved production orders for work center ${workCenter}`,
        data: [orders],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to retrieve production orders for work center ${workCenter}: ${(error as Error).message}`,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get production orders by date range
   */
  async findByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ResponseFormat<ProductionOrder>> {
    try {
      const orders = await this.productionOrderModel
        .find({
          basic_start_date: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .sort({ basic_start_date: 1 })
        .lean();

      return {
        status: 'success',
        message: 'Retrieved production orders within date range',
        data: orders,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to retrieve production orders within date range: ' +
            (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get active production orders (not completed)
   */
  async findActiveOrders(): Promise<ResponseFormat<ProductionOrder>> {
    try {
      const currentDate = new Date().toISOString().split('T')[0];

      const orders = await this.productionOrderModel
        .find({
          basic_finish_date: { $gte: currentDate },
        })
        .sort({ basic_start_date: 1 })
        .lean();

      return {
        status: 'success',
        message: 'Retrieved active production orders',
        data: orders,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to retrieve active production orders: ' +
            (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * หาข้อมูลที่สามารถ assign ได้
   */
  async getJobWaiting(
    workCenter?: string,
  ): Promise<ResponseFormat<ProductionOrder>> {
    try {
      const collectionNames = {
        assignOrder: this.assignOderModel.collection.collectionName,
      };

      const matchCondition: any = { sql_active: true };

      if (workCenter) {
        matchCondition.work_center = workCenter;
      }

      const jobWaiting = await this.productionOrderModel.aggregate([
        {
          $match: matchCondition,
        },
        {
          $lookup: {
            from: 'master_parts',
            localField: 'material_number',
            foreignField: 'material_number',
            as: 'part_info',
          },
        },
        {
          $unwind: {
            path: '$part_info',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'master_parts',
            localField: 'part_info.co_product_material',
            foreignField: 'material_number',
            as: 'co_part_info',
          },
        },
        {
          $unwind: {
            path: '$co_part_info',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'machine_info',
            localField: 'work_center',
            foreignField: 'work_center',
            as: 'machine_info',
          },
        },
        {
          $unwind: {
            path: '$machine_info',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: collectionNames.assignOrder,
            let: { orderId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$production_order_id', '$$orderId'] },
                },
              },
            ],
            as: 'all_assign_orders',
          },
        },
        {
          $lookup: {
            from: collectionNames.assignOrder,
            let: { orderId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$production_order_id', '$$orderId'] },
                  status: 'active',
                },
              },
            ],
            as: 'active_assign_orders',
          },
        },
        {
          $match: {
            active_assign_orders: { $size: 0 },
          },
        },
        {
          $lookup: {
            from: collectionNames.assignOrder,
            let: { orderId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$production_order_id', '$$orderId'] },
                  status: 'suspended',
                },
              },
            ],
            as: 'assign_orders',
          },
        },
        {
          $project: {
            _id: 1,
            plant: 1,
            order_id: 1,
            material_number: 1,
            material_description: 1,
            basic_start_date: 1,
            basic_finish_date: 1,
            target_quantity: 1,
            unit: 1,
            scrap_quantity: 1,
            mrp_controller: 1,
            mrp_controller_name: 1,
            production_supervisor: 1,
            group_routing: 1,
            operation_task_list_number: 1,
            counter_number: 1,
            sequence_number: 1,
            task_list_node: 1,
            group_counter: 1,
            activity: 1,
            operation_short_text: 1,
            object_id: 1,
            work_center: 1,
            machine_number: '$machine_info.machine_number',
            setup_time_1: 1,
            setup_time_2: 1,
            setup_time_3: 1,
            lot: 1,
            plan_cycle_time: 1,
            plan_actual_time: 1,
            plan_target_day: 1,
            show_job: 1,
            log_date: 1,
            condition_amount: 1,
            assign_stage: 1,
            sql_active: 1,
            sql_last_sync: 1,
            createdAt: 1,
            updatedAt: 1,
            assign_orders: 1,
            // ข้อมูลจาก part_info
            is_co_product: {
              $ifNull: ['$part_info.is_co_product', false],
            },
            co_product_material_number: '$part_info.co_product_material',
            co_product_part_name: '$co_part_info.part_name',
            co_product_part_number: '$co_part_info.part_number',
          },
        },
      ]);

      return {
        status: 'success',
        message: `get job waiting on ${workCenter} success`,
        data: jobWaiting,
      };
    } catch (error) {
      console.error((error as Error).message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to get job waiting : ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
