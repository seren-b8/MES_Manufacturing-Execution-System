import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/interface';
import { ProductionOrder } from 'src/schema/production-order.schema';

@Injectable()
export class ProductionOrderService {
  constructor(
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,
  ) {}

  async findAll(query: any = {}): Promise<ResponseFormat<ProductionOrder[]>> {
    try {
      const orders = await this.productionOrderModel
        .find(query)
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
          message: 'Failed to retrieve production orders: ' + error.message,
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
        data: order,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve production order: ' + error.message,
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
        data: orders,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to retrieve production orders for work center ${workCenter}: ${error.message}`,
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
  ): Promise<ResponseFormat<ProductionOrder[]>> {
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
            error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get active production orders (not completed)
   */
  async findActiveOrders(): Promise<ResponseFormat<ProductionOrder[]>> {
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
            'Failed to retrieve active production orders: ' + error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
