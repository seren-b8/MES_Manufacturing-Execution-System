import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import moment from 'moment';
import { Model, Types } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { ProductionPlanning } from 'src/schema/production-planning';
import { MasterPart } from 'src/schema/master_parts.schema';
import { User } from 'src/schema/user.schema';
import {
  CreatePlanningDto,
  PlanningQueryDto,
  UpdatePlanningDto,
} from '../dto/planning.dto';
import { toObjectId } from 'src/shared/utils/type.utils';

@Injectable()
export class ProductionPlanningService {
  constructor(
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,
    @InjectModel(ProductionPlanning.name)
    private readonly productionPlanningModel: Model<ProductionPlanning>,
    @InjectModel(AssignOrder.name)
    private readonly assignOrderModel: Model<AssignOrder>,
    @InjectModel(MasterPart.name)
    private readonly masterPartModel: Model<MasterPart>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async create(
    dto: CreatePlanningDto,
    userId: string,
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      // Validate references
      if (
        dto.production_order_id &&
        !Types.ObjectId.isValid(dto.production_order_id)
      ) {
        throw new Error('Invalid production_order_id');
      }

      if (dto.material_id && !Types.ObjectId.isValid(dto.material_id)) {
        throw new Error('Invalid material_id');
      }

      // Check for sequence conflicts
      const conflictCheck = await this.productionPlanningModel.findOne({
        machine_number: dto.machine_number,
        planned_date: dto.planned_date,
        sequence_order: dto.sequence_order,
      });

      if (conflictCheck) {
        throw new Error(
          `Sequence order ${dto.sequence_order} already exists for this machine and date`,
        );
      }

      // Create planning
      const newPlanning = new this.productionPlanningModel({
        ...dto,
        production_order_id: dto.production_order_id
          ? toObjectId(dto.production_order_id)
          : undefined,
        material_id: dto.material_id ? toObjectId(dto.material_id) : undefined,
        planned_by: toObjectId(userId),
      });

      const savedPlanning = await newPlanning.save();

      return {
        status: 'success',
        message: 'Production planning created successfully',
        data: [savedPlanning],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to create production planning: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Read All
  async findAll(
    query: PlanningQueryDto = {},
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      const filter: any = {};

      if (query.machine_number) filter.machine_number = query.machine_number;
      if (query.planned_date) filter.planned_date = query.planned_date;
      if (query.plan_type) filter.plan_type = query.plan_type;
      if (query.status) filter.status = query.status;

      const planning = await this.productionPlanningModel
        .find(filter)
        .populate('production_order_id')
        .populate('material_id')
        .populate('planned_by', 'employee_id')
        .sort({ planned_date: -1, sequence_order: 1 })
        .lean();

      return {
        status: 'success',
        message: 'Retrieved production planning successfully',
        data: planning,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to retrieve production planning: ' +
            (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Read One
  async findById(id: string): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid planning ID');
      }

      const planning = await this.productionPlanningModel
        .findById(id)
        .populate('production_order_id')
        .populate('material_id')
        .populate('planned_by', 'employee_id')
        .lean();

      if (!planning) {
        throw new Error('Production planning not found');
      }

      return {
        status: 'success',
        message: 'Production planning retrieved successfully',
        data: [planning],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to retrieve production planning: ' +
            (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // Update
  async update(
    id: string,
    dto: UpdatePlanningDto,
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid planning ID');
      }

      const existingPlanning = await this.productionPlanningModel.findById(id);
      if (!existingPlanning) {
        throw new Error('Production planning not found');
      }

      // Check sequence conflict if updating sequence_order
      if (
        dto.sequence_order &&
        dto.sequence_order !== existingPlanning.sequence_order
      ) {
        const conflictCheck = await this.productionPlanningModel.findOne({
          _id: { $ne: id },
          machine_number: existingPlanning.machine_number,
          planned_date: existingPlanning.planned_date,
          sequence_order: dto.sequence_order,
        });

        if (conflictCheck) {
          throw new Error(
            `Sequence order ${dto.sequence_order} already exists for this machine and date`,
          );
        }
      }

      const updatedPlanning = await this.productionPlanningModel
        .findByIdAndUpdate(id, dto, { new: true })
        .populate('production_order_id')
        .populate('material_id')
        .populate('planned_by', 'employee_id')
        .lean();

      return {
        status: 'success',
        message: 'Production planning updated successfully',
        data: [updatedPlanning],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to update production planning: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Delete
  async delete(id: string): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid planning ID');
      }

      const planning = await this.productionPlanningModel.findById(id);
      if (!planning) {
        throw new Error('Production planning not found');
      }

      // Check if planning can be deleted (not in progress or completed)
      if (
        planning.status === 'in_progress' ||
        planning.status === 'completed'
      ) {
        throw new Error(
          'Cannot delete planning that is in progress or completed',
        );
      }

      await this.productionPlanningModel.findByIdAndDelete(id);

      return {
        status: 'success',
        message: 'Production planning deleted successfully',
        data: [],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to delete production planning: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Get by Machine and Date
  async findByMachineAndDate(
    machineNumber: string,
    date: string,
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      const targetDate = moment(date).startOf('day').toDate();

      const planning = await this.productionPlanningModel
        .find({
          machine_number: machineNumber,
          planned_date: targetDate,
        })
        .populate('production_order_id')
        .populate('material_id')
        .populate('planned_by', 'employee_id')
        .sort({ sequence_order: 1 })
        .lean();

      return {
        status: 'success',
        message: `Retrieved planning for machine ${machineNumber} on ${date}`,
        data: planning,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to retrieve machine planning: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Reorder sequences
  async reorderSequences(
    machineNumber: string,
    date: string,
    sequences: { id: string; sequence: number }[],
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      const targetDate = moment(date).startOf('day').toDate();

      // Update sequences in bulk
      const updates = sequences.map(async (item) => {
        if (!Types.ObjectId.isValid(item.id)) {
          throw new Error(`Invalid planning ID: ${item.id}`);
        }

        return this.productionPlanningModel.findByIdAndUpdate(
          item.id,
          { sequence_order: item.sequence },
          { new: true },
        );
      });

      await Promise.all(updates);

      // Return updated planning
      return this.findByMachineAndDate(machineNumber, date);
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to reorder sequences: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Update status
  async updateStatus(
    id: string,
    status: string,
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid planning ID');
      }

      const validStatuses = [
        'draft',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
      ];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const updatedPlanning = await this.productionPlanningModel
        .findByIdAndUpdate(id, { status }, { new: true })
        .populate('production_order_id')
        .populate('material_id')
        .populate('planned_by', 'employee_id')
        .lean();

      if (!updatedPlanning) {
        throw new Error('Production planning not found');
      }

      return {
        status: 'success',
        message: 'Planning status updated successfully',
        data: [updatedPlanning],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update status: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
