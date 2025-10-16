import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LabelJob } from 'src/schema/label-job.shema';
import { PrinterDevice } from 'src/schema/printer-device.schema';
import { LabelGeneratorService } from './services/label-generator.service';
import { FileClientService } from 'src/shared/services/file-client/file-client.service';
import { ResponseFormat } from 'src/shared/interface';
import { LabelData } from 'src/shared/interface/label-data';
import axios from 'axios';
import {
  GenerateLabelDto,
  LabelDataDto,
  PartDataDto,
} from './dto/generate-label.dto';
import { CoProductRecord } from 'src/schema/co-product-reccord.shema';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { toObjectId } from 'src/shared/utils/type.utils';
import * as moment from 'moment-timezone';
import { machine } from 'os';
import { PrinterDevicesService } from 'src/machine/printer/printer.service';

@Injectable()
export class LabelService {
  constructor(
    @InjectModel(LabelJob.name) private readonly labelJobModel: Model<LabelJob>,
    @InjectModel(PrinterDevice.name)
    private readonly printerDeviceModel: Model<PrinterDevice>,
    @InjectModel(CoProductRecord.name)
    private readonly coProductRecordModel: Model<CoProductRecord>,
    @InjectModel(ProductionRecord.name)
    private readonly productionRecordModel: Model<ProductionRecord>,
    @InjectModel(MachineInfo.name)
    private readonly machineInfoModel: Model<MachineInfo>,

    private readonly labelGeneratorService: LabelGeneratorService,
    private readonly fileClientService: FileClientService,
    private readonly printerService: PrinterDevicesService,
  ) {}

  async generateLabel(
    generateLabelDto: GenerateLabelDto,
  ): Promise<ResponseFormat<LabelJob>> {
    try {
      const hasProduction =
        generateLabelDto.production_record_ids &&
        generateLabelDto.production_record_ids.length > 0;
      const hasCoProduct =
        generateLabelDto.co_product_record_ids &&
        generateLabelDto.co_product_record_ids.length > 0;

      if (!hasProduction && !hasCoProduct) {
        throw new Error(
          'At least one production or co-product record ID must be provided',
        );
      }

      const labelData: LabelDataDto =
        await this.prepareLabelDataFromDto(generateLabelDto);

      // Generate และ save label
      const { buffer, filePath } =
        await this.labelGeneratorService.generateAndSaveLabel(
          generateLabelDto.label_type,
          labelData,
        );

      // สร้าง LabelJob record
      const labelJob = await this.labelJobModel.create({
        production_record_ids: (
          generateLabelDto.production_record_ids || []
        ).map((id) => toObjectId(id)),
        co_product_record_ids: (
          generateLabelDto.co_product_record_ids || []
        ).map((id) => toObjectId(id)),
        label_type: generateLabelDto.label_type,
        printer_id: generateLabelDto.printer_id
          ? toObjectId(generateLabelDto.printer_id)
          : null,
        // position_mapping: generateLabelDto.position_mapping,
        position_mapping: generateLabelDto.position_mapping
          ? {
              position_1: {
                type: generateLabelDto.position_mapping?.position_1.type,
                record_id: toObjectId(
                  generateLabelDto.position_mapping?.position_1.record_id,
                ),
              },
              position_2: generateLabelDto.position_mapping?.position_2
                ? {
                    type: generateLabelDto.position_mapping.position_2.type,
                    record_id: toObjectId(
                      generateLabelDto.position_mapping.position_2.record_id,
                    ),
                  }
                : undefined,
            }
          : undefined,
        image_path: filePath,
        image_size: buffer.length,
        copies: generateLabelDto.copies || 1,
        status: 'generated',
      });

      return {
        status: 'success',
        message: 'Label generated successfully',
        data: [labelJob],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to generate label: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async printLabel(
    jobId: string,
    machineNumber: string,
  ): Promise<ResponseFormat<LabelJob>> {
    try {
      const job = await this.labelJobModel
        .findById(jobId)
        .populate('printer_id')
        .exec();

      const machine = await this.machineInfoModel
        .findOne({ machine_number: machineNumber })
        .populate('printer_id')
        .exec();

      const printerId = machine?.printer_id?._id;

      if (!job) {
        throw new Error('Label job not found');
      }
      if (!printerId) {
        throw new Error('Printer not configured');
      }

      const printer = await this.validateAndUpdatePrinter(printerId);

      // อัพเดทสถานะเป็น sending
      job.status = 'sent';
      await job.save();

      // ส่งไปปริ้น (mock - ในที่นี้จะ simulate)
      await this.sendToPrinter(job, printer.ip_device);

      // อัพเดทสถานะเป็น printed
      job.status = 'printed';
      job.printed_at = moment().tz('Asia/Bangkok').toDate();
      await job.save();

      return {
        status: 'success',
        message: 'Label printed successfully',
        data: [job],
      };
    } catch (error) {
      // อัพเดทสถานะเป็น failed ถ้า error
      if (jobId) {
        await this.labelJobModel.findByIdAndUpdate(jobId, {
          status: 'failed',
          error_message: (error as Error).message,
        });
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to print label: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async reprintLabel(
    jobId: string,
    machineNumber: string,
  ): Promise<ResponseFormat<LabelJob>> {
    try {
      const originalJob = await this.labelJobModel
        .findById(jobId)
        .populate('printer_id')
        .populate('production_record_ids')
        .populate('co_product_record_ids')
        .exec();

      if (!originalJob) {
        throw new Error('Original label job not found');
      }

      const machine = await this.machineInfoModel
        .findOne({ machine_number: machineNumber })
        .populate('printer_id')
        .exec();

      const printerId = machine?.printer_id?._id;

      if (!printerId) {
        throw new Error('Printer not configured');
      }

      // ตรวจสอบและ update printer status
      const printer = await this.validateAndUpdatePrinter(printerId);
      // สร้าง reprint job ใหม่
      const reprintJob = new this.labelJobModel({
        production_record_ids: originalJob.production_record_ids,
        co_product_record_ids: originalJob.co_product_record_ids,
        label_type: originalJob.label_type,
        printer_id: machine?.printer_id || null,
        position_mapping: originalJob.position_mapping,
        image_path: originalJob.image_path,
        status: 'sent',
        original_job_id: originalJob._id,
        is_reprint: true,
        reprint_count: (originalJob.reprint_count || 0) + 1,
      });

      await reprintJob.save();

      // ส่งไปปริ้น
      await this.sendToPrinter(reprintJob, printer.ip_device);

      // อัพเดทสถานะ
      reprintJob.status = 'printed';
      reprintJob.printed_at = moment().tz('Asia/Bangkok').toDate();
      await reprintJob.save();

      // อัพเดท reprint_count ของ original
      originalJob.reprint_count = (originalJob.reprint_count || 0) + 1;
      await originalJob.save();

      return {
        status: 'success',
        message: `Label reprinted successfully (reprint #${reprintJob.reprint_count})`,
        data: [reprintJob],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to reprint label: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getLabelJobs(
    status?: string,
    printerId?: string,
    isReprint?: boolean,
    type?: string,
  ): Promise<ResponseFormat<LabelJob>> {
    try {
      const filter: any = {};

      if (status) filter.status = status;
      if (printerId) filter.printer_id = printerId;
      if (isReprint !== undefined) filter.is_reprint = isReprint;

      const jobs = await this.labelJobModel
        .find(filter)
        .populate('printer_id')
        .populate('production_record_ids')
        .sort({ createdAt: -1 })
        .limit(100)
        .exec();

      return {
        status: 'success',
        message: `Found ${jobs.length} label jobs`,
        data: jobs,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get label jobs: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getLabelJob(jobId: string): Promise<ResponseFormat<LabelJob>> {
    try {
      const job = await this.labelJobModel
        .findById(jobId)
        .populate('printer_id')
        .populate('production_record_ids')
        .populate('original_job_id')
        .exec();

      if (!job) {
        throw new Error('Label job not found');
      }

      return {
        status: 'success',
        message: 'Label job retrieved successfully',
        data: [job],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get label job: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async deleteLabelJob(jobId: string): Promise<ResponseFormat<LabelJob>> {
    try {
      const job = await this.labelJobModel.findById(jobId);
      if (!job) {
        throw new Error('Label job not found');
      }

      // ไม่ให้ลบ job ที่พิมพ์แล้ว (เพื่อ audit trail)
      if (job.status === 'printed') {
        throw new Error('Cannot delete printed label job');
      }

      await this.labelJobModel.findByIdAndDelete(jobId);

      return {
        status: 'success',
        message: 'Label job deleted successfully',
        data: [job],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to delete label job: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async printWithReccordId(
    recordId: string,
    // recordType: 'production' | 'co_product',
    machineNumber: string,
  ): Promise<ResponseFormat<LabelJob>> {
    try {
      // ตรวจสอบว่าเป็น production หรือ co-product
      const job = await this.labelJobModel
        .findOne({
          $or: [
            { production_record_ids: toObjectId(recordId) },
            { co_product_record_ids: toObjectId(recordId) },
          ],
        })
        .populate('printer_id')
        .exec();

      if (!job) {
        throw new Error('Label job not found for the given record ID');
      }

      // เรียกใช้ printLabel ด้วย job ID
      return await this.printLabel(job._id.toString(), machineNumber);
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to print label by record ID: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async sendToPrinter(job: LabelJob, printerIp: string): Promise<void> {
    try {
      // Prepare print request
      const printRequest = {
        image_url: job.image_path,
        width: 190, // หรือจาก job settings
        height: 110, // หรือจาก job settings
        copies: job.copies || 1,
      };

      // Send to Python print service
      const printServiceUrl = `http://${printerIp}:8000/api/print/image`;

      const response = await axios.post(printServiceUrl, printRequest, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.data.status !== 'success') {
        throw new Error(`Print failed: ${response.data.message}`);
      }

      // อัพเดตสถานะใน database
      await this.labelJobModel.findByIdAndUpdate(job._id, {
        status: 'printed',
        printed_at: moment().tz('Asia/Bangkok').toDate(),
      });
    } catch (error) {
      console.error('Error sending to printer:', error);

      // อัพเดตสถานะ error ใน database
      await this.labelJobModel.findByIdAndUpdate(job._id, {
        status: 'failed',
        error_message: (error as Error).message,
      });

      throw error;
    }
  }

  private async prepareLabelDataFromDto(
    generateLabelDto: GenerateLabelDto,
  ): Promise<LabelDataDto> {
    try {
      const {
        production_record_ids,
        co_product_record_ids,
        label_type,
        position_mapping,
      } = generateLabelDto;

      let records = [];
      let coRecords = [];

      // ดึงข้อมูล production records (ถ้ามี)
      if (production_record_ids && production_record_ids.length > 0) {
        records = await this.getProductionRecordsWithDetails(
          production_record_ids,
        );
      }

      // ดึงข้อมูล co-product records (ถ้ามี)
      if (co_product_record_ids && co_product_record_ids.length > 0) {
        coRecords = await this.getCoProductRecordsWithDetails(
          co_product_record_ids,
        );
      }

      // ตรวจสอบว่ามีข้อมูลอย่างน้อย 1 อย่าง
      if (records.length === 0 && coRecords.length === 0) {
        throw new Error('No production or co-product records found');
      }

      return this.buildLabelDataByType(
        label_type,
        records,
        coRecords,
        position_mapping,
      );
    } catch (error) {
      console.error('Error preparing label data from DTO:', error);
      throw new Error(
        `Failed to prepare label data: ${(error as Error).message}`,
      );
    }
  }

  private buildLabelDataByType(
    labelType: string,
    records: any[],
    coRecords: any[],
    positionMapping?: any,
  ): LabelDataDto {
    // กำหนด base data จาก record แรกที่มี
    const baseRecord = records.length > 0 ? records[0] : coRecords[0];

    const labelDataDto: LabelDataDto = {
      labelNo: this.generateLabelNumber(),
      customer: baseRecord.cavity_customer || 'Unknown Customer',
      supplier: 'Serenity',
      mat: baseRecord.cavity_mat || 'Unknown Material',
      color: baseRecord.cavity_color || 'Unknown Color',
      producer: this.getEmployeeIds(baseRecord.employees),
      date: this.formatDateForLabel(baseRecord.production_date),
      part1: undefined,
      part2: undefined,
    };

    switch (labelType) {
      case 'co_product_separate':
        // ใช้ co-product เป็น part1
        labelDataDto.part1 = this.createPartDataFromCoProduct(coRecords[0]);
        break;

      case 'co_product_combined':
        // ใช้ position_mapping เพื่อกำหนด part1 และ part2
        if (positionMapping) {
          labelDataDto.part1 = this.getPartDataFromMapping(
            positionMapping.position_1,
            records,
            coRecords,
          );
          labelDataDto.part2 = this.getPartDataFromMapping(
            positionMapping.position_2,
            records,
            coRecords,
          );
        }
        break;

      default:
        // '1_part', '2_part' - ใช้ logic เดิม
        labelDataDto.part1 = this.createPartDataFromRecord(records[0]);
        if (labelType === '2_part' && records.length >= 2) {
          labelDataDto.part2 = this.createPartDataFromRecord(records[1]);
        }
    }

    return labelDataDto;
  }

  private getPartDataFromMapping(
    mapping: any,
    records: any[],
    coRecords: any[],
  ): PartDataDto {
    if (mapping.type === 'co') {
      const coRecord = coRecords.find(
        (r) => r._id.toString() === mapping.record_id,
      );
      return this.createPartDataFromCoProduct(coRecord);
    } else {
      const record = records.find(
        (r) => r._id.toString() === mapping.record_id,
      );
      return this.createPartDataFromRecord(record);
    }
  }

  private async getCoProductRecordsWithDetails(
    recordIds: string[],
  ): Promise<any[]> {
    const coRecords = await this.coProductRecordModel.aggregate([
      {
        $match: {
          _id: { $in: recordIds.map((id) => new Types.ObjectId(id)) },
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
        $unwind: { path: '$assign_order', preserveNullAndEmptyArrays: true },
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
      {
        $lookup: {
          from: 'master_parts',
          localField: 'part_info.co_product_material',
          foreignField: 'material_number',
          as: 'co_part_info',
        },
      },
      {
        $unwind: {
          path: '$co_part_info',
          preserveNullAndEmptyArrays: true,
        },
      },
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
          co_quantity: 1,
          // is_not_good: 1,
          production_date: 1,
          createdAt: 1,
          // Order Information
          order_id: '$production_order.order_id',
          material_number: '$co_part_info.material_number',
          // material_description: '$production_order.material_description',
          machine_number: '$assign_order.machine_number',
          // Part Information
          part_number: '$co_part_info.part_number',
          part_name: '$co_part_info.part_name',
          part_model: '$co_part_info.part_model',
          weight: '$co_part_info.weight',
          image_url: '$co_part_info.image_url',
          // Cavity Information
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

    return coRecords;
  }

  private async getProductionRecordsWithDetails(
    recordIds: string[],
  ): Promise<any[]> {
    const records = await this.productionRecordModel.aggregate([
      {
        $match: {
          _id: { $in: recordIds.map((id) => new Types.ObjectId(id)) },
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
          material_description: '$production_order.material_description',
          machine_number: '$assign_order.machine_number',
          // Part Information
          part_number: '$part_info.part_number',
          part_name: '$part_info.part_name',
          part_model: '$part_info.part_model',
          weight: '$part_info.weight',
          image_url: '$part_info.image_url',
          // Cavity Information
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

    return records;
  }

  private createPartDataFromRecord(record: any): PartDataDto {
    return {
      orderId: record.order_id || 'UNKNOWN-ORDER',
      sapNo: record.material_number || 'UNKNOWN-SAP',
      code: record.part_number || 'UNKNOWN-CODE',
      name: record.part_name || 'Unknown Part',
      quantity: record.quantity || 1,
      serial: record.serial_code || 'UNKNOWN-SERIAL',
      partImage: record.image_url || '',
    };
  }

  private async handleCoProductMapping(
    positionMapping: any,
    records: any[],
  ): Promise<PartDataDto | undefined> {
    if (!positionMapping.position_2) {
      return undefined;
    }

    // หาข้อมูลสำหรับ position_2
    if (positionMapping.position_2.type === 'co') {
      // ดึงข้อมูล co-product
      const coProductRecord = await this.getCoProductRecord(
        positionMapping.position_2.record_id,
      );
      return this.createPartDataFromCoProduct(coProductRecord);
    } else {
      // ใช้ main product record
      const mainRecord = records.find(
        (r) => r._id.toString() === positionMapping.position_2.record_id,
      );
      return mainRecord ? this.createPartDataFromRecord(mainRecord) : undefined;
    }
  }

  private async getCoProductRecord(recordId: string): Promise<any> {
    // ดึงข้อมูล co-product record (ปรับตาม schema ของคุณ)
    const coRecord = await this.coProductRecordModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(recordId),
        },
      },
      {
        $lookup: {
          from: 'master_parts',
          localField: 'co_material_number',
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
      // เพิ่ม lookup อื่นๆ ตามต้องการ
    ]);

    return coRecord[0];
  }

  private createPartDataFromCoProduct(coRecord: any): PartDataDto {
    return {
      orderId: coRecord.order_id || 'UNKNOWN-ORDER',
      sapNo: coRecord.material_number || 'UNKNOWN-SAP',
      code: coRecord.part_number || 'UNKNOWN-CODE',
      name: coRecord.part_name || 'Unknown Co-Product',
      quantity: coRecord.co_quantity || 0,
      serial: coRecord.serial_code || 'UNKNOWN-SERIAL',
      partImage: coRecord.image_url || '',
    };
  }

  private generateLabelNumber(): string {
    // สร้างหมายเลข label (อาจใช้ timestamp หรือ counter)
    return Date.now().toString().slice(-6);
  }

  private formatDateForLabel(date?: Date | string): string {
    if (!date) {
      // ใช้เวลาปัจจุบันในเขตเวลาไทย
      return moment().tz('Asia/Bangkok').format('YYYY-MM-DD');
    }

    // แปลงวันที่ให้เป็นเขตเวลาไทยก่อน
    return moment(date).tz('Asia/Bangkok').format('YYYY-MM-DD');
  }

  private getEmployeeIds(employees: any[]): string {
    if (!employees || employees.length === 0) {
      return 'Unknown';
    }

    return (
      employees
        .map(
          (emp) =>
            emp.employee_id || `${emp.first_name} ${emp.last_name}`.trim(),
        )
        .filter((id) => id)
        .join(', ') || 'Unknown'
    );
  }

  async getHealthPrinter(machineNumber: string): Promise<any> {
    const machineInfo = await this.machineInfoModel
      .findOne({ machine_number: machineNumber })
      .populate('printer_id')
      .exec();

    if (
      machineInfo &&
      machineInfo.printer_id &&
      typeof machineInfo.printer_id === 'object' &&
      'ip_device' in machineInfo.printer_id
    ) {
      return await axios.get(
        `http://${(machineInfo.printer_id as any).ip_device}:8000/api/print`,
      );
    } else {
      throw new Error('Printer device information not found or not populated');
    }
  }

  private async validateAndUpdatePrinter(
    printerId: Types.ObjectId,
  ): Promise<PrinterDevice> {
    let printer = await this.printerDeviceModel.findById(printerId);

    if (!printer) {
      throw new Error('Printer not found');
    }

    // ถ้า status != active ให้ update และตรวจสอบอีกครั้ง
    if (printer.status !== 'active') {
      await this.printerService.updateAllPrintersStatus();
      printer = await this.printerDeviceModel.findById(printerId);

      if (printer.status !== 'active') {
        throw new Error(
          `Printer ${printer.device_name} is ${printer.status}. Cannot print.`,
        );
      }
    }

    return printer;
  }
}
