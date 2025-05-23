import {
  Injectable,
  HttpException,
  HttpStatus,
  ConsoleLogger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { AssignEmployee } from 'src/schema/assign-employee.schema';
import { MasterNotGood } from 'src/schema/master-not-good.schema';
import { ProductionRecord } from 'src/schema/production-record.schema';
import {
  CreateProductionRecordDto,
  PrintDto,
  PrintRequestDto,
  UpdateProductionRecordDto,
} from '../dto/production-reccord.dto';
import { ResponseFormat } from 'src/shared/interface';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { calculateAvailableCounter } from 'src/shared/utils/counter.utils';
import {
  DailySummaryData,
  PopulatedMachineInfo,
} from 'src/shared/interface/machine-info';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { MasterCavity } from 'src/schema/master-cavity.schema';
import { MasterPart } from 'src/schema/master_parts.schema';
import { User } from 'src/schema/user.schema';
import * as moment from 'moment-timezone';
import axios from 'axios';
import { AssignEmployeeService } from 'src/assign/assign-employee/assign-employee.service';
import { DateRangeSummaryData } from 'src/shared/interface/product';
import { MachineInfoService } from 'src/machine/machine-info/machine-info.service';
import { response } from 'express';
import { SerialCounter } from 'src/schema/serial-counter.schema';
import { toObjectId } from '../../shared/utils/type.utils';
import { SerialCodeService } from '../serial-code/serialcode.service';
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

    @InjectModel(User.name) private userModel: Model<User>,

    @InjectModel(SerialCounter.name)
    private serialCounterModel: Model<SerialCounter>,

    private AssignEmployeeService: AssignEmployeeService,

    private readonly machineInfoService: MachineInfoService,

    private readonly serialCodeService: SerialCodeService,
  ) {}

  private calculateProductionDate(date?: Date): Date {
    // ใช้ moment.tz กับเขตเวลาประเทศไทย
    const thaiTime = date
      ? moment(date).tz('Asia/Bangkok')
      : moment().tz('Asia/Bangkok');

    const cutoffHour = 8; // 8:00 AM

    // ตรวจสอบว่าเวลาปัจจุบันอยู่ก่อน 8:00 น. หรือไม่
    if (thaiTime.hour() < cutoffHour) {
      // ถ้าก่อน 8:00 น. ให้ใช้วันที่ของวันก่อนหน้า
      thaiTime.subtract(1, 'days');
    }

    // ตั้งเวลาเป็น 00:00:00 เพื่อให้มีแค่วันที่
    thaiTime.startOf('day');

    // แปลงกลับเป็น JavaScript Date object
    return thaiTime.toDate();
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

  private formatDateForPrinter(dateString: string): string {
    const date = new Date(dateString);

    // Create dd/mm/yyyy format
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 because months are 0-indexed
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  private async resetMachineCounter(
    machineNumber: string,
    machineCounter: number,
  ): Promise<void> {
    try {
      const currentCounter = machineCounter || 0;

      await this.machineInfoModel.findOneAndUpdate(
        { machine_number: machineNumber },
        {
          recorded_counter: currentCounter,
          is_counter_paused: false,
          pause_start_counter: currentCounter,
        },
      );
    } catch (error) {
      console.error(
        `Failed to reset counter for machine ${machineNumber}:`,
        error,
      );
      throw error;
    }
  }

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

      const availableCounter = calculateAvailableCounter(
        machine.counter,
        machine.recorded_counter,
        cavityCount,
        machine.is_counter_paused,
        machine.pause_start_counter,
      );

      if (quantity > availableCounter) {
        this.resetMachineCounter(machine.machine_number, machine.counter);
      } else {
        this.updateMachineCounter(machine.machine_number, quantity);
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

  private async getCavityData(materialNumber: string) {
    try {
      // ค้นหา cavity ที่มี part ที่ตรงกับ material number
      // 1. ค้นหา part ก่อน
      const part = await this.masterPartModel
        .findOne({ material_number: materialNumber })
        .lean();

      if (!part) {
        return { cavityData: null, partData: null };
      }

      // 2. ค้นหา cavity ที่มี part นี้ - ทั้งในรูปแบบ ObjectId และ String

      const cavity = await this.masterCavityModel.findOne({
        $or: [
          { parts: { $in: [toObjectId(part._id as mongoose.Types.ObjectId)] } }, // ค้นหาแบบ ObjectId
        ],
      });

      // กรณีไม่พบ cavity
      if (!cavity) {
        console.log('No cavity found for material:', materialNumber);
        return { cavityData: null, partData: null };
      }

      // กรณีพบทั้ง cavity และ part
      return {
        cavityData: {
          cavity: cavity.cavity,
          runner: cavity.runner,
          tonnage: cavity.tonnage,
        },
        partData: part,
      };
    } catch (error) {
      console.error('Error getting cavity data:', error);
      return { cavityData: null, partData: null };
    }
  }

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
    const assignOrder = await this.assignOrderModel
      .findById(toObjectId(assignOrderId))
      .populate('production_order_id')
      .exec();

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
      assign_order_id: toObjectId(assignOrderId),
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

    return assignEmployees.map((emp) => toObjectId(emp._id.toString()));
  }

  private async createProductionRecord(
    createDto: CreateProductionRecordDto,
    assignOrder: any,
    assignEmployeeIds: Types.ObjectId[],
    serialCode: string,
    serialCounterId: mongoose.Types.ObjectId,
  ) {
    const productionDate = this.calculateProductionDate();

    const newRecord = new this.productionRecordModel({
      ...createDto,
      assign_order_id: toObjectId(assignOrder._id.toString()),
      assign_employee_ids: assignEmployeeIds.map((id) =>
        toObjectId(id.toString()),
      ),
      master_not_good_id: createDto.master_not_good_id
        ? toObjectId(createDto.master_not_good_id)
        : undefined,
      serial_code: serialCode,
      serial_counter_id: toObjectId(serialCounterId),
      production_date: productionDate, // เพิ่ม production_date
    });

    return await newRecord.save();
  }

  private async updateAssignOrderSummary(assignOrderId: string) {
    try {
      const records = await this.productionRecordModel.find({
        assign_order_id: toObjectId(assignOrderId),
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
      await this.assignOrderModel.findByIdAndUpdate(toObjectId(assignOrderId), {
        $set: {
          current_summary: {
            ...summary,
            last_update: moment().toDate(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to update assign order summary:', error);
    }
  }

  async create(
    createDto: CreateProductionRecordDto,
    userId: string,
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

      if (!assignEmployeeIds || assignEmployeeIds.length === 0) {
        const newAssignEmployee = await this.AssignEmployeeService.create({
          user_id: userId,
          assign_order_id: createDto.assign_order_id,
        });
        assignEmployeeIds.push(newAssignEmployee.data[0]._id);
        console.log('New Assign Employee:', newAssignEmployee);
      }

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

      if (createDto.is_not_good) {
        await this.validateNotGoodRecord(createDto);
      }

      // สร้าง serial code
      const serial = await this.serialCodeService.generateHexSerialCode(
        assignOrder.machine_number,
        (assignOrder.production_order_id as any).material_number,
        createDto.is_not_good ? 'NG' : 'OK',
      );

      // บันทึกข้อมูล
      const newRecord = await this.createProductionRecord(
        createDto,
        assignOrder,
        assignEmployeeIds,
        serial.serial,
        serial._id,
      );

      // อัพเดท counter
      await this.validateMachineCounter(assignOrder, createDto.quantity);

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
          confirmed_at: moment().toDate(),
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

  async autoConfirmOldNGRecords(): Promise<ResponseFormat<ProductionRecord>> {
    try {
      // คำนวณวันที่ย้อนหลัง 1 วัน
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // ค้นหา records ที่เป็น NG และมีอายุมากกว่า 1 วัน และยังไม่ได้ confirm
      const records = await this.productionRecordModel.find({
        is_not_good: true,
        confirmation_status: 'pending',
        createdAt: { $lt: oneDayAgo },
      });

      if (records.length === 0) {
        return {
          status: 'success',
          message: 'No pending NG records found to auto confirm',
          data: [],
        };
      }

      // อัพเดทแต่ละ record
      const confirmedRecords = await Promise.all(
        records.map(async (record) => {
          const updateDto = {
            confirmation_status: 'confirmed',
            confirmed_by: process.env.SYSTEM_USER_ID, // ต้องกำหนด SYSTEM_USER_ID ใน environment
            confirmed_at: moment().toDate(),
            remark: record.remark
              ? `${record.remark} [Auto confirmed by system]`
              : '[Auto confirmed by system]',
          };

          return await this.productionRecordModel
            .findByIdAndUpdate(record._id, { $set: updateDto }, { new: true })
            .populate('master_not_good_id', 'case_english case_thai')
            .populate('confirmed_by');
        }),
      );

      // อัพเดท assign order summary สำหรับทุก record ที่เปลี่ยนแปลง
      await Promise.all(
        confirmedRecords.map((record) =>
          this.updateAssignOrderSummary(record.assign_order_id.toString()),
        ),
      );

      return {
        status: 'success',
        message: `Auto confirmed ${confirmedRecords.length} NG records successfully`,
        data: confirmedRecords,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to auto confirm NG records: ${(error as Error).message}`,
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
      // ลบ populate ออกก่อนเนื่องจากมีปัญหากับ schema

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

  async getDailySummary(date?: Date): Promise<ResponseFormat<any>> {
    try {
      const targetDate = date ? moment(date) : moment(); // ใช้ moment จาก date หรือปัจจุบัน

      const startDate = targetDate
        .clone()
        .tz('Asia/Bangkok') // เปลี่ยน timezone เป็น Bangkok
        .startOf('day') // ไปที่ 00:00 ของวัน
        .add(8, 'hours'); // ขยับไปที่ 08:00 AM

      const endDate = startDate.clone().add(1, 'day'); // วันถัดไป 08:00 AM

      // ถ้าต้องการแปลงกลับเป็น JS Date
      const startDateJS = startDate.toDate();
      const endDateJS = endDate.toDate();

      const matchStage = {
        $match: {
          createdAt: {
            $gte: startDateJS,
            $lt: endDateJS,
          },
          confirmation_status: {
            $in: ['pending', 'confirmed'],
          },
        },
      };

      const summary = await this.productionRecordModel.aggregate([
        matchStage,
        {
          $lookup: {
            from: 'assign_orders',
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order',
          },
        },
        {
          $unwind: {
            path: '$assign_order',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'production_orders',
            localField: 'assign_order.production_order_id',
            foreignField: '_id',
            as: 'production_order',
          },
        },
        {
          $unwind: {
            path: '$production_order',
            preserveNullAndEmptyArrays: true,
          },
        },
        // First group by assign order to get individual order stats
        {
          $group: {
            _id: {
              work_center: '$assign_order.work_center',
              machine_number: '$assign_order.machine_number',
              assign_order_id: '$assign_order._id',
              order_id: '$production_order.order_id',
              material_number: '$production_order.material_number',
              material_description: '$production_order.material_description',
            },
            good_quantity: {
              $sum: {
                $cond: [{ $eq: ['$is_not_good', false] }, '$quantity', 0],
              },
            },
            not_good_quantity: {
              $sum: {
                $cond: [{ $eq: ['$is_not_good', true] }, '$quantity', 0],
              },
            },
            pending_good_quantity: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$is_not_good', false] },
                      { $eq: ['$confirmation_status', 'pending'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            confirmed_good_quantity: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$is_not_good', false] },
                      { $eq: ['$confirmation_status', 'confirmed'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            pending_not_good_quantity: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$is_not_good', true] },
                      { $eq: ['$confirmation_status', 'pending'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            confirmed_not_good_quantity: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$is_not_good', true] },
                      { $eq: ['$confirmation_status', 'confirmed'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            total_quantity: { $sum: '$quantity' },
            records_count: { $sum: 1 },
            start_time: { $min: '$createdAt' },
            end_time: { $max: '$createdAt' },
            order_status: { $first: '$assign_order.status' },
          },
        },
        // Then group by machine to get machine totals and order details
        {
          $group: {
            _id: {
              work_center: '$_id.work_center',
              machine_number: '$_id.machine_number',
            },
            orders: {
              $push: {
                assign_order_id: '$_id.assign_order_id',
                order_id: '$_id.order_id',
                material_number: '$_id.material_number',
                material_description: '$_id.material_description',
                good_quantity: '$good_quantity',
                not_good_quantity: '$not_good_quantity',
                pending_good_quantity: '$pending_good_quantity',
                confirmed_good_quantity: '$confirmed_good_quantity',
                pending_not_good_quantity: '$pending_not_good_quantity',
                confirmed_not_good_quantity: '$confirmed_not_good_quantity',
                total_quantity: '$total_quantity',
                records_count: '$records_count',
                start_time: '$start_time',
                end_time: '$end_time',
                order_status: '$order_status',
              },
            },
            total_good_quantity: { $sum: '$good_quantity' },
            total_not_good_quantity: { $sum: '$not_good_quantity' },
            total_pending_good: { $sum: '$pending_good_quantity' },
            total_confirmed_good: { $sum: '$confirmed_good_quantity' },
            total_pending_not_good: { $sum: '$pending_not_good_quantity' },
            total_confirmed_not_good: { $sum: '$confirmed_not_good_quantity' },
            total_quantity: { $sum: '$total_quantity' },
            total_records: { $sum: '$records_count' },
          },
        },
        {
          $project: {
            _id: 0,
            work_center: '$_id.work_center',
            machine_number: '$_id.machine_number',
            orders: 1,
            machine_summary: {
              good_quantity: '$total_good_quantity',
              not_good_quantity: '$total_not_good_quantity',
              pending_good_quantity: '$total_pending_good',
              confirmed_good_quantity: '$total_confirmed_good',
              pending_not_good_quantity: '$total_pending_not_good',
              confirmed_not_good_quantity: '$total_confirmed_not_good',
              total_quantity: '$total_quantity',
              records_count: '$total_records',
            },
          },
        },
        {
          $sort: {
            work_center: 1,
            machine_number: 1,
          },
        },
      ]);

      // Calculate overall summary from machine summaries
      const overallSummary = summary.reduce(
        (acc, curr) => {
          const machineSummary = curr.machine_summary;
          acc.total_quantity += machineSummary.total_quantity;
          acc.total_good_quantity += machineSummary.good_quantity;
          acc.total_not_good_quantity += machineSummary.not_good_quantity;
          acc.total_records += machineSummary.records_count;
          acc.total_pending_good += machineSummary.pending_good_quantity;
          acc.total_confirmed_good += machineSummary.confirmed_good_quantity;
          acc.total_pending_not_good +=
            machineSummary.pending_not_good_quantity;
          acc.total_confirmed_not_good +=
            machineSummary.confirmed_not_good_quantity;
          return acc;
        },
        {
          total_quantity: 0,
          total_good_quantity: 0,
          total_not_good_quantity: 0,
          total_records: 0,
          total_pending_good: 0,
          total_confirmed_good: 0,
          total_pending_not_good: 0,
          total_confirmed_not_good: 0,
        },
      );

      return {
        status: 'success',
        message: 'Daily production summary retrieved successfully',
        data: [
          {
            date: targetDate,
            time_range: {
              start: startDate,
              end: endDate,
            },
            summary,
            overall_summary: overallSummary,
          },
        ],
      };
    } catch (error) {
      console.error('Error in getDailySummary:', error);
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to retrieve daily summary: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getDailyProductionData(): Promise<ResponseFormat<any>> {
    try {
      // Aggregate production records
      const productionSummary = await this.productionRecordModel.aggregate([
        // Stage 1: Add date fields for grouping
        {
          $addFields: {
            dateOnly: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
          },
        },

        // Stage 2: Lookup assign_orders
        {
          $lookup: {
            from: 'assign_orders',
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order',
          },
        },
        {
          $unwind: '$assign_order',
        },

        // Stage 3: Lookup production_orders
        {
          $lookup: {
            from: 'production_orders',
            localField: 'assign_order.production_order_id',
            foreignField: '_id',
            as: 'production_order',
          },
        },
        {
          $unwind: '$production_order',
        },

        // Stage 4: Group by date, assign_order_id and status
        {
          $group: {
            _id: {
              date: '$dateOnly',
              assign_order_id: '$assign_order_id',
              confirmation_status: '$confirmation_status',
              is_not_good: '$is_not_good',
            },
            work_center: { $first: '$assign_order.work_center' },
            machine_number: { $first: '$assign_order.machine_number' },
            material_number: { $first: '$production_order.material_number' },
            material_description: {
              $first: '$production_order.material_description',
            },
            quantity: { $sum: '$quantity' },
            records_count: { $sum: 1 },
          },
        },

        // Stage 5: Group by date and assign_order_id
        {
          $group: {
            _id: {
              date: '$_id.date',
              assign_order_id: '$_id.assign_order_id',
            },
            work_center: { $first: '$work_center' },
            machine_number: { $first: '$machine_number' },
            material_number: { $first: '$material_number' },
            material_description: { $first: '$material_description' },
            production_details: {
              $push: {
                confirmation_status: '$_id.confirmation_status',
                is_not_good: '$_id.is_not_good',
                quantity: '$quantity',
                records_count: '$records_count',
              },
            },
            total_quantity: { $sum: '$quantity' },
            total_records: { $sum: '$records_count' },
          },
        },

        // Stage 6: Calculate quantities for each status
        {
          $project: {
            _id: 0,
            date: '$_id.date',
            assign_order_id: '$_id.assign_order_id',
            work_center: 1,
            machine_number: 1,
            material_number: 1,
            material_description: 1,
            total_quantity: 1,
            total_records: 1,
            pending_good_quantity: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$production_details',
                    as: 'detail',
                    cond: {
                      $and: [
                        { $eq: ['$$detail.confirmation_status', 'pending'] },
                        { $eq: ['$$detail.is_not_good', false] },
                      ],
                    },
                  },
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] },
              },
            },
            confirmed_good_quantity: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$production_details',
                    as: 'detail',
                    cond: {
                      $and: [
                        { $eq: ['$$detail.confirmation_status', 'confirmed'] },
                        { $eq: ['$$detail.is_not_good', false] },
                      ],
                    },
                  },
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] },
              },
            },
            pending_not_good_quantity: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$production_details',
                    as: 'detail',
                    cond: {
                      $and: [
                        { $eq: ['$$detail.confirmation_status', 'pending'] },
                        { $eq: ['$$detail.is_not_good', true] },
                      ],
                    },
                  },
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] },
              },
            },
            confirmed_not_good_quantity: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$production_details',
                    as: 'detail',
                    cond: {
                      $and: [
                        { $eq: ['$$detail.confirmation_status', 'confirmed'] },
                        { $eq: ['$$detail.is_not_good', true] },
                      ],
                    },
                  },
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.quantity'] },
              },
            },
          },
        },

        // Stage 7: Sort by date and work_center
        {
          $sort: {
            date: -1,
            work_center: 1,
            machine_number: 1,
          },
        },

        // Stage 8: Group records by date
        {
          $group: {
            _id: '$date',
            records: {
              $push: {
                assign_order_id: '$assign_order_id',
                work_center: '$work_center',
                machine_number: '$machine_number',
                material_number: '$material_number',
                material_description: '$material_description',
                total_quantity: '$total_quantity',
                total_records: '$total_records',
                pending_good_quantity: '$pending_good_quantity',
                confirmed_good_quantity: '$confirmed_good_quantity',
                pending_not_good_quantity: '$pending_not_good_quantity',
                confirmed_not_good_quantity: '$confirmed_not_good_quantity',
              },
            },
            daily_total: {
              $sum: '$total_quantity',
            },
            daily_pending_good: {
              $sum: '$pending_good_quantity',
            },
            daily_confirmed_good: {
              $sum: '$confirmed_good_quantity',
            },
            daily_pending_not_good: {
              $sum: '$pending_not_good_quantity',
            },
            daily_confirmed_not_good: {
              $sum: '$confirmed_not_good_quantity',
            },
            daily_records: {
              $sum: '$total_records',
            },
          },
        },

        // Stage 9: Final sort by date
        {
          $sort: {
            _id: -1,
          },
        },
      ]);

      return {
        status: 'success',
        message: 'Production summary retrieved successfully',
        data: productionSummary.map((day) => ({
          date: day._id,
          summary: day.records,
          daily_summary: {
            total_quantity: day.daily_total,
            pending_good_quantity: day.daily_pending_good,
            confirmed_good_quantity: day.daily_confirmed_good,
            pending_not_good_quantity: day.daily_pending_not_good,
            confirmed_not_good_quantity: day.daily_confirmed_not_good,
            total_records: day.daily_records,
          },
        })),
      };
    } catch (error) {
      console.error('Error in getDailyProductionData:', error);
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to retrieve production summary: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async confirmBySerial(
    serialCode: string,
    employeeId: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const user = await this.userModel.findOne({
        employee_id: { $regex: `.*${employeeId}.*`, $options: 'i' },
      });

      if (!user) {
        throw new HttpException(
          {
            status: 'success',
            message: 'user not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }
      // Find record by serial code
      const record = await this.productionRecordModel.findOne({
        serial_code: serialCode,
      });

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

      const assignOrder = await this.assignOrderModel.findById(
        record.assign_order_id,
      );

      if (!assignOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: 'assign order not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }
      const ProductionOrder_id = new Types.ObjectId(
        assignOrder.production_order_id,
      );
      const productionOrder =
        await this.productionOrderModel.findById(ProductionOrder_id);

      if (!productionOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: 'production order not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if record is already confirmed
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

      // Update the record
      const updatedRecord = await this.productionRecordModel
        .findByIdAndUpdate(
          record._id,
          {
            $set: {
              confirmation_status: 'confirmed',
              confirmed_by: user._id,
              confirmed_at: moment().toDate(),
            },
          },
          { new: true },
        )
        .populate('master_not_good_id', 'case_english case_thai')
        .populate('confirmed_by');

      const dataReturn = [
        {
          quantity: record.quantity,
          production_date: record.createdAt || moment().toDate(),
          material_number: productionOrder.material_number,
          serial_code: serialCode,
        },
      ];

      return {
        status: 'success',
        message: 'Production record confirmed successfully',
        data: dataReturn,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to confirm production record: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findSummaryByOrderId(
    assignOrderId: string,
    shiftType?: 'morning' | 'night' | 'all',
  ): Promise<ResponseFormat<DailySummaryData>> {
    try {
      const orderObjectId = new Types.ObjectId(assignOrderId);

      // Get AssignOrder data with datetime_open_order
      const assignOrder = await this.assignOrderModel.findById(orderObjectId);
      if (!assignOrder) {
        throw new Error('Order not found');
      }

      // Use the order's open date as start date and current date as end date
      const startDate = moment(assignOrder.datetime_open_order).tz(
        'Asia/Bangkok',
      );
      const endDate = moment().tz('Asia/Bangkok');

      // Define shift timings
      const SHIFT_TIMINGS = {
        morning: { startHour: 8, duration: 12 }, // 08:00 - 20:00
        night: { startHour: 20, duration: 12 }, // 20:00 - 08:00 (next day)
      };

      // Default to all shifts if not specified
      const selectedShift = shiftType || 'all';

      // Get all dates in range
      const dates: moment.Moment[] = [];
      let currentDate = startDate.clone().startOf('day');
      while (currentDate.isSameOrBefore(endDate, 'day')) {
        dates.push(currentDate.clone());
        currentDate.add(1, 'day');
      }

      // Determine which shifts to process
      const shiftsToProcess =
        selectedShift === 'all' ? ['morning', 'night'] : [selectedShift];

      // Process each date with MongoDB aggregation
      const summaries = await Promise.all(
        dates.flatMap(async (date) => {
          // Process each shift for this date
          return Promise.all(
            shiftsToProcess.map(async (shift) => {
              const { startHour, duration } = SHIFT_TIMINGS[shift];
              const queryStartTime = date
                .clone()
                .startOf('day')
                .add(startHour, 'hours');
              let queryEndTime = queryStartTime.clone().add(duration, 'hours');

              // For the first day, adjust start time if order was opened after shift start
              if (date.isSame(startDate, 'day')) {
                if (startDate.isAfter(queryStartTime)) {
                  // If order opened during this shift, use open time as start
                  if (startDate.isBefore(queryEndTime)) {
                    queryStartTime
                      .hours(startDate.hours())
                      .minutes(startDate.minutes());
                  }
                }
              }

              // Handle night shift crossing day boundary
              if (shift === 'night') {
                // If this is today and we're looking at night shift,
                // truncate the query to current time if needed
                if (date.isSame(endDate, 'day')) {
                  queryEndTime = moment.min(queryEndTime, endDate);
                }
              }

              // Skip dates/shifts that haven't occurred yet
              if (queryStartTime.isAfter(endDate)) {
                return null;
              }

              // Use aggregation for better performance
              const result = await this.productionRecordModel.aggregate([
                {
                  $match: {
                    assign_order_id: orderObjectId,
                    createdAt: {
                      $gte: queryStartTime.toDate(),
                      $lt: queryEndTime.toDate(),
                    },
                  },
                },
                {
                  $group: {
                    _id: null,
                    total_quantity: { $sum: '$quantity' },
                    good_quantity: {
                      $sum: {
                        $cond: [
                          { $eq: ['$is_not_good', false] },
                          '$quantity',
                          0,
                        ],
                      },
                    },
                    not_good_quantity: {
                      $sum: {
                        $cond: [
                          { $eq: ['$is_not_good', true] },
                          '$quantity',
                          0,
                        ],
                      },
                    },
                  },
                },
              ]);

              // Create summary with shift information
              return {
                date: date.format('YYYY-MM-DD'),
                shift,
                shift_start: queryStartTime.format('HH:mm'),
                shift_end: queryEndTime.format('HH:mm'),
                total_quantity: result[0]?.total_quantity || 0,
                good_quantity: result[0]?.good_quantity || 0,
                not_good_quantity: result[0]?.not_good_quantity || 0,
              };
            }),
          );
        }),
      );

      // Flatten the array and filter out null results
      const flattenedSummaries = summaries
        .flat()
        .filter((summary) => summary !== null);

      // Filter out records with no production
      const nonEmptySummaries = flattenedSummaries.filter(
        (summary) => summary.total_quantity > 0,
      );

      return {
        status: 'success',
        message: `Production summaries for order retrieved successfully`,
        data: nonEmptySummaries,
      };
    } catch (error) {
      return {
        status: 'error',
        message:
          (error as Error).message || 'Failed to retrieve production summaries',
        data: [],
      };
    }
  }

  async findSummaryAllMachines(
    shiftType?: 'morning' | 'night' | 'all',
    startDateParam?: string, // พารามิเตอร์วันที่เริ่มต้น
    endDateParam?: string, // พารามิเตอร์วันที่สิ้นสุด
  ): Promise<ResponseFormat<DateRangeSummaryData>> {
    try {
      // กำหนดวันที่เริ่มต้นและสิ้นสุด
      const startDate = startDateParam
        ? moment(startDateParam, 'YYYY-MM-DD') // กำหนดรูปแบบให้ชัดเจน
        : moment().tz('Asia/Bangkok').startOf('day');

      const endDate = endDateParam
        ? moment(endDateParam, 'YYYY-MM-DD') // กำหนดรูปแบบให้ชัดเจน
        : startDateParam
          ? moment(startDateParam, 'YYYY-MM-DD').endOf('day') // กำหนดรูปแบบให้ชัดเจน
          : moment().tz('Asia/Bangkok').endOf('day'); // ค่าเริ่มต้นคือวันนี้

      // ตั้งค่า timezone ให้กับ startDate และ endDate หลังจากสร้างแล้ว
      startDate.tz('Asia/Bangkok').startOf('day');
      endDate.tz('Asia/Bangkok').endOf('day');

      // ตรวจสอบว่าวันที่สิ้นสุดต้องไม่มาก่อนวันที่เริ่มต้น
      if (endDate.isBefore(startDate)) {
        throw new Error('End date must be after start date');
      }

      // Define shift timings
      const SHIFT_TIMINGS = {
        morning: { startHour: 8, duration: 12 }, // 08:00 - 20:00
        night: { startHour: 20, duration: 12 }, // 20:00 - 08:00 (next day)
      };

      // Default to all shifts if not specified
      const selectedShift = shiftType || 'all';

      // ดึงข้อมูลเครื่องจักรทั้งหมด
      const machines = await this.machineInfoModel.find().exec();

      // จัดกลุ่มเครื่องจักรตามไลน์การผลิต
      // แก้ไขโดยระบุประเภทข้อมูลที่ชัดเจนให้กับ machinesByLine
      const machinesByLine: Record<string, MachineInfo[]> = machines.reduce(
        (acc, machine) => {
          const line = machine.line || 'Unknown';
          if (!acc[line]) {
            acc[line] = [];
          }
          acc[line].push(machine);
          return acc;
        },
        {} as Record<string, MachineInfo[]>,
      );

      // สร้างช่วงวันที่ทั้งหมดที่ต้องการดึงข้อมูล
      const dateRange = [];
      let currentDate = startDate.clone();
      while (currentDate.isSameOrBefore(endDate, 'day')) {
        dateRange.push(currentDate.clone());
        currentDate.add(1, 'day');
      }

      // สร้างผลลัพธ์สำหรับแต่ละไลน์และเครื่องจักร
      const lineResults = [];

      // สร้างผลลัพธ์แยกตามวันที่
      const dailyResults = [];

      // วนลูปสำหรับแต่ละวัน
      for (const date of dateRange) {
        const dayStart = date.clone().startOf('day');
        const dayEnd = date.clone().endOf('day');

        const dailyLineResults = [];

        for (const [line, lineMachines] of Object.entries(machinesByLine)) {
          const machineResults = [];

          // ประมวลผลแต่ละเครื่องจักร
          for (const machine of lineMachines) {
            // ค้นหา AssignOrder ที่กำลังทำงานหรือสำเร็จแล้วของเครื่องจักรนี้
            const activeAssignOrders = await this.assignOrderModel
              .find({
                machine_number: machine.machine_number,
                status: { $in: ['active', 'completed'] },
                // จำกัดเฉพาะ order ที่มีอยู่ในช่วงวันที่
                $or: [
                  {
                    datetime_open_order: {
                      $lte: dayEnd.toDate(),
                    },
                  },
                  {
                    datetime_close_order: {
                      $gte: dayStart.toDate(),
                    },
                  },
                ],
              })
              .exec();

            // ดึง Production Order IDs จาก Assign Orders
            const productionOrderIds = activeAssignOrders.map(
              (order) => order.production_order_id,
            );

            // ดึงข้อมูล Production Orders
            const productionOrders = await this.productionOrderModel
              .find({
                _id: { $in: productionOrderIds },
              })
              .exec();

            // สร้าง Map ของ Production Orders ตาม ID
            const productionOrdersMap = {};
            for (const order of productionOrders) {
              productionOrdersMap[order._id.toString()] = order;
            }

            // รวบรวมข้อมูล order เพื่อเพิ่มลงในผลลัพธ์
            const ordersData = [];
            for (const assignOrder of activeAssignOrders) {
              const productionOrder =
                productionOrdersMap[assignOrder.production_order_id.toString()];
              if (productionOrder) {
                ordersData.push({
                  assign_order_id: assignOrder._id,
                  production_order_id: productionOrder._id,
                  order_id: productionOrder.order_id,
                  material_number: productionOrder.material_number,
                  status: assignOrder.status,
                  current_summary: assignOrder.current_summary,
                });
              }
            }

            const machineData = {
              machine_id: machine._id,
              machine_number: machine.machine_number,
              machine_name: machine.machine_name || machine.machine_number,
              status: machine.status,
              line: machine.line || 'Unknown',
              work_center: machine.work_center,
              shifts: [],
              total_good: 0,
              total_not_good: 0,
              overall_total: 0,
              active_orders: activeAssignOrders.length,
              orders: ordersData, // เพิ่มข้อมูล orders
            };

            // Determine which shifts to process
            const shiftsToProcess =
              selectedShift === 'all' ? ['morning', 'night'] : [selectedShift];

            // ประมวลผลแต่ละกะทำงาน
            for (const shift of shiftsToProcess) {
              const { startHour, duration } = SHIFT_TIMINGS[shift];
              const queryStartTime = dayStart.clone().add(startHour, 'hours');
              let queryEndTime = queryStartTime.clone().add(duration, 'hours');

              // สำหรับกะกลางคืนที่ข้ามวัน
              if (shift === 'night') {
                queryEndTime = queryEndTime.add(1, 'days');
              }

              // ถ้ากะยังไม่จบ ใช้เวลาปัจจุบันเป็นเวลาสิ้นสุด
              const now = moment().tz('Asia/Bangkok');
              if (queryEndTime.isAfter(now)) {
                queryEndTime = now;
              }

              let totalQuantity = 0;
              let goodQuantity = 0;
              let notGoodQuantity = 0;

              // ประมวลผลสำหรับทุก AssignOrder ที่เกี่ยวข้องกับเครื่องจักรนี้
              for (const assignOrder of activeAssignOrders) {
                // ใช้ aggregation สำหรับประสิทธิภาพที่ดีขึ้น
                const result = await this.productionRecordModel.aggregate([
                  {
                    $match: {
                      assign_order_id: assignOrder._id,
                      createdAt: {
                        $gte: queryStartTime.toDate(),
                        $lt: queryEndTime.toDate(),
                      },
                    },
                  },
                  {
                    $group: {
                      _id: null,
                      total_quantity: { $sum: '$quantity' },
                      good_quantity: {
                        $sum: {
                          $cond: [
                            { $eq: ['$is_not_good', false] },
                            '$quantity',
                            0,
                          ],
                        },
                      },
                      not_good_quantity: {
                        $sum: {
                          $cond: [
                            { $eq: ['$is_not_good', true] },
                            '$quantity',
                            0,
                          ],
                        },
                      },
                    },
                  },
                ]);

                if (result.length > 0) {
                  totalQuantity += result[0].total_quantity || 0;
                  goodQuantity += result[0].good_quantity || 0;
                  notGoodQuantity += result[0].not_good_quantity || 0;
                }
              }

              // เพิ่มข้อมูลกะลงในผลลัพธ์ของเครื่องจักรเฉพาะเมื่อมีการผลิตในกะนั้น
              if (totalQuantity > 0) {
                machineData.shifts.push({
                  shift,
                  shift_start: queryStartTime.format('HH:mm'),
                  shift_end: queryEndTime.format('HH:mm'),
                  total_quantity: totalQuantity,
                  good_quantity: goodQuantity,
                  not_good_quantity: notGoodQuantity,
                });

                // อัพเดทยอดรวมของเครื่องจักร
                machineData.total_good += goodQuantity;
                machineData.total_not_good += notGoodQuantity;
                machineData.overall_total += totalQuantity;
              }
            }

            // เพิ่มข้อมูลเครื่องจักรลงในผลลัพธ์ถ้ามีการผลิต
            if (machineData.overall_total > 0) {
              machineResults.push(machineData);
            }
          }

          // เพิ่มข้อมูลไลน์ลงในผลลัพธ์ถ้ามีเครื่องจักรที่มีการผลิต
          if (machineResults.length > 0) {
            // คำนวณยอดรวมของไลน์
            const lineTotal = machineResults.reduce(
              (sum, machine) => sum + machine.overall_total,
              0,
            );
            const lineGoodTotal = machineResults.reduce(
              (sum, machine) => sum + machine.total_good,
              0,
            );
            const lineNotGoodTotal = machineResults.reduce(
              (sum, machine) => sum + machine.total_not_good,
              0,
            );

            // หาจำนวน orders ทั้งหมดในไลน์
            const totalOrdersInLine = machineResults.reduce(
              (sum, machine) => sum + machine.orders.length,
              0,
            );

            dailyLineResults.push({
              line,
              machines: machineResults,
              line_total: lineTotal,
              line_good_total: lineGoodTotal,
              line_not_good_total: lineNotGoodTotal,
              machine_count: machineResults.length,
              order_count: totalOrdersInLine,
            });
          }
        }

        // คำนวณยอดรวมของวันนี้
        if (dailyLineResults.length > 0) {
          const dailyTotal = dailyLineResults.reduce(
            (sum, line) => sum + line.line_total,
            0,
          );
          const dailyGoodTotal = dailyLineResults.reduce(
            (sum, line) => sum + line.line_good_total,
            0,
          );
          const dailyNotGoodTotal = dailyLineResults.reduce(
            (sum, line) => sum + line.line_not_good_total,
            0,
          );

          const dailyOrderCount = dailyLineResults.reduce(
            (sum, line) => sum + (line.order_count || 0),
            0,
          );

          dailyResults.push({
            date: date.format('YYYY-MM-DD'),
            lines: dailyLineResults,
            daily_total: dailyTotal,
            daily_good_total: dailyGoodTotal,
            daily_not_good_total: dailyNotGoodTotal,
            line_count: dailyLineResults.length,
            active_machine_count: dailyLineResults.reduce(
              (sum, line) => sum + line.machine_count,
              0,
            ),
            order_count: dailyOrderCount,
          });

          // รวบรวมข้อมูลไลน์จากทุกวันสำหรับสรุปรวม
          for (const lineResult of dailyLineResults) {
            const existingLineResult = lineResults.find(
              (l) => l.line === lineResult.line,
            );
            if (existingLineResult) {
              // รวมข้อมูลเครื่องจักร
              for (const machine of lineResult.machines) {
                const existingMachine = existingLineResult.machines.find(
                  (m) => m.machine_number === machine.machine_number,
                );

                if (existingMachine) {
                  // รวมข้อมูลของเครื่องจักรที่มีอยู่แล้ว
                  existingMachine.total_good += machine.total_good;
                  existingMachine.total_not_good += machine.total_not_good;
                  existingMachine.overall_total += machine.overall_total;

                  // รวมข้อมูลกะ
                  for (const shift of machine.shifts) {
                    const existingShift = existingMachine.shifts.find(
                      (s) => s.shift === shift.shift,
                    );

                    if (existingShift) {
                      existingShift.total_quantity += shift.total_quantity;
                      existingShift.good_quantity += shift.good_quantity;
                      existingShift.not_good_quantity +=
                        shift.not_good_quantity;
                    } else {
                      // เพิ่มกะใหม่
                      existingMachine.shifts.push({
                        ...shift,
                        shift_start: `${date.format('YYYY-MM-DD')} ${shift.shift_start}`,
                        shift_end: `${date.format('YYYY-MM-DD')} ${shift.shift_end}`,
                      });
                    }
                  }

                  // รวม order IDs ไม่ให้ซ้ำกัน
                  for (const order of machine.orders) {
                    const existingOrder = existingMachine.orders.find(
                      (o) =>
                        o.assign_order_id.toString() ===
                        order.assign_order_id.toString(),
                    );

                    if (!existingOrder) {
                      existingMachine.orders.push(order);
                    }
                  }
                } else {
                  // เพิ่มเครื่องจักรใหม่
                  const newMachine = { ...machine };
                  newMachine.shifts = machine.shifts.map((shift) => ({
                    ...shift,
                    shift_start: `${date.format('YYYY-MM-DD')} ${shift.shift_start}`,
                    shift_end: `${date.format('YYYY-MM-DD')} ${shift.shift_end}`,
                  }));
                  existingLineResult.machines.push(newMachine);
                }
              }

              // อัพเดทยอดรวมของไลน์
              existingLineResult.line_total += lineResult.line_total;
              existingLineResult.line_good_total += lineResult.line_good_total;
              existingLineResult.line_not_good_total +=
                lineResult.line_not_good_total;

              // อัพเดทจำนวน orders (รวมไม่ซ้ำกัน)
              if (lineResult.order_count) {
                if (!existingLineResult.order_count) {
                  existingLineResult.order_count = 0;
                }
                existingLineResult.order_count += lineResult.order_count;
              }

              // อัพเดทจำนวนเครื่องจักร (ใช้ค่ามากที่สุด)
              existingLineResult.machine_count = Math.max(
                existingLineResult.machine_count,
                lineResult.machine_count,
              );
            } else {
              // เพิ่มไลน์ใหม่
              const newLineResult = { ...lineResult };
              // ปรับรูปแบบข้อมูลกะให้มีวันที่
              newLineResult.machines = lineResult.machines.map((machine) => {
                const newMachine = { ...machine };
                newMachine.shifts = machine.shifts.map((shift) => ({
                  ...shift,
                  shift_start: `${date.format('YYYY-MM-DD')} ${shift.shift_start}`,
                  shift_end: `${date.format('YYYY-MM-DD')} ${shift.shift_end}`,
                }));
                return newMachine;
              });
              lineResults.push(newLineResult);
            }
          }
        }
      }

      // คำนวณยอดรวมทั้งหมด
      const factoryTotal = lineResults.reduce(
        (sum, line) => sum + line.line_total,
        0,
      );
      const factoryGoodTotal = lineResults.reduce(
        (sum, line) => sum + line.line_good_total,
        0,
      );
      const factoryNotGoodTotal = lineResults.reduce(
        (sum, line) => sum + line.line_not_good_total,
        0,
      );

      // นับจำนวน orders ทั้งหมดแบบไม่ซ้ำกัน
      const orderIdsSet = new Set();
      for (const lineResult of lineResults) {
        for (const machine of lineResult.machines) {
          for (const order of machine.orders) {
            orderIdsSet.add(order.production_order_id.toString());
          }
        }
      }
      const totalOrders = orderIdsSet.size;

      // สร้างผลลัพธ์สุดท้าย
      const summary: DateRangeSummaryData = {
        date_range: {
          start_date: startDate.format('YYYY-MM-DD'),
          end_date: endDate.format('YYYY-MM-DD'),
          days: dateRange.length,
        },
        shift_type: selectedShift,
        daily_summaries: dailyResults,
        lines: lineResults,
        total_summary: {
          // ตัดออก order_count เนื่องจากไม่มีใน interface
          factory_total: factoryTotal,
          factory_good_total: factoryGoodTotal,
          factory_not_good_total: factoryNotGoodTotal,
          line_count: lineResults.length,
          active_machine_count: lineResults.reduce(
            (sum, line) => sum + line.machine_count,
            0,
          ),
        },
      };

      return {
        status: 'success',
        message: `Production summaries for all machines from ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')} retrieved successfully`,
        data: [summary],
      };
    } catch (error) {
      return {
        status: 'error',
        message:
          (error as Error).message || 'Failed to retrieve production summaries',
        data: [],
      };
    }
  }

  async printLabel(data: PrintRequestDto): Promise<ResponseFormat<[]>> {
    try {
      let printerIp = ''; // ค่าเริ่มต้นสำหรับ IP ของเครื่องพิมพ์

      // ถ้ามีการระบุ machine_id
      if (data.machine_number) {
        // ดึงข้อมูลเครื่องพิมพ์ของเครื่องจักร
        const machineResponse = await this.machineInfoService.getMachinePrinter(
          data.machine_number,
        );

        // ตรวจสอบว่ามีข้อมูลเครื่องพิมพ์หรือไม่
        if (
          machineResponse.status === 'success' &&
          machineResponse.data.length > 0
        ) {
          const printer = machineResponse.data[0];

          // ถ้าเครื่องพิมพ์มีสถานะ active ให้ใช้ IP ของเครื่องพิมพ์นั้น
          if (printer.status === 'active') {
            printerIp = printer.ip_device;
          } else {
            // ถ้าเครื่องพิมพ์ไม่มีสถานะ active ให้ใช้ค่าเริ่มต้น
            console.warn(
              `Printer ${printer.device_name} is not active, using default printer`,
            );

            throw new HttpException(
              {
                status: 'error',
                message: `Printer ${printer.device_name} is not active`,
                data: [],
              },
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }
        } else {
          // ถ้าไม่พบเครื่องพิมพ์สำหรับเครื่องจักรนี้
          console.warn(
            `No printer found for machine ${data.machine_number}, using default printer`,
          );

          throw new HttpException(
            {
              status: 'error',
              message: `No printer found for machine ${data.machine_number}`,
              data: [],
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      // สร้าง URL สำหรับการส่งคำขอพิมพ์
      const printServiceUrl = `http://${printerIp}:8000/api/print`;

      const masterPart = await this.masterPartModel.aggregate([
        {
          $match: { material_number: data.matNo },
        },
        {
          $lookup: {
            from: 'master_cavity',
            let: { part_id: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$$part_id', '$parts'] }, // ตรวจสอบว่ามีอยู่ใน array parts
                },
              },
            ],
            as: 'cavity_info',
          },
        },
      ]);

      const labelData = masterPart[0];

      const printPayload: PrintDto = {
        tag_no: data.serial_number
          ? parseInt(data.serial_number.split('-')[2] || '0000')
          : 0,
        order_id: data?.jobOrder ?? '-',
        sap_no: data?.matNo ?? '-',
        customer_name: data?.customerName ?? '-',
        model: labelData.part_model ?? '-',
        supplier: 'Serenity',
        part_code: labelData?.part_number ?? '-',
        part_name: labelData?.part_name ?? '-',
        mat: labelData?.cavity_info[0]?.mat ?? '-',
        color: labelData?.cavity_info[0]?.color ?? '-',
        producer: data?.producer ?? '-',
        date: labelData?.date
          ? this.formatDateForPrinter(
              new Date(labelData.date).toISOString().split('T')[0],
            )
          : this.formatDateForPrinter(new Date().toISOString().split('T')[0]),
        quantity: data?.quantityStd ?? 0,
        number_of_tags: data?.number_of_tags ?? 1,
        code: data?.serial_number ?? '-',
        image_url: labelData?.image_url ?? '',
      };
      console.log('printPayload', printPayload);

      // ทำการส่งคำขอพิมพ์ไปยังเครื่องพิมพ์
      await axios.post(printServiceUrl, printPayload);

      return {
        status: 'success',
        message: `Print request sent successfully to printer at ${printerIp}`,
        data: [],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      if (axios.isAxiosError(error)) {
        throw new HttpException(
          {
            status: 'error',
            message: `Failed to send print request: ${error.response?.data?.message}`,
            data: [error.response?.data?.data || {}],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message || 'Failed to send print request',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
