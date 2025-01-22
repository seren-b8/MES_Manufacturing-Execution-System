import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';
import { MasterNotGood } from 'src/shared/modules/schema/master-not-good.schema';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import {
  CreateProductionRecordDto,
  UpdateProductionRecordDto,
} from '../dto/production-reccord.dto';
import { ResponseFormat } from 'src/shared/interface';
import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';
import { MachineInfo } from 'src/shared/modules/schema/machine-info.schema';

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
      const assignOrder = await this.assignOrderModel.findById(
        createDto.assign_order_id,
      );

      if (!assignOrder || assignOrder[0].active !== 'active') {
        throw new HttpException(
          {
            status: 'error',
            message: 'AssignOrder not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if AssignEmployee exists and is active
      const assignEmployees = await this.assignEmployeeModel.find({
        assign_order_id: assignOrder._id,
        status: 'active',
      });

      if (!assignEmployees || assignEmployees.length === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'No active assigned employees found for this order',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const assignEmployeeIds = assignEmployees.map((emp) => emp._id);

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
          machine_number: assignOrder.machine_number,
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
                  machine_number: assignOrder.machine_number,
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
          { machine_number: assignOrder.machine_number },
          { $inc: { counter: -createDto.quantity } },
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
        await this.machineInfoModel.findOneAndUpdate(
          { machine_number: assignOrder.machine_number },
          { $inc: { counter: -createDto.quantity } },
        );
      }

      const newRecord = new this.productionRecordModel({
        ...createDto,
        assign_order_id: assignOrder._id,
        assign_employee_ids: assignEmployeeIds,
        master_not_good_id: createDto.master_not_good_id
          ? new Types.ObjectId(createDto.master_not_good_id)
          : undefined,
      });

      const savedRecord = await newRecord.save();

      // Update assign order summary
      await this.updateAssignOrderSummary(createDto.assign_order_id);

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
          message:
            (error as Error).message || 'Failed to create production record',
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

      // Validate quantity if provided
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

      // Handle confirmation status update
      if (updateDto.confirmation_status) {
        if (record.confirmation_status === 'confirmed') {
          throw new HttpException(
            {
              status: 'error',
              message: 'Record is already confirmed',
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        if (
          updateDto.confirmation_status === 'rejected' &&
          !updateDto.rejection_reason
        ) {
          throw new HttpException(
            {
              status: 'error',
              message: 'Rejection reason is required',
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        if (!updateDto.confirmed_by) {
          throw new HttpException(
            {
              status: 'error',
              message: 'Confirmed by user is required',
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Add confirmation related fields
        updateDto = {
          ...updateDto,
          confirmed_by: new Types.ObjectId(updateDto.confirmed_by).toString(),
          confirmed_at: new Date(),
        };
      }

      // Update the record
      const updatedRecord = await this.productionRecordModel
        .findByIdAndUpdate(id, { $set: updateDto }, { new: true })
        .populate('master_not_good_id', 'case_english case_thai')
        .populate('confirmed_by');

      // Update assign order summary if quantity changed
      if (updateDto.quantity) {
        await this.updateAssignOrderSummary(record.assign_order_id.toString());
      }

      return {
        status: 'success',
        message: updateDto.confirmation_status
          ? `Production record ${updateDto.confirmation_status} successfully`
          : 'Production record updated successfully',
        data: [updatedRecord],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to update production record: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async delete(id: string): Promise<ResponseFormat<ProductionRecord>> {
    try {
      const record = await this.productionRecordModel
        .findById(id)
        .populate('assign_order_id');
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

      // Check if the record is confirmed
      if (record.confirmation_status === 'confirmed') {
        throw new HttpException(
          {
            status: 'error',
            message: 'Cannot delete confirmed record',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const machine = await this.machineInfoModel.findOne({
        machine_number: record.assign_order_id['machine_number'],
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

      await this.machineInfoModel.findOneAndUpdate(
        { machine_number: record.assign_order_id['machine_number'] },
        { $inc: { counter: record.quantity } },
      );

      await this.productionRecordModel.findByIdAndDelete(id);
      // Update assign order summary
      await this.updateAssignOrderSummary(
        record.assign_order_id._id.toString(),
      );

      return {
        status: 'success',
        message: 'Production record deleted successfully',
        data: [record],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to delete production record: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async updateAssignOrderSummary(assignOrderId: string) {
    try {
      const records = await this.productionRecordModel.find({
        assign_order_id: new Types.ObjectId(assignOrderId),
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
      await this.assignOrderModel.findByIdAndUpdate(assignOrderId, {
        $set: {
          current_summary: {
            ...summary,
            last_update: new Date(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to update assign order summary:', error);
    }
  }
}
