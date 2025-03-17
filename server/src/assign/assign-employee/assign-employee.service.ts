// assign-employee.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';
import {
  CloseByUserDto,
  CreateAssignEmployeeDto,
  UpdateAssignEmployeeDto,
} from '../dto/assign-employee.dto';
import { User } from 'src/shared/modules/schema/user.schema';
import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';
import e from 'express';
import { IAssignEmployeeDocument } from 'src/shared/interface/assign.emp';
import * as moment from 'moment-timezone';

@Injectable()
export class AssignEmployeeService {
  constructor(
    @InjectModel('AssignEmployee')
    private assignEmployeeModel: Model<AssignEmployee>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('AssignOrder') private assignOrderModel: Model<AssignOrder>,
  ) {}

  async create(
    createDto: CreateAssignEmployeeDto,
  ): Promise<ResponseFormat<IAssignEmployeeDocument>> {
    try {
      // Check if user exists and is active
      const user = await this.userModel.findById(createDto.user_id);
      if (!user) {
        throw new HttpException(
          {
            status: 'error',
            message: 'User not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if assign order exists and is active
      const assignOrder = await this.assignOrderModel.findById(
        createDto.assign_order_id,
      );
      if (!assignOrder || assignOrder.status !== 'active') {
        throw new HttpException(
          {
            status: 'error',
            message: 'Assign order not found or not active',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if user is already assigned to an active order
      const existingAssignment = await this.assignEmployeeModel.findOne({
        user_id: createDto.user_id,
        status: 'active',
        assign_order_id: createDto.assign_order_id,
      });

      if (existingAssignment) {
        throw new HttpException(
          {
            status: 'error',
            message: 'User is already in the assign order',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Create new assignment
      const newAssignment = new this.assignEmployeeModel({
        ...createDto,
        status: 'active',
        log_date: moment().toDate(),
      });

      const savedAssignment = await newAssignment.save();
      const typedAssignment =
        savedAssignment.toObject() as IAssignEmployeeDocument;

      // NEW CODE: Find other active orders on the same machine and create assignments for them
      try {
        // Get the machine number from the current assign order
        const machineNumber = assignOrder.machine_number;

        // Find other active orders for the same machine
        const otherActiveOrders = await this.assignOrderModel.find({
          machine_number: machineNumber,
          status: 'active',
          _id: { $ne: createDto.assign_order_id }, // Exclude current order
        });

        // For each active order, create an assignment if one doesn't exist
        for (const order of otherActiveOrders) {
          // Check if the user is already assigned to this order
          const existingOtherAssignment =
            await this.assignEmployeeModel.findOne({
              user_id: createDto.user_id,
              status: 'active',
              assign_order_id: order._id,
            });

          // If no existing assignment, create one
          if (!existingOtherAssignment) {
            await this.assignEmployeeModel.create({
              user_id: createDto.user_id,
              assign_order_id: order._id,
              status: 'active',
              log_date: moment().toDate(),
            });
          }
        }
      } catch (autoAssignError) {
        // Log error but don't fail the primary assignment
        console.error(
          'Error creating auto-assignments for other orders:',
          autoAssignError,
        );
      }

      return {
        status: 'success',
        message: 'Employee assigned successfully',
        data: [typedAssignment],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to assign employee',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByAssignOrder(
    assignOrderId: string,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      const assignments = await this.assignEmployeeModel
        .find({ assign_order_id: assignOrderId })
        .sort({ log_date: -1 });

      return {
        status: 'success',
        message: 'Employee assignments retrieved successfully',
        data: assignments,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve employee assignments',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findActiveByUser(
    userId: string,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      const assignments = await this.assignEmployeeModel.find({
        user_id: userId,
        status: 'active',
      });

      return {
        status: 'success',
        message: 'Active assignments retrieved successfully',
        data: assignments,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve active assignments',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateAssignEmployeeDto,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      const assignment = await this.assignEmployeeModel.findById(id);
      if (!assignment) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Assignment not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Validate status transition
      if (
        updateDto.status &&
        !this.isValidStatusTransition(assignment.status, updateDto.status)
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

      const updatedAssignment =
        await this.assignEmployeeModel.findByIdAndUpdate(
          id,
          { $set: updateDto },
          { new: true },
        );

      return {
        status: 'success',
        message: 'Assignment updated successfully',
        data: [updatedAssignment],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update assignment',
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
      active: ['completed', 'suspended'],
      suspended: ['active', 'completed'],
      completed: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus);
  }

  async closeByAssignOrder(
    assignOrderId: string,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      const activeAssignments = await this.assignEmployeeModel.find({
        assign_order_id: assignOrderId,
        status: 'active',
      });

      const updatePromises = activeAssignments.map((assignment) =>
        this.assignEmployeeModel.findByIdAndUpdate(
          assignment._id,
          { $set: { status: 'completed' } },
          { new: true },
        ),
      );

      const updatedAssignments = await Promise.all(updatePromises);

      return {
        status: 'success',
        message: 'Assignments closed successfully',
        data: updatedAssignments,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to close assignments',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async closeByUser(
    closeByUserDto: CloseByUserDto,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      console.log('Closing assignments for:', closeByUserDto);

      // Validate ObjectIds
      if (!isValidObjectId(closeByUserDto.assign_order_id)) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Invalid assign order ID format',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Find active assignments
      const activeAssignments = await this.assignEmployeeModel.find({
        user_id: closeByUserDto.user_id,
        status: 'active',
        assign_order_id: closeByUserDto.assign_order_id,
      });

      // console.log('Found active assignments:', activeAssignments);

      if (!activeAssignments || activeAssignments.length === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'No active assignments found for this user and order',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Update each assignment
      const updatedAssignments = [];
      for (const assignment of activeAssignments) {
        try {
          const updated = await this.assignEmployeeModel.findByIdAndUpdate(
            assignment._id,
            {
              $set: {
                status: 'completed',
                updated_at: moment().toDate(),
              },
            },
            { new: true, runValidators: true },
          );

          if (updated) {
            updatedAssignments.push(updated);
          }
        } catch (updateError) {
          console.error(
            'Error updating assignment:',
            assignment._id,
            updateError,
          );
        }
      }

      if (updatedAssignments.length === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Failed to update any assignments',
            data: [],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        status: 'success',
        message: `Successfully closed ${updatedAssignments.length} assignment(s)`,
        data: updatedAssignments,
      };
    } catch (error) {
      console.error('Error in closeByUser:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to close assignments`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
