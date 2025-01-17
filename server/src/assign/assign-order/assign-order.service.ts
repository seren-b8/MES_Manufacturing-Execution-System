import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateAssignOrderDto } from '../dto/update-assign-order-dto';
import { CreateAssignOrderDto } from '../dto/create-assign-order.dto';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ResponseFormat } from 'src/interface';

@Injectable()
export class AssignOrderService {
  constructor(
    @InjectModel(AssignOrder.name) private assignOrderModel: Model<AssignOrder>,
  ) {}

  async create(
    createDto: CreateAssignOrderDto,
  ): Promise<ResponseFormat<AssignOrder[]>> {
    try {
      // Check if machine is already assigned
      const existingAssignment = await this.assignOrderModel.findOne({
        machine_number: createDto.machine_number,
        status: 'active',
      });

      if (existingAssignment) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine already has an active assignment',
            data: [],
          } as ResponseFormat<never>,
          HttpStatus.BAD_REQUEST,
        );
      }
      const newAssignment = new this.assignOrderModel({
        ...createDto,
        datetime_open_order: new Date(),
        status: 'active',
        actual_quantity: 0,
      });

      await newAssignment.save();

      return {
        status: 'success',
        message: 'Assignment created successfully',
        data: [],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create assignment: ' + error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(query: any = {}): Promise<ResponseFormat<AssignOrder[]>> {
    try {
      const assignments = await this.assignOrderModel
        .find(query)
        .sort({ datetime_open_order: -1 });

      return {
        status: 'success',
        message: 'Assignments retrieved successfully',
        data: [assignments],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve assignments: ' + error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByMachine(
    machineNumber: string,
  ): Promise<ResponseFormat<AssignOrder[]>> {
    try {
      const assignments = await this.assignOrderModel
        .find({
          machine_number: machineNumber,
          status: { $in: ['pending', 'active'] },
        })
        .sort({ datetime_open_order: -1 });

      return {
        status: 'success',
        message: 'Machine assignments retrieved successfully',
        data: [assignments],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve machine assignments: ' + error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<ResponseFormat<AssignOrder>> {
    try {
      const assignment = await this.assignOrderModel.findById(id);

      if (!assignment) {
        throw new HttpException(
          {
            status: 'error',
            message: `Assignment ${id} not found`,
            data: [],
          } as ResponseFormat<never>,
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Assignment retrieved successfully',
        data: [assignment],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve assignment: ' + error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateAssignOrderDto,
  ): Promise<ResponseFormat<AssignOrder>> {
    try {
      const assignment = await this.assignOrderModel.findById(id);

      if (!assignment) {
        throw new HttpException(
          {
            status: 'error',
            message: `Assignment ${id} not found`,
            data: [],
          } as ResponseFormat<never>,
          HttpStatus.NOT_FOUND,
        );
      }

      if (
        updateDto.status === 'completed' ||
        updateDto.status === 'suspended'
      ) {
        updateDto['datetime_close_order'] = new Date();
      }

      const updatedAssignment = await this.assignOrderModel.findByIdAndUpdate(
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
          message: 'Failed to update assignment: ' + error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateProductionCount(
    id: string,
    actualQuantity: number,
    scrapQuantity: number,
  ): Promise<ResponseFormat<AssignOrder>> {
    try {
      const assignment = await this.assignOrderModel.findById(id);

      if (!assignment) {
        throw new HttpException(
          {
            status: 'error',
            message: `Assignment ${id} not found`,
            data: [],
          } as ResponseFormat<never>,
          HttpStatus.NOT_FOUND,
        );
      }

      const updatedAssignment = await this.assignOrderModel.findByIdAndUpdate(
        id,
        {
          $set: {
            actual_quantity: actualQuantity,
            scrap_quantity: scrapQuantity,
          },
        },
        { new: true },
      );

      return {
        status: 'success',
        message: 'Production count updated successfully',
        data: [updatedAssignment],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update production count: ' + error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<ResponseFormat<[]>> {
    try {
      const assignment = await this.assignOrderModel.findById(id);

      if (!assignment) {
        throw new HttpException(
          {
            status: 'error',
            message: `Assignment ${id} not found`,
            data: [],
          } as ResponseFormat<never>,
          HttpStatus.NOT_FOUND,
        );
      }

      if (assignment.status === 'active') {
        throw new HttpException(
          {
            status: 'error',
            message: 'Cannot delete active assignment',
            data: [],
          } as ResponseFormat<never>,
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.assignOrderModel.findByIdAndDelete(id);

      return {
        status: 'success',
        message: 'Assignment deleted successfully',
        data: [],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to delete assignment: ' + error.message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
