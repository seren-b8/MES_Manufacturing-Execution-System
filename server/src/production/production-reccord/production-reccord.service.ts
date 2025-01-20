import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AssignEmployee } from 'src/schema/assign-employee.schema';
import { MasterNotGood } from 'src/schema/master-not-good.schema';
import { ProductionRecord } from 'src/schema/production-record.schema';
import {
  CreateProductionRecordDto,
  UpdateProductionRecordDto,
} from '../dto/production-reccord.dto';
import { ResponseFormat } from 'src/interface';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { MachineInfo } from 'src/schema/machine-info.schema';

@Injectable()
export class ProductionRecordService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private productionRecordModel: Model<ProductionRecord>,
    @InjectModel('AssignEmployee')
    private assignEmployeeModel: Model<AssignEmployee>,
    @InjectModel('MasterNotGood')
    private masterNotGoodModel: Model<MasterNotGood>,
    @InjectModel(AssignOrder.name)
    private assignOrderModel: Model<AssignOrder>,
  ) {}
  @InjectModel('MachineInfo')
  private machineInfoModel: Model<MachineInfo>;

  async create(
    createDto: CreateProductionRecordDto,
  ): Promise<ResponseFormat<ProductionRecord>> {
    try {
      // Check if AssignEmployee exists and is active
      const assignEmployee = await this.assignEmployeeModel
        .findById(createDto.assign_employee_id)
        .populate('assign_order_id');

      const AssignOrder = await this.assignOrderModel.findById(
        assignEmployee.assign_order_id,
      );

      if (!AssignOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: 'AssignOrder not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (!assignEmployee || assignEmployee.status !== 'active') {
        throw new HttpException(
          {
            status: 'error',
            message: 'AssignEmployee not found or not active',
            data: [assignEmployee],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate quantity
      if (createDto.quantity <= 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Quantity must be greater than 0',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check machine counter if recording good products
      if (!createDto.is_not_good) {
        const machine = await this.machineInfoModel.findOne({
          machine_number: AssignOrder.machine_number,
        });

        if (!machine) {
          throw new HttpException(
            {
              status: 'error',
              message: 'Machine not found',
              data: [],
            },
            HttpStatus.NOT_FOUND,
          );
        }

        const currentCounter = machine.counter || 0;

        if (createDto.quantity > currentCounter) {
          throw new HttpException(
            {
              status: 'error',
              message: `Cannot record ${createDto.quantity} pieces. Current counter is only ${currentCounter}`,
              data: [
                {
                  machine_number: AssignOrder.machine_number,
                  requested_quantity: createDto.quantity,
                  current_counter: currentCounter,
                },
              ],
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Update machine counter after validation
        await this.machineInfoModel.findOneAndUpdate(
          { machine_number: AssignOrder.machine_number },
          { $set: { counter: currentCounter - createDto.quantity } },
        );
      }

      // If it's a not-good record, validate master_not_good_id
      if (createDto.is_not_good) {
        if (!createDto.master_not_good_id) {
          throw new HttpException(
            {
              status: 'error',
              message: 'master_not_good_id is required for not-good records',
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        const masterNotGood = await this.masterNotGoodModel.findById(
          createDto.master_not_good_id,
        );
        if (!masterNotGood) {
          throw new HttpException(
            {
              status: 'error',
              message: 'MasterNotGood not found',
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const newRecord = new this.productionRecordModel({
        ...createDto,
        assign_order_id: AssignOrder._id,
        assign_employee_id: new Types.ObjectId(createDto.assign_employee_id),
        master_not_good_id: createDto.master_not_good_id
          ? new Types.ObjectId(createDto.master_not_good_id)
          : undefined,
      });

      const savedRecord = await newRecord.save();

      // Update assign order summary
      await this.updateAssignOrderSummary(createDto.assign_employee_id);

      return {
        status: 'success',
        message: 'Production record created successfully',
        data: [savedRecord],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: error.message || 'Failed to create production record',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByAssignEmployee(
    assignEmployeeId: string,
  ): Promise<ResponseFormat<ProductionRecord>> {
    try {
      const records = await this.productionRecordModel
        .find({ assign_employee_id: new Types.ObjectId(assignEmployeeId) })
        .populate('master_not_good_id', 'case_english case_thai')
        .sort({ createdAt: -1 });

      return {
        status: 'success',
        message: 'Production records retrieved successfully',
        data: records,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve production records',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateProductionRecordDto,
  ): Promise<ResponseFormat<ProductionRecord>> {
    try {
      const record = await this.productionRecordModel.findById(id);
      if (!record) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Production record not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (updateDto.quantity && updateDto.quantity <= 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Quantity must be greater than 0',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedRecord = await this.productionRecordModel
        .findByIdAndUpdate(id, { $set: updateDto }, { new: true })
        .populate('master_not_good_id', 'case_english case_thai');

      // Update assign order summary if quantity changed
      if (updateDto.quantity) {
        await this.updateAssignOrderSummary(
          record.assign_employee_id.toString(),
        );
      }

      return {
        status: 'success',
        message: 'Production record updated successfully',
        data: [updatedRecord],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update production record',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async updateAssignOrderSummary(assignEmployeeId: string) {
    try {
      const assignEmployee = await this.assignEmployeeModel
        .findById(assignEmployeeId)
        .populate('assign_order_id');

      if (!assignEmployee) return;

      // Calculate totals
      const records = await this.productionRecordModel.find({
        assign_employee_id: new Types.ObjectId(assignEmployeeId),
      });

      const summary = records.reduce(
        (acc, record) => {
          if (record.is_not_good) {
            acc.total_not_good_quantity += record.quantity;
          } else {
            acc.total_good_quantity += record.quantity;
          }
          return acc;
        },
        { total_good_quantity: 0, total_not_good_quantity: 0 },
      );

      // Update assign order summary
      await this.assignOrderModel.findByIdAndUpdate(
        assignEmployee.assign_order_id,
        {
          $set: {
            current_summary: {
              ...summary,
              last_update: new Date(),
            },
          },
        },
      );
    } catch (error) {
      console.error('Failed to update assign order summary:', error);
    }
  }
}
