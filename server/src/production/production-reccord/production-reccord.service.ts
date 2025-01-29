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
import { calculateAvailableCounter } from 'src/shared/utils/counter.utils';
import { PopulatedMachineInfo } from 'src/shared/interface/machine-info';
import { ProductionOrder } from 'src/shared/modules/schema/production-order.schema';
import { MasterCavity } from 'src/shared/modules/schema/master-cavity.schema';
import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';

@Injectable()
export class ProductionRecordService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private productionRecordModel: Model<ProductionRecord>,

    @InjectModel(AssignEmployee.name)
    private assignEmployeeModel: Model<AssignEmployee>,

    @InjectModel(MasterNotGood.name)
    private masterNotGoodModel: Model<MasterNotGood>,

    @InjectModel(AssignOrder.name)
    private assignOrderModel: Model<AssignOrder>,

    @InjectModel(MachineInfo.name)
    private machineInfoModel: Model<MachineInfo>,

    @InjectModel(ProductionOrder.name)
    private productionOrderModel: Model<ProductionOrder>,

    @InjectModel(MasterCavity.name)
    private masterCavityModel: Model<MasterCavity>,

    @InjectModel(MasterPart.name) private masterPartModel: Model<MasterPart>,
  ) {}

  private async validateMachineCounter(assignOrder: any, quantity: number) {
    try {
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

      const productionOrder = await this.productionOrderModel.findById(
        assignOrder.production_order_id,
      );

      // ค้นหา cavity และ part
      const cavityResult = await this.getCavityData(
        productionOrder.material_number,
      );
      const { cavityData, partData } = cavityResult;

      // กำหนดค่า cavity count
      const cavityCount = cavityData?.cavity || 1;

      console.log(cavityCount);

      // Debug logs
      console.log('Cavity and Counter Info:', {
        material_number: productionOrder.material_number,
        cavity_data: cavityData,
        part_data: partData,
        cavity_count: cavityCount,
        machine_counter: machine.counter,
        recorded_counter: machine.recorded_counter,
      });

      const availableCounter = calculateAvailableCounter(
        machine.counter,
        machine.recorded_counter,
        cavityCount,
        machine.is_counter_paused,
        machine.pause_start_counter,
      );

      if (quantity > availableCounter) {
        throw new HttpException(
          {
            status: 'error',
            message: `Cannot record ${quantity} pieces. Available counter is ${availableCounter} (Cavity: ${cavityCount})`,
            data: [
              {
                machine_number: assignOrder.machine_number,
                material_number: productionOrder.material_number,
                requested_quantity: quantity,
                available_counter: availableCounter,
                cavity_count: cavityCount,
                current_counter: machine.counter,
                recorded_counter: machine.recorded_counter,
                is_counter_paused: machine.is_counter_paused,
              },
            ],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        machine,
        cavityCount,
        cavityData,
        partData,
      };
    } catch (error) {
      console.error('Error in validateMachineCounter:', error);
      throw error;
    }
  }

  // แยกฟังก์ชันสำหรับดึงข้อมูล cavity
  private async getCavityData(materialNumber: string) {
    try {
      // ค้นหา cavity ที่มี part ที่ตรงกับ material number
      const cavity = await this.masterCavityModel
        .findOne()
        .populate({
          path: 'parts',
          model: 'MasterPart',
          match: { material_number: materialNumber },
          select: 'material_number part_number part_name weight',
        })
        .lean();

      // กรณีไม่พบ cavity
      if (!cavity) {
        console.log('No cavity found for material:', materialNumber);
        return { cavityData: null, partData: null };
      }

      // กรณีพบ cavity แต่ไม่มี part ที่ตรงกัน
      if (!cavity.parts?.length) {
        console.log('Trying to find part directly');
        const part = await this.masterPartModel
          .findOne({ material_number: materialNumber })
          .lean();

        if (part) {
          console.log('Found part:', part);
          // ค้นหา cavity ที่มี part นี้
          const cavityWithPart = await this.masterCavityModel
            .findOne({ parts: part._id })
            .lean();

          if (cavityWithPart) {
            console.log('Found cavity through part:', cavityWithPart);
            return {
              cavityData: {
                cavity: cavityWithPart.cavity,
                runner: cavityWithPart.runner,
                tonnage: cavityWithPart.tonnage,
              },
              partData: part,
            };
          }
        }
        return { cavityData: null, partData: null };
      }

      // กรณีพบทั้ง cavity และ part
      return {
        cavityData: {
          cavity: cavity.cavity,
          runner: cavity.runner,
          tonnage: cavity.tonnage,
        },
        partData: cavity.parts[0],
      };
    } catch (error) {
      console.error('Error getting cavity data:', error);
      return { cavityData: null, partData: null };
    }
  }

  // 2. แยกฟังก์ชันสำหรับอัพเดทเครื่องจักร
  private async updateMachineCounter(
    machineNumber: string,
    quantity: number,
    increment: boolean = true,
  ) {
    await this.machineInfoModel.findOneAndUpdate(
      { machine_number: machineNumber },
      { $inc: { recorded_counter: increment ? quantity : -quantity } },
    );
  }

  // 3. แยกฟังก์ชันสำหรับการตรวจสอบ not good record
  private async validateNotGoodRecord(dto: CreateProductionRecordDto) {
    if (!dto.master_not_good_id) {
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
      dto.master_not_good_id,
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

  private async validateAssignOrder(assignOrderId: string) {
    const assignOrder = await this.assignOrderModel.findById(
      new Types.ObjectId(assignOrderId),
    );

    if (!assignOrder || assignOrder.status !== 'active') {
      throw new HttpException(
        {
          status: 'error',
          message: 'AssignOrder not found or not active',
          data: [],
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return assignOrder;
  }

  private async validateAssignEmployees(assignOrderId: Types.ObjectId) {
    const assignEmployees = await this.assignEmployeeModel.find({
      assign_order_id: assignOrderId.toString(),
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

    return assignEmployees.map((emp) => new Types.ObjectId(emp._id.toString()));
  }

  private async createProductionRecord(
    createDto: CreateProductionRecordDto,
    assignOrder: any,
    assignEmployeeIds: Types.ObjectId[],
    serialCode: string,
  ) {
    const newRecord = new this.productionRecordModel({
      ...createDto,
      assign_order_id: new Types.ObjectId(assignOrder._id.toString()),
      assign_employee_ids: assignEmployeeIds.map(
        (id) => new Types.ObjectId(id.toString()),
      ),
      master_not_good_id: createDto.master_not_good_id
        ? new Types.ObjectId(createDto.master_not_good_id)
        : undefined,
      serial_code: serialCode,
    });

    return await newRecord.save();
  }

  async create(
    createDto: CreateProductionRecordDto,
  ): Promise<ResponseFormat<ProductionRecord>> {
    try {
      // ตรวจสอบ assign order
      const assignOrder = await this.validateAssignOrder(
        createDto.assign_order_id,
      );

      // ตรวจสอบพนักงาน
      const assignEmployeeIds = await this.validateAssignEmployees(
        assignOrder._id as Types.ObjectId,
      );

      // ตรวจสอบจำนวน
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

      // ตรวจสอบ counter สำหรับงานดี
      if (!createDto.is_not_good) {
        await this.validateMachineCounter(assignOrder, createDto.quantity);
      } else {
        await this.validateNotGoodRecord(createDto);
      }

      // สร้าง serial code
      const serial = await this.generateSerialCode(assignOrder.machine_number);

      // บันทึกข้อมูล
      const newRecord = await this.createProductionRecord(
        createDto,
        assignOrder,
        assignEmployeeIds,
        serial,
      );

      // อัพเดท counter
      await this.updateMachineCounter(
        assignOrder.machine_number,
        createDto.quantity,
      );

      // อัพเดทสรุปการผลิต
      await this.updateAssignOrderSummary(createDto.assign_order_id);

      return {
        status: 'success',
        message: 'Production record created successfully',
        data: [newRecord],
      };
    } catch (error) {
      return this.handleServiceError(error);
    }
  }

  // เพิ่มฟังก์ชันสำหรับจัดการ Error
  private handleServiceError(error: any): never {
    if (error instanceof HttpException) throw error;

    throw new HttpException(
      {
        status: 'error',
        message: (error as Error).message || 'Service operation failed',
        data: [],
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async findAll(
    query: any = {},
    page: number = 1,
    limit: number = 10,
  ): Promise<ResponseFormat<ProductionRecord>> {
    try {
      const skip = (page - 1) * limit;

      const records = await this.productionRecordModel
        .find(query)
        .populate('master_not_good_id', 'case_english case_thai')
        .populate({
          path: 'assign_order_id',
          populate: {
            path: 'production_order_id',
            select:
              'order_id material_number material_description target_quantity',
          },
        })
        .populate({
          path: 'assign_employee_ids',
          populate: {
            path: 'user_id',
            select: 'employee_id',
          },
        })
        .populate('confirmed_by', 'employee_id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await this.productionRecordModel.countDocuments(query);

      return {
        status: 'success',
        message: 'Production records retrieved successfully',
        data: records,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
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
          (updateDto.rejection_reason ?? '') === ''
        ) {
          throw new HttpException(
            {
              status: 'error',
              message: 'Rejection reason is required ',
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

      const machine = await this.machineInfoModel
        .findOne({
          machine_number: record.assign_order_id['machine_number'],
        })
        .populate<PopulatedMachineInfo>({
          // เพิ่ม populate เหมือน create
          path: 'material_cavities.cavity_id',
          select: 'cavity runner parts',
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
        { $inc: { recorded_counter: -record.quantity } },
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

  async generateSerialCode(machine_number: string): Promise<string> {
    // สร้าง prefix ตามวันที่
    const today = new Date();
    const prefix = `PR${today.getFullYear().toString().slice(-2)}${(
      today.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;

    // ค้นหา serial code ล่าสุดของวันนี้
    const latestRecord = await this.productionRecordModel
      .findOne({
        serial_code: new RegExp(`^${prefix}-${machine_number}-`),
      })
      .sort({ serial_code: -1 });

    // คำนวณเลข sequence ถัดไป
    let sequence = 1;
    if (latestRecord) {
      const lastSequence = parseInt(latestRecord.serial_code.split('-')[2]);
      sequence = lastSequence + 1;
    }

    // สร้าง serial code
    return `${prefix}-${machine_number}-${sequence.toString().padStart(4, '0')}`;
  }
}
