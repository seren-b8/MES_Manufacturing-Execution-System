import { HttpStatus, HttpException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateAssignOrderDto,
  UpdateAssignOrderDto,
} from '../dto/assign-order.dto';
import { ResponseFormat } from 'src/shared/interface';
import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';
import { ProductionOrder } from 'src/shared/modules/schema/production-order.schema';
import { AssignEmployeeService } from '../assign-employee/assign-employee.service';

type OrderStatus = 'active' | 'completed' | 'suspended';

@Injectable()
export class AssignOrderService {
  private readonly statusTransitions = {
    // pending: ['active'], // pending can only go to active
    active: ['completed', 'suspended'], // active can go to completed or suspended
    completed: [], // completed is terminal state
    suspended: ['active'], // suspended can go back to active
  };

  constructor(
    @InjectModel('AssignOrder') private assignOrderModel: Model<AssignOrder>,
    @InjectModel('ProductionOrder')
    private productionOrderModel: Model<ProductionOrder>,
    private assignEmployeeService: AssignEmployeeService,
  ) {}

  async create(
    createDto: CreateAssignOrderDto,
  ): Promise<ResponseFormat<AssignOrder>> {
    try {
      const order = await this.productionOrderModel.findById({
        _id: createDto.production_order_id,
        assign_stage: false,
      });
      if (!order) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Production order not found or already assigned',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }
      const checkOrder = await this.assignOrderModel.aggregate([
        {
          $match: {
            status: 'active',
          },
        },
        {
          $lookup: {
            from: 'production_order',
            localField: 'production_order_id',
            foreignField: '_id',
            as: 'production_order',
          },
        },
        {
          $unwind: '$production_order',
        },
        {
          $match: {
            'production_order.order_id': order.order_id,
          },
        },
      ]);

      if (checkOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: `Order is already assigned to machine ${checkOrder[0].machine_number}`,
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const assignOrder = await this.assignOrderModel.findOne({
        machine_number: createDto.machine_number,
        status: 'active',
      });

      if (assignOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine is already assigned to an order',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const newAssignOrder = new this.assignOrderModel({
        ...createDto,
        datetime_open_order: new Date(),
        status: 'active',
        current_summary: {
          total_good_quantity: 0,
          total_not_good_quantity: 0,
          last_update: new Date(),
        },
      });

      const savedOrder = await newAssignOrder.save();

      await this.productionOrderModel.findByIdAndUpdate(
        createDto.production_order_id,
        { assign_stage: true },
      );

      return {
        status: 'success',
        message: 'Assign order created successfully',
        data: [savedOrder],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create assign order',
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(
    machine_number?: string,
    status?: string,
  ): Promise<ResponseFormat<AssignOrder>> {
    try {
      const query: any = {};
      if (machine_number) query.machine_number = machine_number;
      if (status) query.status = status;

      const orders = await this.assignOrderModel
        .find(query)
        .sort({ datetime_open_order: -1 });

      return {
        status: 'success',
        message: 'Assign orders retrieved successfully',
        data: orders,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve assign orders',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<ResponseFormat<AssignOrder>> {
    try {
      const order = await this.assignOrderModel.findById(id);
      if (!order) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Assign order not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Assign order retrieved successfully',
        data: [order],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve assign order',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private isValidStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): boolean {
    const allowedTransitions = this.statusTransitions[currentStatus];
    if (!allowedTransitions) {
      return false;
    }
    return allowedTransitions.includes(newStatus);
  }

  async update(
    id: string,
    updateDto: UpdateAssignOrderDto,
  ): Promise<ResponseFormat<AssignOrder>> {
    try {
      const order = await this.assignOrderModel.findById(id);
      if (!order) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Assign order not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Type assertion to ensure order.status is treated as OrderStatus
      const currentStatus = order.status as OrderStatus;

      // Validate status transition if status is being updated
      if (updateDto.status) {
        if (!this.isValidStatusTransition(currentStatus, updateDto.status)) {
          throw new HttpException(
            {
              status: 'error',
              message: `Invalid status transition from ${currentStatus} to ${updateDto.status}`,
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Additional validation for completed status
        if (
          updateDto.status === 'completed' &&
          !updateDto.datetime_close_order
        ) {
          throw new HttpException(
            {
              status: 'error',
              message:
                'datetime_close_order is required when completing an order',
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const updatedOrder = await this.assignOrderModel.findByIdAndUpdate(
        id,
        { $set: updateDto },
        { new: true },
      );
      await this.assignEmployeeService.closeByAssignOrder(id);

      return {
        status: 'success',
        message: 'Assign order updated successfully',
        data: [updatedOrder],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update assign order',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
