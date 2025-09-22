import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment-timezone';
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
import { machine } from 'os';

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

  private async getNextSequenceOrder(machineNumber: string): Promise<number> {
    const existingPlanning = await this.productionPlanningModel
      .find({
        machine_number: machineNumber,
        status: { $nin: ['completed', 'cancelled'] },
      })
      .sort({ sequence_order: -1 })
      .limit(1)
      .lean();

    return existingPlanning.length > 0
      ? existingPlanning[0].sequence_order + 1
      : 1;
  }

  private async shiftSequencesFromPosition(
    machineNumber: string,
    fromPosition: number,
  ): Promise<void> {
    await this.productionPlanningModel.updateMany(
      {
        machine_number: machineNumber,
        sequence_order: { $gte: fromPosition },
        status: { $nin: ['completed', 'cancelled'] },
      },
      {
        $inc: { sequence_order: 1 },
      },
    );
  }

  private async compactSequences(machineNumber: string): Promise<boolean> {
    const allPlanning = await this.productionPlanningModel.aggregate([
      {
        $match: {
          machine_number: machineNumber,
          status: { $nin: ['completed', 'cancelled'] },
        },
      },
      {
        $addFields: {
          status_priority: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'in_progress'] }, then: 1 },
                { case: { $eq: ['$status', 'confirmed'] }, then: 2 },
                { case: { $eq: ['$status', 'draft'] }, then: 3 },
              ],
              default: 4,
            },
          },
        },
      },
      {
        $sort: {
          status_priority: 1,
          sequence_order: 1,
        },
      },
      {
        $project: {
          status_priority: 0, // ไม่ต้องการ field นี้ใน result
        },
      },
    ]);

    // ตรวจสอบว่าต้องปรับหรือไม่
    const needsUpdate = allPlanning.some(
      (planning, index) => planning.sequence_order !== index + 1,
    );

    if (!needsUpdate) {
      return false;
    }

    // อัพเดท
    const updates = allPlanning
      .map((planning, index) => {
        const newSequence = index + 1;
        if (planning.sequence_order !== newSequence) {
          return this.productionPlanningModel.findByIdAndUpdate(planning._id, {
            sequence_order: newSequence,
          });
        }
        return null;
      })
      .filter(Boolean);

    await Promise.all(updates);
    return true;
  }

  // เพิ่มใน ProductionPlanningService
  private async updatePlanningStatusByBusinessRules(
    planningId: string,
  ): Promise<string> {
    // Query แยก เพื่อหลีกเลี่ยง type issue
    const planning = await this.productionPlanningModel
      .findById(planningId)
      .lean();

    if (!planning) return 'draft';

    // Query production order แยก
    const productionOrder = await this.productionOrderModel
      .findById(planning.production_order_id)
      .lean();

    // Rule 1: ตรวจสอบ SQL Active status
    if (productionOrder?.sql_active === false) {
      await this.productionPlanningModel.findByIdAndUpdate(planningId, {
        status: 'completed',
      });
      return 'completed';
    }

    // Rule 2: ตรวจสอบ AssignOrder active
    const activeAssignOrder = await this.assignOrderModel.findOne({
      production_order_id: planning.production_order_id,
      status: 'active',
    });

    if (activeAssignOrder) {
      if (planning.status !== 'in_progress') {
        await this.productionPlanningModel.findByIdAndUpdate(planningId, {
          status: 'in_progress',
        });
        return 'in_progress';
      }
    } else {
      if (planning.status === 'in_progress') {
        await this.productionPlanningModel.findByIdAndUpdate(planningId, {
          status: 'confirmed',
        });
        return 'confirmed';
      }
    }

    return planning.status;
  }

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

      let finalSequenceOrder: number;

      if (dto.sequence_order) {
        // กรณีระบุ sequence มา - ต้องแทรกและเลื่อนของเดิม
        await this.shiftSequencesFromPosition(
          dto.machine_number,
          dto.sequence_order,
        );
        finalSequenceOrder = dto.sequence_order;
      } else {
        // กรณีไม่ระบุ sequence - หา sequence ถัดไปจากที่มีอยู่
        finalSequenceOrder = await this.getNextSequenceOrder(
          dto.machine_number,
        );
      }

      // Create planning
      const newPlanning = new this.productionPlanningModel({
        ...dto,
        sequence_order: finalSequenceOrder,
        production_order_id: dto.production_order_id
          ? toObjectId(dto.production_order_id)
          : undefined,
        material_id: dto.material_id ? toObjectId(dto.material_id) : undefined,
        planned_by: toObjectId(userId),
      });

      const savedPlanning = await newPlanning.save();

      // Compact sequences หลังสร้างเสร็จ
      await this.compactSequences(dto.machine_number);

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
      //     if (query.auto_sync === true) {
      //   await this.syncAllPlanningStatus(query.machine_number);
      // }
      await this.syncAllPlanningStatus(query.machine_number);

      const filter: any = {};

      if (query.machine_number) filter.machine_number = query.machine_number;
      if (query.plan_type) filter.plan_type = query.plan_type;
      if (query.status) filter.status = query.status;

      const planning = await this.productionPlanningModel.aggregate([
        { $match: filter },

        {
          $addFields: {
            status_priority: {
              $switch: {
                branches: [
                  { case: { $eq: ['$status', 'in_progress'] }, then: 1 },
                  { case: { $eq: ['$status', 'confirmed'] }, then: 2 },
                  { case: { $eq: ['$status', 'draft'] }, then: 3 },
                ],
                default: 4,
              },
            },
          },
        },

        // Lookups
        {
          $lookup: {
            from: 'production_order',
            localField: 'production_order_id',
            foreignField: '_id',
            as: 'production_order_id',
            pipeline: [{ $project: { _id: 0 } }],
          },
        },
        {
          $unwind: {
            path: '$production_order_id',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'master_parts',
            localField: 'material_id',
            foreignField: '_id',
            as: 'material_id',
            pipeline: [{ $project: { _id: 0 } }],
          },
        },
        {
          $unwind: {
            path: '$material_id',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'planned_by',
            foreignField: '_id',
            as: 'planned_by',
            pipeline: [
              {
                $project: {
                  employee_id: 1,
                  _id: 0,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$planned_by',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'machine_info',
            localField: 'machine_number',
            foreignField: 'machine_number',
            as: 'machine_info',
            pipeline: [{ $project: { line: 1, _id: 0 } }],
          },
        },
        {
          $unwind: {
            path: '$machine_info',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            line: '$machine_info.line',
          },
        },
        {
          $sort: {
            machine_number: 1,
            status_priority: 1,
            sequence_order: 1,
          },
        },
        {
          $project: {
            status_priority: 0,
            machine_info: 0,
            'man_power._id': 0,
            __v: 0,
          },
        },
      ]);

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

      await this.compactSequences(existingPlanning.machine_number);

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

      const machineNumber = planning.machine_number; // เก็บก่อนลบ

      await this.productionPlanningModel.findByIdAndDelete(id);

      await this.compactSequences(machineNumber);

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
    sequences: { id: string; sequence: number }[],
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      // เรียงลำดับตาม sequence ที่ต้องการ
      sequences.sort((a, b) => a.sequence - b.sequence);

      // อัพเดททีละรายการ
      for (let i = 0; i < sequences.length; i++) {
        const item = sequences[i];
        if (!Types.ObjectId.isValid(item.id)) {
          throw new Error(`Invalid planning ID: ${item.id}`);
        }

        await this.productionPlanningModel.findByIdAndUpdate(
          item.id,
          { sequence_order: i + 1 }, // เรียงใหม่เป็น 1, 2, 3, ...
          { new: true },
        );
      }

      // Return updated planning for this machine
      return this.findAll({ machine_number: machineNumber });
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

      const planning = await this.productionPlanningModel.findById(id);
      if (!planning) {
        throw new Error('Production planning not found');
      }

      // อัพเดทสถานะ
      const updatedPlanning = await this.productionPlanningModel
        .findByIdAndUpdate(id, { status }, { new: true })
        .populate('production_order_id')
        .populate('material_id')
        .populate('planned_by', 'employee_id')
        .lean();

      // Compact sequences สำหรับเครื่องนี้ (ไม่ต้องส่ง date)
      await this.compactSequences(planning.machine_number);

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

  async syncAllPlanningStatus(
    machineNumber?: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const createdCount =
        await this.autoCreatePlanningForActiveOrders(machineNumber);

      const filter: any = {
        status: { $nin: ['completed', 'cancelled'] },
      };

      if (machineNumber) {
        filter.machine_number = machineNumber;
      }

      const plannings = await this.productionPlanningModel
        .find(filter)
        .select('_id')
        .lean();

      const updates = await Promise.all(
        plannings.map((planning) =>
          this.updatePlanningStatusByBusinessRules(planning._id.toString()),
        ),
      );

      // Compact sequences หลังอัพเดทเสร็จ
      if (machineNumber) {
        await this.compactSequences(machineNumber);
      } else {
        // Compact ทุกเครื่อง
        const machines =
          await this.productionPlanningModel.distinct('machine_number');
        await Promise.all(
          machines.map((machine) => this.compactSequences(machine)),
        );
      }

      const changedCount = updates.filter((status) => status !== null).length;

      return {
        status: 'success',
        message: `Auto-created ${createdCount} new plans, synced ${changedCount} status updates`,
        data: [],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to sync planning status: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async autoCreatePlanningForActiveOrders(
    machineNumber?: string,
  ): Promise<number> {
    try {
      const filter: any = { status: 'active' };
      if (machineNumber) {
        filter.machine_number = machineNumber;
      }

      const activeOrders = await this.assignOrderModel
        .find(filter)
        .populate('production_order_id')
        .lean();

      let createdCount = 0;

      for (const assignOrder of activeOrders) {
        try {
          // Type safety checks
          const productionOrder = assignOrder.production_order_id as any;
          if (!productionOrder?._id) continue;

          // ตรวจสอบว่ามี planning อยู่แล้วหรือไม่
          const existingPlanning = await this.productionPlanningModel.findOne({
            production_order_id: productionOrder._id,
          });

          if (existingPlanning) continue;

          // ตรวจสอบ sql_active
          if (productionOrder.sql_active === false) continue;

          const nextSequence = await this.getNextSequenceOrder(
            assignOrder.machine_number,
          );

          await this.productionPlanningModel.create({
            machine_number: assignOrder.machine_number,
            planned_date: moment().tz('Asia/Bangkok').startOf('day').toDate(),
            plan_type: 'sap_order',
            production_order_id: toObjectId(productionOrder._id),
            total_order_quantity: productionOrder.target_quantity || 0,
            planned_quantity: productionOrder.target_quantity || 0,
            sequence_order: nextSequence,
            status: 'in_progress',
            planned_by: productionOrder.planned_by
              ? toObjectId(productionOrder.planned_by)
              : null,
            remark: 'Auto-created from active assign order',
          });

          createdCount++;
        } catch (itemError) {
          console.error(
            `Failed to create planning for assign order ${assignOrder._id}:`,
            (itemError as Error).message,
          );
          // ไม่ throw error เพื่อให้ continue กับรายการถัดไป
        }
      }

      return createdCount;
    } catch (error) {
      console.error(
        'Error in autoCreatePlanningForActiveOrders:',
        (error as Error).message,
      );
      return 0;
    }
  }

  // ใน ProductionPlanningService
  async bindProductionOrder(
    planningId: string,
    productionOrderId: string,
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(planningId)) {
        throw new Error('Invalid planning ID');
      }
      if (!Types.ObjectId.isValid(productionOrderId)) {
        throw new Error('Invalid production order ID');
      }

      // Check if planning exists
      const planning = await this.productionPlanningModel.findById(planningId);
      if (!planning) {
        throw new Error('Production planning not found');
      }

      // Check if production order exists and available
      const productionOrder =
        await this.productionOrderModel.findById(productionOrderId);
      if (!productionOrder) {
        throw new Error('Production order not found');
      }
      if (productionOrder.assign_stage === true) {
        throw new Error('Production order is already assigned');
      }
      if (productionOrder.sql_active === false) {
        throw new Error('Production order is not active in SAP');
      }

      // Unbind existing order if any
      if (planning.production_order_id) {
        await this.productionOrderModel.findByIdAndUpdate(
          planning.production_order_id,
          { assign_stage: false },
        );
      }

      // Bind new order
      const updatedPlanning = await this.productionPlanningModel
        .findByIdAndUpdate(
          planningId,
          {
            production_order_id: toObjectId(productionOrderId),
            plan_type: 'sap_order',
            total_order_quantity: productionOrder.target_quantity,
          },
          { new: true },
        )
        .populate('production_order_id')
        .populate('material_id')
        .populate('planned_by', 'employee_id')
        .lean();

      // Mark production order as assigned
      await this.productionOrderModel.findByIdAndUpdate(productionOrderId, {
        assign_stage: true,
      });

      // Compact sequences
      await this.compactSequences(planning.machine_number);

      return {
        status: 'success',
        message: 'Production order bound successfully',
        data: [updatedPlanning],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to bind production order: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async unbindProductionOrder(
    planningId: string,
  ): Promise<ResponseFormat<ProductionPlanning>> {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(planningId)) {
        throw new Error('Invalid planning ID');
      }

      // Check if planning exists
      const planning = await this.productionPlanningModel.findById(planningId);
      if (!planning) {
        throw new Error('Production planning not found');
      }

      // Unbind existing order if any
      if (planning.production_order_id) {
        await this.productionOrderModel.findByIdAndUpdate(
          planning.production_order_id,
          { assign_stage: false },
        );
      }

      // Update planning to draft
      const updatedPlanning = await this.productionPlanningModel
        .findByIdAndUpdate(
          planningId,
          {
            production_order_id: undefined,
            plan_type: 'draft_plan',
          },
          { new: true },
        )
        .populate('material_id')
        .populate('planned_by', 'employee_id')
        .lean();

      // Compact sequences
      await this.compactSequences(planning.machine_number);

      return {
        status: 'success',
        message: 'Production order unbound successfully',
        data: [updatedPlanning],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to unbind production order: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getAvailableOrders(
    materialId: string,
  ): Promise<ResponseFormat<ProductionOrder>> {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(materialId)) {
        throw new Error('Invalid material ID');
      }

      // Get material info
      const material = await this.masterPartModel.findById(materialId);
      if (!material) {
        throw new Error('Material not found');
      }

      // Find available production orders
      const availableOrders = await this.productionOrderModel
        .find({
          material_number: material.material_number,
          assign_stage: false,
          sql_active: true,
        })
        .sort({ basic_start_date: 1 })
        .lean();

      return {
        status: 'success',
        message: 'Available production orders retrieved successfully',
        data: availableOrders,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to get available orders: ' + (error as Error).message,
          data: [],
        } as ResponseFormat<never>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
