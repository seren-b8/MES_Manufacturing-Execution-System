import {
  Injectable,
  HttpException,
  HttpStatus,
  ConsoleLogger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Model, Types } from 'mongoose';
import { AssignEmployee } from 'src/schema/assign-employee.schema';
import { MasterNotGood } from 'src/schema/master-not-good.schema';
import { ProductionRecord } from 'src/schema/production-record.schema';
import {
  CreateProductionRecordDto,
  PrintDto,
  PrintRequestDto,
  SalePrintDto,
  UpdateProductionRecordDto,
} from '../dto/production-reccord.dto';
import {
  ProductionDailySummary,
  ProductionStageOverview,
  ProductionStageSummary,
  ResponseFormat,
} from 'src/shared/interface';
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
import { string } from 'yargs';
import { error } from 'console';
import { Employee } from 'src/schema/employee.schema';
import { PrinterDevice } from 'src/schema/printer-device.schema';
import { console } from 'inspector';
import { GenerateLabelDto } from 'src/label/dto/generate-label.dto';
import * as redisStore from 'cache-manager-redis-store';
import { LabelService } from 'src/label/label.service';
import * as _ from 'lodash';
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

    @InjectModel(Employee.name) private employeeModel: Model<Employee>,

    @InjectModel(PrinterDevice.name)
    private printerDeviceModel: Model<PrinterDevice>,

    @InjectModel(SerialCounter.name)
    private serialCounterModel: Model<SerialCounter>,

    @InjectModel(PrinterDevice.name)
    private printerDeviecModel: Model<PrinterDevice>,

    private AssignEmployeeService: AssignEmployeeService,

    private readonly machineInfoService: MachineInfoService,

    private readonly serialCodeService: SerialCodeService,

    private readonly labelService: LabelService,
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
        // console.log('No cavity found for material:', materialNumber);
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
      const records = await this.productionRecordModel
        .find({
          assign_order_id: toObjectId(assignOrderId),
        })
        .exec(); // เพิ่ม .exec()

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
      await this.assignOrderModel
        .findByIdAndUpdate(toObjectId(assignOrderId), {
          $set: {
            current_summary: {
              ...summary,
              last_update: moment().tz('Asia/Bangkok').toDate(), // เพิ่ม timezone
            },
          },
        })
        .exec(); // เพิ่ม .exec()
    } catch (error) {
      console.error('Failed to update assign order summary:', error);
      throw error; // throw error เพื่อให้ parent method จัดการ
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
        // console.log('New Assign Employee:', newAssignEmployee);
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
      // Debug query
      console.log('Original query:', query);
      console.log(
        'Query types:',
        Object.keys(query).map((key) => `${key}: ${typeof query[key]}`),
      );

      // แปลง string เป็น number และกำหนดค่า default
      const pageNum = parseInt(page.toString()) || 1;
      const limitNum = parseInt(limit.toString()) || 10;

      // จำกัดค่า limit สูงสุด
      const maxLimit = Math.min(limitNum, 1000);
      const skip = (pageNum - 1) * maxLimit;

      const pipeline = [
        // Match stage - กรองข้อมูลตาม query
        { $match: query },

        // Lookup master_not_good
        {
          $lookup: {
            from: 'master_not_good',
            localField: 'master_not_good_id',
            foreignField: '_id',
            as: 'master_not_good',
            pipeline: [{ $project: { case_english: 1, case_thai: 1 } }],
          },
        },

        // Lookup assign_order และ production_order
        {
          $lookup: {
            from: 'assign_order',
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order_id',
            pipeline: [
              {
                $lookup: {
                  from: 'production_order',
                  localField: 'production_order_id',
                  foreignField: '_id',
                  as: 'production_order_id',
                  pipeline: [
                    {
                      $project: {
                        order_id: 1,
                        material_number: 1,
                        material_description: 1,
                        target_quantity: 1,
                      },
                    },
                  ],
                },
              },
              {
                $addFields: {
                  production_order_id: {
                    $arrayElemAt: ['$production_order_id', 0],
                  },
                },
              },
            ],
          },
        },

        // Lookup assign_employee และ user
        {
          $lookup: {
            from: 'assign_employee',
            localField: 'assign_employee_ids',
            foreignField: '_id',
            as: 'assign_employee_ids',
            pipeline: [
              {
                $lookup: {
                  from: 'users',
                  localField: 'user_id',
                  foreignField: '_id',
                  as: 'user_id',
                  pipeline: [{ $project: { employee_id: 1 } }],
                },
              },
              {
                $addFields: {
                  user_id: { $arrayElemAt: ['$user_id', 0] },
                },
              },
            ],
          },
        },

        // Lookup confirmed_by user
        {
          $lookup: {
            from: 'users',
            localField: 'confirmed_by',
            foreignField: '_id',
            as: 'confirmed_by_user',
            pipeline: [{ $project: { employee_id: 1 } }],
          },
        },

        // แปลง array fields และรักษาโครงสร้างเดิม
        {
          $addFields: {
            master_not_good_id: { $arrayElemAt: ['$master_not_good', 0] },
            assign_order_id: { $arrayElemAt: ['$assign_order_id', 0] },
            confirmed_by: { $arrayElemAt: ['$confirmed_by_user', 0] },
          },
        },

        // เอา field ที่ไม่ต้องการออก
        {
          $unset: ['confirmed_by_user', 'master_not_good'],
        },

        // Sort
        { $sort: { createdAt: -1 } },

        // Facet for pagination
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: maxLimit }],
            count: [{ $count: 'total' }],
          },
        },
      ];

      const result = await this.productionRecordModel.aggregate(pipeline as []);

      const records = result[0]?.data || [];
      const total = result[0]?.count[0]?.total || 0;

      return {
        status: 'success',
        message: 'Production records retrieved successfully',
        data: records,
        pagination: {
          total,
          page: pageNum,
          limit: maxLimit,
          totalPages: Math.ceil(total / maxLimit),
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
          confirmed_by: toObjectId(updateDto.confirmed_by),
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
    let deletedRecord: any = null; // เก็บข้อมูลก่อนลบ

    try {
      // 1. ค้นหา Production Record พร้อมข้อมูลที่เกี่ยวข้อง
      const record = await this.productionRecordModel
        .findById(id)
        .populate('assign_order_id')
        .populate('serial_counter_id')
        .exec(); // เพิ่ม .exec()

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

      // เก็บข้อมูลก่อนลบ
      deletedRecord = record.toObject();

      // 2. ตรวจสอบสถานะการยืนยัน
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

      // 3. ตรวจสอบการ sync ไป SAP
      if (record.is_synced_to_sap) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Cannot delete record that has been synced to SAP',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // 4. ตรวจสอบ Assign Order
      if (!record.assign_order_id) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Invalid production record: missing assign order',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const assignOrder = record.assign_order_id as any;

      // 5. ค้นหาข้อมูลเครื่องจักร
      const machine = await this.machineInfoModel
        .findOne({ machine_number: assignOrder.machine_number })
        .exec(); // เพิ่ม .exec()

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

      // 6. จัดการ Serial Counter (ถ้ามี)
      if (record.serial_counter_id && record.serial_code) {
        try {
          // แยก sequence จาก serial code
          const serialParts = record.serial_code.split('-');
          const sequence = Number(serialParts.at(-1));

          if (!isNaN(sequence) && sequence > 0) {
            // ตรวจสอบว่า serial counter ยังมีอยู่และ sequence ตรงกัน
            const serialCounter = await this.serialCounterModel
              .findById(record.serial_counter_id)
              .exec(); // เพิ่ม .exec()

            if (serialCounter && serialCounter.sequence == sequence) {
              await this.serialCounterModel
                .findByIdAndUpdate(record.serial_counter_id, {
                  $inc: { sequence: -1 },
                })
                .exec(); // เพิ่ม .exec()
            }
          }
        } catch (serialError) {
          console.warn('Error updating serial counter:', serialError);
        }
      }

      // 7. อัพเดท Machine Counter (เฉพาะงานดี)
      if (!record.is_not_good && record.quantity > 0) {
        // ตรวจสอบว่า recorded_counter เพียงพอ
        if (machine.recorded_counter >= record.quantity) {
          await this.machineInfoModel
            .findOneAndUpdate(
              { machine_number: assignOrder.machine_number },
              { $inc: { recorded_counter: -record.quantity } },
            )
            .exec(); // เพิ่ม .exec()
        } else {
          console.warn(
            `Insufficient recorded_counter for machine ${assignOrder.machine_number}`,
          );
          // Reset recorded_counter to 0 if it would go negative
          await this.machineInfoModel
            .findOneAndUpdate(
              { machine_number: assignOrder.machine_number },
              { recorded_counter: 0 },
            )
            .exec(); // เพิ่ม .exec()
        }
      }

      // 8. ลบ Production Record
      await this.productionRecordModel.findByIdAndDelete(id).exec(); // เพิ่ม .exec()

      // 9. อัพเดท Assign Order Summary
      await this.updateAssignOrderSummary(assignOrder._id.toString());

      // Return ข้อมูลที่เก็บไว้
      return {
        status: 'success',
        message: 'Production record deleted successfully',
        data: [deletedRecord], // ใช้ข้อมูลที่เก็บไว้แทน
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      console.error('Error deleting production record:', error);
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
      const data = await this.productionRecordModel.aggregate([
        { $match: { serial_code: serialCode } },
        {
          $lookup: {
            from: this.assignOrderModel.collection.collectionName,
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order',
            pipeline: [
              {
                $lookup: {
                  from: this.productionOrderModel.collection.collectionName,
                  localField: 'production_order_id',
                  foreignField: '_id',
                  as: 'production_order',
                },
              },
              {
                $unwind: { path: '$production_order' },
              },
            ],
          },
        },
        {
          $unwind: { path: '$assign_order' },
        },
      ]);

      if (data.length === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'No production record found with the provided serial code',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const record = data[0]; // Get the first record from the aggregation result

      // Check if record is already confirmed
      if (record?.confirmation_status === 'confirmed') {
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
      await this.productionRecordModel
        .findByIdAndUpdate(
          record._id,
          {
            $set: {
              confirmation_status: 'confirmed',
              confirmed_by: user._id,
              confirmed_at: moment().tz('Asia/Bangkok').toDate(),
            },
          },
          { new: true },
        )
        .populate('master_not_good_id', 'case_english case_thai')
        .populate('confirmed_by');

      const dataReturn = [
        {
          quantity: record.quantity,
          production_date:
            record.createdAt || moment().tz('Asia/Bangkok').toDate(),
          material_number: record.assign_order.production_order.material_number,
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
    startDateParam?: string,
    endDateParam?: string,
  ): Promise<ResponseFormat<ProductionDailySummary>> {
    try {
      // กำหนดวันที่เริ่มต้นและสิ้นสุด
      const startDate = startDateParam
        ? moment(startDateParam, 'YYYY-MM-DD').tz('Asia/Bangkok')
        : moment().tz('Asia/Bangkok').startOf('day');

      const endDate = endDateParam
        ? moment(endDateParam, 'YYYY-MM-DD').tz('Asia/Bangkok')
        : startDateParam
          ? moment(startDateParam, 'YYYY-MM-DD').tz('Asia/Bangkok')
          : moment().tz('Asia/Bangkok').endOf('day');

      startDate.startOf('day');
      endDate.endOf('day');

      // ตรวจสอบวันที่
      if (endDate.isBefore(startDate)) {
        throw new Error('End date must be after start date');
      }

      const collectionNames = {
        machine: this.machineInfoModel.collection.collectionName,
        order: this.productionOrderModel.collection.collectionName,
        assignOrder: this.assignOrderModel.collection.collectionName,
        productionRecord: this.productionRecordModel.collection.collectionName,
        assignEmployee: this.assignEmployeeModel.collection.collectionName,
        user: this.userModel.collection.collectionName,
        cavity: this.masterCavityModel.collection.collectionName,
        part: this.masterPartModel.collection.collectionName,
        serialCounter: this.serialCounterModel.collection.collectionName,
      };

      const dailyData = await this.productionRecordModel.aggregate([
        {
          $match: {
            production_date: {
              $gte: startDate.toDate(),
              $lte: endDate.toDate(),
            },
            confirmation_status: { $in: ['confirmed', 'pending'] },
          },
        },
        {
          $lookup: {
            from: collectionNames.serialCounter,
            localField: 'serial_counter_id',
            foreignField: '_id',
            as: 'serial_counter',
          },
        },
        { $unwind: '$serial_counter' },
        {
          $lookup: {
            from: collectionNames.assignOrder,
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order',
          },
        },
        { $unwind: '$assign_order' },
        {
          $lookup: {
            from: collectionNames.order,
            localField: 'assign_order.production_order_id',
            foreignField: '_id',
            as: 'order',
          },
        },
        { $unwind: '$order' },
        {
          $project: {
            quantity: 1,
            machine_number: '$serial_counter.machine_number',
            type: '$serial_counter.type',
            shift: '$serial_counter.shift',
            date: '$serial_counter.date',
            order_id: '$order.order_id',
            material_number: '$order.material_number',
            material_description: '$order.material_description',
            target_quantity: '$order.target_quantity',
          },
        },
        // Group ตาม date, machine_number, order_id
        {
          $group: {
            _id: {
              date: '$date',
              machine_number: '$machine_number',
              order_id: '$order_id',
            },
            // แยกจำนวนตาม type (OK/NG)
            good_quantity: {
              $sum: { $cond: [{ $eq: ['$type', 'OK'] }, '$quantity', 0] },
            },
            ng_quantity: {
              $sum: { $cond: [{ $eq: ['$type', 'NG'] }, '$quantity', 0] },
            },
            // แยกตาม shift
            day_good: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$type', 'OK'] },
                      { $eq: ['$shift', 'day'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            day_ng: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$type', 'NG'] },
                      { $eq: ['$shift', 'day'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            night_good: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$type', 'OK'] },
                      { $eq: ['$shift', 'night'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            night_ng: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$type', 'NG'] },
                      { $eq: ['$shift', 'night'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            // ข้อมูลอื่นๆ
            material_number: { $first: '$material_number' },
            material_description: { $first: '$material_description' },
            target_quantity: { $first: '$target_quantity' },
            total_records: { $sum: 1 },
          },
        },
        // Flatten ข้อมูล
        {
          $project: {
            date: '$_id.date',
            machine_number: '$_id.machine_number',
            order_id: '$_id.order_id',
            good_quantity: 1,
            ng_quantity: 1,
            total_quantity: { $add: ['$good_quantity', '$ng_quantity'] },
            day_shift: {
              good: '$day_good',
              ng: '$day_ng',
              total: { $add: ['$day_good', '$day_ng'] },
            },
            night_shift: {
              good: '$night_good',
              ng: '$night_ng',
              total: { $add: ['$night_good', '$night_ng'] },
            },
            material_number: 1,
            material_description: 1,
            target_quantity: 1,
            total_records: 1,
            _id: 0,
          },
        },
        { $sort: { date: 1, machine_number: 1, order_id: 1 } },
      ]);

      return {
        status: 'success',
        message: `Daily production summary retrieved successfully`,
        data: dailyData,
      };
    } catch (error) {
      console.error('Error in findSummaryAllMachines:', error);
      return {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
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
        tag_no:
          data.serial_number && data.serial_number.includes('-')
            ? parseInt(data.serial_number.split('-')[2] || '0', 10) || 0
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
      // console.log('printPayload', printPayload);

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

  async printSaleLabel(data: SalePrintDto[]): Promise<ResponseFormat<any>> {
    console.error('🔥🔥🔥 SERVICE METHOD CALLED 🔥🔥🔥');
    console.error('🔥 printSaleLabel data:', JSON.stringify(data, null, 2));

    try {
      // Validate input array
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Data array is required and cannot be empty',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = [];
      const errors = [];

      // Process each item in the array
      for (let i = 0; i < data.length; i++) {
        const item = data[i];

        try {
          // Validate required fields for each item
          if (!item.material_no || !item.quantity) {
            throw new Error(
              `Item ${i + 1}: material_no and quantity are required`,
            );
          }

          if (!item.device_name) {
            throw new Error(`Item ${i + 1}: device_name is required`);
          }

          // Find printer device for this item
          const printer = await this.printerDeviecModel.findOne({
            device_name: item.device_name,
            status: 'active',
          });

          if (!printer) {
            throw new Error(
              `Item ${i + 1}: Active printer device '${item.device_name}' not found`,
            );
          }

          const printerIp = printer.ip_device;
          const printServiceUrl = `http://${printerIp}:8000/api/print`;

          // ใช้ pattern เดียวกับ printLabel ที่ทำงานได้
          let printPayload: PrintDto = {
            tag_no: item.tag_no || 0,
            order_id: '',
            sap_no: item.material_no || '',
            customer_name: '',
            model: '',
            supplier: 'Serenity',
            part_code: '-',
            part_name: '-',
            mat: '-',
            color: '-',
            producer: '-',
            date: this.formatDateForPrinter(
              new Date().toISOString().split('T')[0],
            ), // ใช้ formatDateForPrinter
            quantity: item.quantity || 0,
            number_of_tags: item.number_of_tags || 1,
            code: '-',
            image_url: '',
          };

          // ตรวจสอบ serial_code_mes
          // แนะนำ (เข้าใจง่าย)
          if (
            item.serial_code_mes &&
            !item.serial_code_mes.startsWith('B8MES|')
          ) {
            item.serial_code_mes = 'B8MES|' + item.serial_code_mes;
          }

          // If serial_code_mes is provided, get data from production record
          if (item.serial_code_mes) {
            // ใช้ aggregate pattern เดียวกับ printLabel
            const records = await this.productionRecordModel.aggregate([
              {
                $match: {
                  serial_code: item.serial_code_mes,
                },
              },
              {
                $lookup: {
                  from: 'assign_order',
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
                  from: 'production_order',
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
              {
                $lookup: {
                  from: 'master_parts',
                  localField: 'production_order.material_number',
                  foreignField: 'material_number',
                  as: 'part_info',
                },
              },
              {
                $unwind: {
                  path: '$part_info',
                  preserveNullAndEmptyArrays: true,
                },
              },
              // ใช้ cavity lookup pattern เดียวกับ printLabel
              {
                $lookup: {
                  from: 'master_cavity',
                  let: { part_id: '$part_info._id' },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $in: ['$$part_id', '$parts'] },
                      },
                    },
                  ],
                  as: 'cavity_info',
                },
              },
              {
                $lookup: {
                  from: 'assign_employee',
                  localField: 'assign_employee_ids',
                  foreignField: '_id',
                  as: 'assign_employees',
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'assign_employees.user_id',
                  foreignField: '_id',
                  as: 'users',
                },
              },
              {
                $lookup: {
                  from: 'employee',
                  localField: 'users.employee_id',
                  foreignField: 'employee_id',
                  as: 'employees',
                },
              },
              {
                $project: {
                  _id: 1,
                  serial_code: 1,
                  quantity: 1,
                  is_not_good: 1,
                  production_date: 1,
                  createdAt: 1,
                  // Order Information
                  order_id: '$production_order.order_id',
                  material_number: '$production_order.material_number',
                  material_description:
                    '$production_order.material_description',
                  machine_number: '$assign_order.machine_number',
                  // Part Information - ใช้ pattern เดียวกับ printLabel
                  part_number: '$part_info.part_number',
                  part_name: '$part_info.part_name',
                  part_model: '$part_info.part_model',
                  weight: '$part_info.weight',
                  image_url: '$part_info.image_url',
                  // Cavity Information - ใช้ [0] เหมือน printLabel
                  cavity_customer: {
                    $arrayElemAt: ['$cavity_info.customer', 0],
                  },
                  cavity_color: { $arrayElemAt: ['$cavity_info.color', 0] },
                  cavity_mat: { $arrayElemAt: ['$cavity_info.mat', 0] },
                  // Employee Information
                  employees: {
                    $map: {
                      input: '$employees',
                      as: 'emp',
                      in: {
                        employee_id: '$$emp.employee_id',
                        first_name: '$$emp.first_name',
                        last_name: '$$emp.last_name',
                        department: '$$emp.department',
                      },
                    },
                  },
                },
              },
            ]);

            if (!records || records.length === 0) {
              throw new Error(
                `Item ${i + 1}: Production record not found for serial code '${item.serial_code_mes}'`,
              );
            }

            const record = records[0];

            // คำนวณ tag_no เหมือน printLabel
            const tagNo =
              item.tag_no || item.serial_code_mes
                ? parseInt(item.serial_code_mes.split('-')[2] || '0000')
                : 0;

            // Update printPayload with data from production record - ใช้ pattern เดียวกับ printLabel
            printPayload = {
              tag_no: tagNo,
              order_id: record.order_id ?? '-',
              sap_no: record.material_number ?? item.material_no ?? '-',
              customer_name: record.cavity_customer ?? '-',
              model: record.part_model ?? '-',
              supplier: 'Serenity',
              part_code: record.part_number ?? '-',
              part_name: record.part_name ?? '-',
              mat: record.cavity_mat ?? '-',
              color: record.cavity_color ?? '-',
              producer: this.getEmployeeIds(record.employees),
              date: record.production_date
                ? this.formatDateForPrinter(
                    new Date(record.production_date)
                      .toISOString()
                      .split('T')[0],
                  )
                : this.formatDateForPrinter(
                    new Date().toISOString().split('T')[0],
                  ),
              quantity: item.quantity || 0,
              number_of_tags: item.number_of_tags || 1,
              code: record.serial_code ?? '-',
              image_url: record.image_url ?? '',
            };
          } else {
            // If no serial_code_mes, get part information from material_number - ใช้ pattern เดียวกับ printLabel
            if (item.material_no) {
              const masterPart = await this.masterPartModel.aggregate([
                {
                  $match: { material_number: item.material_no },
                },
                {
                  $lookup: {
                    from: 'master_cavity',
                    let: { part_id: '$_id' },
                    pipeline: [
                      {
                        $match: {
                          $expr: { $in: ['$$part_id', '$parts'] },
                        },
                      },
                    ],
                    as: 'cavity_info',
                  },
                },
              ]);

              if (masterPart && masterPart.length > 0) {
                const part = masterPart[0];
                printPayload = {
                  ...printPayload,
                  sap_no: part.material_number ?? item.material_no ?? '-',
                  customer_name: part.cavity_info[0]?.customer ?? '-',
                  model: part.part_model ?? '-',
                  part_code: part.part_number ?? '-',
                  part_name: part.part_name ?? '-',
                  mat: part.cavity_info[0]?.mat ?? '-',
                  color: part.cavity_info[0]?.color ?? '-',
                  image_url: part.image_url ?? '',
                };
              }
            }
          }

          // Validate print payload
          this.validatePrintPayload(printPayload);

          console.error('=== SENDING TO PRINT SERVICE ===');
          console.error('URL:', printServiceUrl);
          console.error('Payload:', JSON.stringify(printPayload, null, 2));

          // ส่ง request ไปยัง print service - ใช้ pattern เดียวกับ printLabel
          await axios.post(printServiceUrl, printPayload);

          // Add successful result
          results.push({
            index: i + 1,
            item_id: item.serial_code_mes || item.material_no,
            print_payload: printPayload,
            printer_info: {
              device_name: printer.device_name,
              ip_address: printerIp,
              status: printer.status,
            },
            processed_at: moment().tz('Asia/Bangkok').toISOString(),
            status: 'success',
          });
        } catch (itemError) {
          // Collect errors for individual items
          const errorInfo = {
            index: i + 1,
            item_id: item.serial_code_mes || item.material_no || 'unknown',
            error: (itemError as Error).message,
            processed_at: moment().tz('Asia/Bangkok').toISOString(),
            status: 'error',
          };

          errors.push(errorInfo);
        }
      }

      // Determine overall response status
      const hasErrors = errors.length > 0;
      const hasSuccess = results.length > 0;

      let status: 'success' | 'error' = 'success';
      let message = '';

      if (hasSuccess && !hasErrors) {
        status = 'success';
        message = `All ${results.length} print requests prepared successfully`;
      } else if (hasSuccess && hasErrors) {
        status = 'success';
        message = `${results.length} successful, ${errors.length} failed out of ${data.length} items`;
      } else {
        status = 'error';
        message = `All ${errors.length} print requests failed`;
      }

      return {
        status,
        message,
        data: [
          {
            summary: {
              total_items: data.length,
              successful: results.length,
              failed: errors.length,
              processed_at: moment().tz('Asia/Bangkok').toISOString(),
            },
            results: results,
            errors: hasErrors ? errors : undefined,
          },
        ],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new HttpException(
        {
          status: 'error',
          message:
            (error as Error).message || 'Failed to process print requests',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Helper method สำหรับจัดรูปแบบชื่อพนักงาน
  private getEmployeeIds(employees: any[]): string {
    if (!employees || employees.length === 0) {
      return '-';
    }

    const employeeIds = employees
      .map((emp) => emp?.employee_id)
      .filter((id) => id)
      .join(' ');

    return employeeIds || '-';
  }

  // ผลลัพธ์: "EMP001, EMP002, EMP003"

  // Helper method สำหรับ validate print payload
  private validatePrintPayload(payload: PrintDto): void {
    const requiredFields = ['sap_no', 'quantity'];
    const missingFields = requiredFields.filter((field) => !payload[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required fields for printing: ${missingFields.join(', ')}`,
      );
    }

    if (payload.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
  }

  async findSummaryByStage(): Promise<ResponseFormat<ProductionStageSummary>> {
    try {
      const collectionNames = {
        order: this.productionOrderModel.collection.collectionName,
        assignOrder: this.assignOrderModel.collection.collectionName,
        serialCounter: this.serialCounterModel.collection.collectionName,
      };

      const stageData = await this.productionRecordModel.aggregate([
        {
          $match: {
            // รวมทุก status
            confirmation_status: { $in: ['confirmed', 'pending', 'rejected'] },
          },
        },
        {
          $lookup: {
            from: collectionNames.serialCounter,
            localField: 'serial_counter_id',
            foreignField: '_id',
            as: 'serial_counter',
          },
        },
        { $unwind: '$serial_counter' },
        {
          $lookup: {
            from: collectionNames.assignOrder,
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order',
          },
        },
        { $unwind: '$assign_order' },
        {
          $lookup: {
            from: collectionNames.order,
            localField: 'assign_order.production_order_id',
            foreignField: '_id',
            as: 'order',
          },
        },
        { $unwind: '$order' },
        {
          $project: {
            quantity: 1,
            confirmation_status: 1,
            is_not_good: 1,
            machine_number: '$serial_counter.machine_number',
            type: '$serial_counter.type',
            date: '$serial_counter.date',
            order_id: '$order.order_id',
            material_number: '$order.material_number',
            material_description: '$order.material_description',
            target_quantity: '$order.target_quantity',
          },
        },
        // Group ตาม date, machine_number, order_id
        {
          $group: {
            _id: {
              date: '$date',
              machine_number: '$machine_number',
              order_id: '$order_id',
            },

            // แยกจำนวนตาม confirmation_status
            pending_quantity: {
              $sum: {
                $cond: [
                  { $eq: ['$confirmation_status', 'pending'] },
                  '$quantity',
                  0,
                ],
              },
            },
            confirmed_quantity: {
              $sum: {
                $cond: [
                  { $eq: ['$confirmation_status', 'confirmed'] },
                  '$quantity',
                  0,
                ],
              },
            },
            rejected_quantity: {
              $sum: {
                $cond: [
                  { $eq: ['$confirmation_status', 'rejected'] },
                  '$quantity',
                  0,
                ],
              },
            },

            // Stage Details - Pending
            pending_good: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$confirmation_status', 'pending'] },
                      { $eq: ['$type', 'OK'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            pending_ng: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$confirmation_status', 'pending'] },
                      { $eq: ['$type', 'NG'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            pending_records: {
              $sum: {
                $cond: [{ $eq: ['$confirmation_status', 'pending'] }, 1, 0],
              },
            },

            // Stage Details - Confirmed
            confirmed_good: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$confirmation_status', 'confirmed'] },
                      { $eq: ['$type', 'OK'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            confirmed_ng: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$confirmation_status', 'confirmed'] },
                      { $eq: ['$type', 'NG'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            confirmed_records: {
              $sum: {
                $cond: [{ $eq: ['$confirmation_status', 'confirmed'] }, 1, 0],
              },
            },

            // Stage Details - Rejected
            rejected_good: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$confirmation_status', 'rejected'] },
                      { $eq: ['$type', 'OK'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            rejected_ng: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$confirmation_status', 'rejected'] },
                      { $eq: ['$type', 'NG'] },
                    ],
                  },
                  '$quantity',
                  0,
                ],
              },
            },
            rejected_records: {
              $sum: {
                $cond: [{ $eq: ['$confirmation_status', 'rejected'] }, 1, 0],
              },
            },

            // ข้อมูลอื่นๆ
            material_number: { $first: '$material_number' },
            material_description: { $first: '$material_description' },
            target_quantity: { $first: '$target_quantity' },
            total_records: { $sum: 1 },
          },
        },
        // Flatten ข้อมูล
        {
          $project: {
            date: '$_id.date',
            machine_number: '$_id.machine_number',
            order_id: '$_id.order_id',

            pending_quantity: 1,
            confirmed_quantity: 1,
            rejected_quantity: 1,
            total_quantity: {
              $add: [
                '$pending_quantity',
                '$confirmed_quantity',
                '$rejected_quantity',
              ],
            },

            stages: {
              pending: {
                good: '$pending_good',
                ng: '$pending_ng',
                total: { $add: ['$pending_good', '$pending_ng'] },
                records: '$pending_records',
              },
              confirmed: {
                good: '$confirmed_good',
                ng: '$confirmed_ng',
                total: { $add: ['$confirmed_good', '$confirmed_ng'] },
                records: '$confirmed_records',
              },
              rejected: {
                good: '$rejected_good',
                ng: '$rejected_ng',
                total: { $add: ['$rejected_good', '$rejected_ng'] },
                records: '$rejected_records',
              },
            },

            material_number: 1,
            material_description: 1,
            target_quantity: 1,
            total_records: 1,
            _id: 0,
          },
        },
        {
          $sort: {
            pending_quantity: -1,
            date: 1,
            machine_number: 1,
            order_id: 1,
          },
        },
        { $limit: 1000 }, // ป้องกันข้อมูลมากเกินไป
      ]);

      return {
        status: 'success',
        message: 'Production stage summary retrieved successfully',
        data: stageData as ProductionStageSummary[],
      };
    } catch (error) {
      console.error('Error in findSummaryByStage:', error);
      return {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        data: [],
      };
    }
  }

  async getStageOverview(): Promise<ResponseFormat<ProductionStageOverview>> {
    try {
      const overview = await this.productionRecordModel.aggregate([
        {
          $match: {
            confirmation_status: { $in: ['confirmed', 'pending', 'rejected'] },
          },
        },
        {
          $group: {
            _id: '$confirmation_status',
            total_quantity: { $sum: '$quantity' },
            total_records: { $sum: 1 },
            good_quantity: {
              $sum: { $cond: ['$is_not_good', 0, '$quantity'] },
            },
            ng_quantity: {
              $sum: { $cond: ['$is_not_good', '$quantity', 0] },
            },
          },
        },
        {
          $project: {
            stage: '$_id',
            total_quantity: 1,
            total_records: 1,
            good_quantity: 1,
            ng_quantity: 1,
            defect_rate: {
              $multiply: [
                { $divide: ['$ng_quantity', '$total_quantity'] },
                100,
              ],
            },
            _id: 0,
          },
        },
        { $sort: { stage: 1 } },
      ]);

      return {
        status: 'success',
        message: 'Production stage overview retrieved successfully',
        data: overview,
      };
    } catch (error) {
      console.error('Error in getStageOverview:', error);
      return {
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        data: [],
      };
    }
  }

  async createReccordBatch(
    createDtos: CreateProductionRecordDto[],
    userId: string,
    machineNumber?: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const createdRecords = [];

      // สร้าง records โดยใช้ service เดิม
      for (const dto of createDtos) {
        const result = await this.create(dto, userId);
        if (result.status === 'success') {
          createdRecords.push(result.data[0]);
        } else {
          throw new Error(result.message);
        }
      }

      // ตรวจสอบว่ามีข้อมูลที่สร้างได้
      if (createdRecords.length === 0) {
        throw new Error('No records were created');
      }

      const populatedRecords = await this.productionRecordModel.populate(
        createdRecords,
        [
          {
            path: 'assign_order_id',
            populate: {
              path: 'production_order_id',
              select: 'material_number',
            },
          },
        ],
      );

      // เรียงตาม material_number
      const sortedRecords = this.sortByMaterialNumber(populatedRecords);

      // สร้าง label
      const label = await this.generateLabel(sortedRecords);

      if (machineNumber) {
        await this.labelService.printLabel(
          String(label.data[0]._id),
          machineNumber,
        );
      }

      return {
        status: 'success',
        message: `${createdRecords.length} records created with label`,
        data: label.data,
      };
    } catch (error) {
      return this.handleServiceError(error);
    }
  }

  private sortByMaterialNumber(records: ProductionRecord[]) {
    return records.sort((a, b) => {
      const matA = (a.assign_order_id as any).production_order_id
        .material_number;
      const matB = (b.assign_order_id as any).production_order_id
        .material_number;

      if (!matA || !matB) {
        console.error('Missing material_number for sorting:', {
          recordA_id: a._id,
          recordB_id: b._id,
          matA,
          matB,
        });
        return 0; // ไม่เรียงลำดับถ้าข้อมูลไม่ครบ
      }
      return matA.localeCompare(matB);
    });
  }

  private async generateLabel(records: ProductionRecord[]) {
    // console.log('Generating label for records:', records);

    const labelDto: GenerateLabelDto = {
      production_record_ids: records.map((r) => r._id.toString()),
      label_type: records.length === 1 ? '1_part' : '2_part',
      printer_id: await this.getPrinterId(records[0]),
      copies: 1,
    };

    // console.log('Generating label with DTO:', labelDto);

    if (records.length === 2) {
      labelDto.position_mapping = {
        position_1: { type: 'main', record_id: records[0]._id.toString() },
        position_2: { type: 'main', record_id: records[1]._id.toString() },
      };
    }

    return this.labelService.generateLabel(labelDto);
  }

  private async getPrinterId(record: ProductionRecord): Promise<string> {
    const machineNumber = (record.assign_order_id as any).machine_number;
    const machine = await this.machineInfoModel.findOne({
      machine_number: machineNumber,
    });
    return (
      machine?.printer_id?.toString() || (await this.getDefaultPrinterId())
    );
  }

  private async getDefaultPrinterId(): Promise<string> {
    try {
      // หา printer ตัวแรกที่ active
      const defaultPrinter = await this.printerDeviceModel
        .findOne({ status: 'active' })
        .exec();

      if (!defaultPrinter) {
        throw new Error('No active printer found');
      }

      return defaultPrinter._id.toString();
    } catch (error) {
      throw new Error('Cannot find any printer in system');
    }
  }

  async findBySerial(serialCode: string): Promise<ResponseFormat<any>> {
    try {
      const record = await this.productionRecordModel.aggregate([
        {
          $match: { serial_code: serialCode },
        },
        {
          $lookup: {
            from: 'assign_order',
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order',
          },
        },
        { $unwind: '$assign_order' },
        {
          $lookup: {
            from: 'production_order',
            localField: 'assign_order.production_order_id',
            foreignField: '_id',
            as: 'production_order',
          },
        },
        { $unwind: '$production_order' },
        {
          $lookup: {
            from: 'master_parts',
            localField: 'production_order.material_number',
            foreignField: 'material_number',
            as: 'part_info',
          },
        },
        { $unwind: '$part_info' },
        {
          $project: {
            _id: 0,
            serial_code: 1,
            quantity: 1,
            // is_not_good: 1,
            // production_date: 1,
            // createdAt: 1,
            // assign_order_id: '$assign_order._id',
            // order_id: '$production_order.order_id',
            material_number: '$production_order.material_number',
            material_description: '$production_order.material_description',

            part_number: '$part_info.part_number',
            part_name: '$part_info.part_name',
          },
        },
      ]);
      if (!record) {
        throw new Error('No record found');
      }
      return {
        status: 'success',
        message: 'Record found',
        data: [record],
      };
    } catch (error) {
      return this.handleServiceError(error);
    }
  }
}
