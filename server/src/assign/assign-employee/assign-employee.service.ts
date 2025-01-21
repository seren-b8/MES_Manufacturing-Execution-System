// assign-employee.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';
import {
  CreateAssignEmployeeDto,
  UpdateAssignEmployeeDto,
} from '../dto/assign-employee.dto';
import { User } from 'src/shared/modules/schema/user.schema';
import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';

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
  ): Promise<ResponseFormat<AssignEmployee>> {
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
      });

      if (existingAssignment) {
        throw new HttpException(
          {
            status: 'error',
            message: 'User is already assigned to an active order',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Create new assignment
      const newAssignment = new this.assignEmployeeModel({
        ...createDto,
        status: 'active',
        log_date: new Date(),
      });

      const savedAssignment = await newAssignment.save();

      return {
        status: 'success',
        message: 'Employee assigned successfully',
        data: [savedAssignment],
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
      const assignment = await this.assignEmployeeModel.findOne({
        user_id: userId,
        status: 'active',
      });

      return {
        status: 'success',
        message: 'Active assignment retrieved successfully',
        data: assignment ? [assignment] : [],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve active assignment',
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
}
