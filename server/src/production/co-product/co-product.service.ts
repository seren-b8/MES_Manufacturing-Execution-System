// co-product/co-product.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CoProductRecord } from 'src/schema/co-product-reccord.shema';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { MasterPart } from 'src/schema/master_parts.schema';
import { SerialCodeService } from '../serial-code/serialcode.service';
import { ResponseFormat } from 'src/shared/interface';
import { CreateCoProductDto } from '../dto/co-product.dto';
import { toObjectId } from 'src/shared/utils/type.utils';
import { AssignEmployee } from 'src/schema/assign-employee.schema';
import { LabelService } from 'src/label/label.service';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { PrinterDevice } from 'src/schema/printer-device.schema';
import { GenerateLabelDto } from 'src/label/dto/generate-label.dto';
import { machine } from 'os';

@Injectable()
export class CoProductService {
  constructor(
    @InjectModel(CoProductRecord.name)
    private readonly coProductRecordModel: Model<CoProductRecord>,

    @InjectModel(AssignOrder.name)
    private readonly assignOrderModel: Model<AssignOrder>,

    @InjectModel(AssignEmployee.name)
    private readonly assignEmployeeModel: Model<AssignEmployee>,

    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,

    @InjectModel(MasterPart.name)
    private readonly masterPartModel: Model<MasterPart>,

    @InjectModel(MachineInfo.name)
    private readonly machineInfoModel: Model<MachineInfo>,

    @InjectModel(PrinterDevice.name)
    private readonly printerDeviceModel: Model<PrinterDevice>,

    private readonly serialCodeService: SerialCodeService,
    private readonly labelService: LabelService,
  ) {}

  async getAll(): Promise<ResponseFormat<CoProductRecord>> {
    try {
      const records = await this.coProductRecordModel
        .aggregate([
          {
            $lookup: {
              from: 'assign_order',
              localField: 'assign_order_id',
              foreignField: '_id',
              as: 'assign_order',
            },
          },
          {
            $unwind: '$assign_order',
          },
          {
            $sort: { createdAt: -1 },
          },
        ])
        .exec();
      return {
        status: 'success',
        message: `Found ${records.length} co-product records`,
        data: records,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get co-product records: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createCoProductRecord(
    createCoProductDto: CreateCoProductDto,
  ): Promise<ResponseFormat<CoProductRecord>> {
    try {
      // 1. ตรวจสอบ assign order
      const assignOrder = await this.assignOrderModel.findById(
        createCoProductDto.assign_order_id,
      );
      if (!assignOrder) {
        throw new Error('Assign order not found');
      }

      // 2. ตรวจสอบ assign employee
      const assignEmployees = await this.assignEmployeeModel.find({
        assign_order_id: toObjectId(createCoProductDto.assign_order_id),
        status: 'active',
      });
      if (!assignEmployees || assignEmployees.length === 0) {
        throw new Error('Assign employees not found');
      }

      // 2. ดึงข้อมูล production order
      const productionOrder = await this.productionOrderModel.findById(
        assignOrder.production_order_id,
      );
      if (!productionOrder) {
        throw new Error('Production order not found');
      }

      // 3. ตรวจสอบ master part ว่ามี co-product หรือไม่
      const masterPart = await this.masterPartModel.findOne({
        material_number: productionOrder.material_number,
      });

      if (!masterPart?.is_co_product || !masterPart?.co_product_material) {
        throw new Error('This material does not have co-product');
      }

      // 4. สร้าง serial code สำหรับ co-product
      const { _id: serialCounterId, serial: serialCode } =
        await this.serialCodeService.generateCoProductSerialCode(
          createCoProductDto.assign_order_id,
          masterPart.co_product_material,
          assignOrder.machine_number,
        );

      // 5. สร้าง co-product record
      const coProductRecord = await this.coProductRecordModel.create({
        assign_order_id: toObjectId(createCoProductDto.assign_order_id),
        assign_employee_ids: assignEmployees.map((emp) =>
          toObjectId(emp._id.toString()),
        ),
        co_material_number: masterPart.co_product_material,
        co_quantity: createCoProductDto.co_quantity,
        serial_code: serialCode,
        production_date: this.calculateProductionDate(),
        remark: createCoProductDto.remark,
      });

      const machine = await this.machineInfoModel.findOne({
        machine_number: createCoProductDto.machine_number,
      });
      if (createCoProductDto.machine_number && machine.printer_id) {
        const label = await this.generateLabel([coProductRecord]);

        await this.labelService.printLabel(
          String(label.data[0]._id),
          createCoProductDto.machine_number,
        );
      }

      return {
        status: 'success',
        message: 'Co-product record created successfully',
        data: [coProductRecord],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to create co-product record: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async generateLabel(records: CoProductRecord[]) {
    const labelDto: GenerateLabelDto = {
      co_product_record_ids: records.map((r) => r._id.toString()),
      label_type: (records.length === 1
        ? 'co_product_separate'
        : 'co_product_combined') as
        | 'co_product_separate'
        | 'co_product_combined',
      printer_id: await this.getPrinterId(records[0]),
      copies: 1,
    };
    return this.labelService.generateLabel(labelDto);
  }

  private async getPrinterId(record: CoProductRecord): Promise<string> {
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

  async getCoProductRecords(
    assignOrderId?: string,
    materialNumber?: string,
  ): Promise<ResponseFormat<CoProductRecord>> {
    try {
      const filter: any = {};

      if (assignOrderId) filter.assign_order_id = assignOrderId;
      if (materialNumber) filter.co_material_number = materialNumber;

      const records = await this.coProductRecordModel
        .find(filter)
        .populate('assign_order_id')
        .sort({ createdAt: -1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${records.length} co-product records`,
        data: records,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get co-product records: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCoProductRecord(
    id: string,
  ): Promise<ResponseFormat<CoProductRecord>> {
    try {
      const record = await this.coProductRecordModel
        .findById(id)
        .populate('assign_order_id')
        .exec();

      if (!record) {
        throw new Error('Co-product record not found');
      }

      return {
        status: 'success',
        message: 'Co-product record retrieved successfully',
        data: [record],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get co-product record: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async updateCoProductRecord(
    id: string,
    updateData: Partial<CreateCoProductDto>,
  ): Promise<ResponseFormat<CoProductRecord>> {
    try {
      const record = await this.coProductRecordModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .populate('assign_order_id')
        .exec();

      if (!record) {
        throw new Error('Co-product record not found');
      }

      return {
        status: 'success',
        message: 'Co-product record updated successfully',
        data: [record],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to update co-product record: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async deleteCoProductRecord(
    id: string,
  ): Promise<ResponseFormat<CoProductRecord>> {
    try {
      const record = await this.coProductRecordModel.findByIdAndDelete(id);

      if (!record) {
        throw new Error('Co-product record not found');
      }

      return {
        status: 'success',
        message: 'Co-product record deleted successfully',
        data: [record],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to delete co-product record: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Helper method สำหรับคำนวณ production date
  private calculateProductionDate(): Date {
    const now = new Date();
    const hour = now.getHours();

    // ถ้าก่อน 8:00 น. ใช้วันก่อนหน้า
    if (hour < 8) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    return now;
  }

  // Helper method สำหรับตรวจสอบว่า assign order มี co-product หรือไม่
  async checkCoProductAvailable(assignOrderId: string): Promise<{
    hasCoProduct: boolean;
    coMaterialNumber?: string;
    masterPart?: any;
  }> {
    try {
      const assignOrder = await this.assignOrderModel.findById(assignOrderId);
      if (!assignOrder) {
        return { hasCoProduct: false };
      }

      const productionOrder = await this.productionOrderModel.findById(
        assignOrder.production_order_id,
      );
      if (!productionOrder) {
        return { hasCoProduct: false };
      }

      const masterPart = await this.masterPartModel.findOne({
        material_number: productionOrder.material_number,
      });

      return {
        hasCoProduct:
          masterPart?.is_co_product && !!masterPart?.co_product_material,
        coMaterialNumber: masterPart?.co_product_material,
        masterPart,
      };
    } catch (error) {
      return { hasCoProduct: false };
    }
  }
}
