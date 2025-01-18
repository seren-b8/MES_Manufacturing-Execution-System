import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateAssignOrderDto,
  UpdateAssignOrderDto,
} from '../dto/assign-order.dto';
import { ResponseFormat } from 'src/interface';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';

@Injectable()
export class AssignOrderService {
  constructor(
    @InjectModel('AssignOrder') private assignOrderModel: Model<AssignOrder>,
    @InjectModel('ProductionOrder')
    private productionOrderModel: Model<ProductionOrder>,
  ) {}

  async create(
    createDto: CreateAssignOrderDto,
  ): Promise<ResponseFormat<AssignOrder>> {
    try {
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

      // Validate status transition
      if (
        updateDto.status &&
        !this.isValidStatusTransition(order.status, updateDto.status)
      ) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Invalid status transition',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedOrder = await this.assignOrderModel.findByIdAndUpdate(
        id,
        { $set: updateDto },
        { new: true },
      );

      return {
        status: 'success',
        message: 'Assign order updated successfully',
        data: [updatedOrder],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error.message || 'Failed to update assign order',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private isValidStatusTransition(
    currentStatus: string,
    newStatus: string,
  ): boolean {
    const validTransitions = {
      pending: ['active', 'suspended'],
      active: ['completed', 'suspended'],
      suspended: ['active', 'completed'],
      completed: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus);
  }
}
