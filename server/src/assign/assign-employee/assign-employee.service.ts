// assign-employee.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/interface';
import { AssignEmployee } from 'src/schema/assign-employee.schema';
import { QueryAssignEmployeeDto } from '../dto/query-assign-employee.dto';
import { CreateAssignEmployeeDto } from '../dto/create-assign-eployee.dto';
import { UpdateAssignEmployeeDto } from '../dto/update-assign-employee.dto';

@Injectable()
export class AssignEmployeeService {
  constructor(
    @InjectModel(AssignEmployee.name)
    private assignEmployeeModel: Model<AssignEmployee>,
  ) {}

  async createAssignment(
    createDto: CreateAssignEmployeeDto,
  ): Promise<ResponseFormat<any>> {
    try {
      // Check for existing active assignment
      const existingAssignment = await this.assignEmployeeModel.findOne({
        employee_id: createDto.employee_id,
        status: 'active',
        assign_order_id: createDto.assign_order_id,
      });

      if (existingAssignment) {
        throw new BadRequestException(
          'Employee already has an active assignment',
        );
      }

      const assignment = new this.assignEmployeeModel({
        ...createDto,
        datetime_open_order: new Date(),
        status: 'active',
      });

      await assignment.save();

      return {
        status: 'success',
        message: 'Assignment created successfully',
        data: assignment,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message || 'Failed to create assignment',
        data: null,
      };
    }
  }

  async findAll(
    queryDto: QueryAssignEmployeeDto,
  ): Promise<ResponseFormat<any>> {
    try {
      const query: any = {};

      // Build query based on provided filters
      if (queryDto.status) {
        query.status = queryDto.status;
      }
      if (queryDto.work_center) {
        query.work_center = queryDto.work_center;
      }
      if (queryDto.machine_number) {
        query.machine_number = queryDto.machine_number;
      }
      if (queryDto.employee_id) {
        query.employee_id = queryDto.employee_id;
      }

      const assignments = await this.assignEmployeeModel
        .find(query)
        .sort({ datetime_open_order: -1 })
        .limit(queryDto.limit || 10)
        .skip(queryDto.skip || 0);

      const total = await this.assignEmployeeModel.countDocuments(query);

      return {
        status: 'success',
        message: 'Assignments retrieved successfully',
        data: {
          assignments,
          total,
          page: Math.floor((queryDto.skip || 0) / (queryDto.limit || 10)) + 1,
          pages: Math.ceil(total / (queryDto.limit || 10)),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to retrieve assignments',
        data: [],
      };
    }
  }

  async findOne(id: string): Promise<ResponseFormat<any>> {
    try {
      const assignment = await this.assignEmployeeModel.findById(id);
      if (!assignment) {
        throw new NotFoundException('Assignment not found');
      }

      return {
        status: 'success',
        message: 'Assignment retrieved successfully',
        data: assignment,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message || 'Failed to retrieve assignment',
        data: [],
      };
    }
  }

  async update(
    id: string,
    updateDto: UpdateAssignEmployeeDto,
  ): Promise<ResponseFormat<any>> {
    try {
      const assignment = await this.assignEmployeeModel.findById(id);
      if (!assignment) {
        throw new NotFoundException('Assignment not found');
      }

      // Prevent updating completed assignments
      if (assignment.status === 'completed') {
        throw new BadRequestException('Cannot update completed assignment');
      }

      const updatedAssignment =
        await this.assignEmployeeModel.findByIdAndUpdate(id, updateDto, {
          new: true,
        });

      return {
        status: 'success',
        message: 'Assignment updated successfully',
        data: updatedAssignment,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message || 'Failed to update assignment',
        data: [],
      };
    }
  }

  async updateStatus(id: string, status: string): Promise<ResponseFormat<any>> {
    try {
      const assignment = await this.assignEmployeeModel.findById(id);
      if (!assignment) {
        throw new NotFoundException('Assignment not found');
      }

      if (assignment.status === status) {
        throw new BadRequestException(`Assignment is already ${status}`);
      }

      const updatedAssignment =
        await this.assignEmployeeModel.findByIdAndUpdate(
          id,
          { status },
          { new: true },
        );

      return {
        status: 'success',
        message: `Assignment ${status} successfully`,
        data: updatedAssignment,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message || 'Failed to update assignment status',
        data: [],
      };
    }
  }

  async remove(id: string): Promise<ResponseFormat<any>> {
    try {
      const assignment = await this.assignEmployeeModel.findById(id);
      if (!assignment) {
        throw new NotFoundException('Assignment not found');
      }

      await this.assignEmployeeModel.findByIdAndDelete(id);

      return {
        status: 'success',
        message: 'Assignment deleted successfully',
        data: [],
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message || 'Failed to delete assignment',
        data: [],
      };
    }
  }
}
