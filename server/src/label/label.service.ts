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

// export interface GenerateLabelDto {
//   production_record_ids: string[];
//   co_product_record_ids?: string[];
//   label_type:
//     | '1_part'
//     | '2_part'
//     | 'co_product_combined'
//     | 'co_product_separate';
//   printer_id: string;
//   position_mapping?: {
//     position_1: { type: 'main' | 'co'; record_id: string };
//     position_2?: { type: 'main' | 'co'; record_id: string };
//   };
//   copies?: number;
// }

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
  ) {}

  async generateLabel(
    generateLabelDto: GenerateLabelDto,
  ): Promise<ResponseFormat<LabelJob>> {
    try {
      // ตรวจสอบ printer
      const printer = await this.printerDeviceModel.findById(
        generateLabelDto.printer_id,
      );
      if (!printer) {
        throw new Error('Printer not found');
      }

      // if (printer.status !== 'active') {
      //   throw new Error('Printer is not active');
      // }

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
        production_record_ids: generateLabelDto.production_record_ids,
        co_product_record_ids: generateLabelDto.co_product_record_ids,
        label_type: generateLabelDto.label_type,
        printer_id: generateLabelDto.printer_id,
        position_mapping: generateLabelDto.position_mapping,
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

      const printerIp =
        (machine &&
        typeof machine.printer_id === 'object' &&
        'ip_device' in machine.printer_id
          ? (machine.printer_id as any).ip_device
          : undefined) ||
        (job &&
        typeof job.printer_id === 'object' &&
        'ip_device' in job.printer_id
          ? (job.printer_id as any).ip_device
          : undefined);

      if (!printerIp) {
        throw new Error('Printer IP not found');
      }

      if (!job) {
        throw new Error('Label job not found');
      }

      // if (job.status === 'printed') {
      //   throw new Error('Label already printed');
      // }

      // อัพเดทสถานะเป็น sending
      job.status = 'sent';
      await job.save();

      // ส่งไปปริ้น (mock - ในที่นี้จะ simulate)
      await this.sendToPrinter(job, printerIp);

      // อัพเดทสถานะเป็น printed
      job.status = 'printed';
      job.printed_at = new Date();
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

  async reprintLabel(originalJobId: string): Promise<ResponseFormat<LabelJob>> {
    try {
      const originalJob = await this.labelJobModel.findById(originalJobId);
      if (!originalJob) {
        throw new Error('Original label job not found');
      }

      // ตรวจสอบว่า original job พิมพ์แล้วหรือยัง
      if (originalJob.status !== 'printed') {
        throw new Error('Original job must be printed before reprint');
      }

      // สร้าง reprint job (ใช้ไฟล์เดิม)
      const reprintJob = await this.labelJobModel.create({
        production_record_ids: originalJob.production_record_ids,
        co_product_record_ids: originalJob.co_product_record_ids,
        label_type: originalJob.label_type,
        printer_id: originalJob.printer_id,
        position_mapping: originalJob.position_mapping,
        image_path: originalJob.image_path, // ใช้ไฟล์เดิม
        image_size: originalJob.image_size,
        copies: originalJob.copies,
        status: 'generated',
        is_reprint: true,
        original_job_id: originalJob._id,
        reprint_count: 1,
      });

      return {
        status: 'success',
        message: 'Reprint job created successfully',
        data: [reprintJob],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to create reprint job: ${(error as Error).message}`,
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

  private async sendToPrinter(job: LabelJob, printerIp: string): Promise<void> {
    try {
      const printer = job.printer_id as any; // populated
      console.log(
        `Sending label to printer: ${printer.device_name} (${printer.ip_device})`,
      );
      console.log(`Label path: ${job.image_path}`);
      console.log(`Copies: ${job.copies}`);

      // // Build full image URL
      // const baseUrl =
      //   this.configService.get('BASE_URL') || 'http://localhost:3000';
      // const imageUrl = `${baseUrl}/generated-labels/${job.image_path}`;

      // Prepare print request
      const printRequest = {
        image_url: job.image_path,
        width: 190, // หรือจาก job settings
        height: 110, // หรือจาก job settings
        copies: job.copies || 1,
      };

      // Send to Python print service
      const printServiceUrl = `http://${printerIp}:8000/api/print/image`;

      console.log(`Calling print service: ${printServiceUrl}`);
      console.log(`Print request:`, printRequest);

      const response = await axios.post(printServiceUrl, printRequest, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.data.status !== 'success') {
        throw new Error(`Print failed: ${response.data.message}`);
      }

      console.log('Label sent successfully:', response.data.data[0]);

      // อัพเดตสถานะใน database
      await this.labelJobModel.findByIdAndUpdate(job._id, {
        status: 'printed',
        printed_at: new Date(),
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
      const { production_record_ids, label_type, position_mapping } =
        generateLabelDto;

      // ดึงข้อมูล production records
      const records = await this.getProductionRecordsWithDetails(
        production_record_ids,
      );

      if (!records || records.length === 0) {
        throw new Error('No production records found');
      }

      // สร้าง LabelDataDto
      const labelDataDto: LabelDataDto = {
        labelNo: this.generateLabelNumber(),
        customer: records[0].cavity_customer || 'Unknown Customer',
        supplier: 'Serenity',
        mat: records[0].cavity_mat || 'Unknown Material',
        color: records[0].cavity_color || 'Unknown Color',
        producer: this.getEmployeeIds(records[0].employees),
        date: this.formatDateForLabel(records[0].production_date),
        part1: this.createPartDataFromRecord(records[0]),
        part2: undefined, // จะถูกกำหนดใหม่ด้านล่าง
      };

      // จัดการ part2 สำหรับ label ประเภทต่างๆ
      if (label_type === '2_part' && records.length >= 2) {
        labelDataDto.part2 = this.createPartDataFromRecord(records[1]);
      } else if (label_type === 'co_product_combined' && position_mapping) {
        // จัดการ co-product combined
        labelDataDto.part2 = await this.handleCoProductMapping(
          position_mapping,
          records,
        );
      }

      return labelDataDto;
    } catch (error) {
      console.error('Error preparing label data from DTO:', error);
      throw new Error(
        `Failed to prepare label data: ${(error as Error).message}`,
      );
    }
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
      orderId: 'CO-PRODUCT',
      sapNo: coRecord.co_material_number || 'UNKNOWN-SAP',
      code: coRecord.part_info?.part_number || 'UNKNOWN-CODE',
      name: coRecord.part_info?.part_name || 'Unknown Co-Product',
      quantity: coRecord.co_quantity || 1,
      serial: coRecord.serial_code || 'UNKNOWN-SERIAL',
      partImage: coRecord.part_info?.image_url || '',
    };
  }

  private generateLabelNumber(): string {
    // สร้างหมายเลข label (อาจใช้ timestamp หรือ counter)
    return Date.now().toString().slice(-6);
  }

  private formatDateForLabel(date: Date | string): string {
    if (!date) {
      return new Date().toISOString().split('T')[0];
    }

    if (typeof date === 'string') {
      return date.split('T')[0];
    }

    return date.toISOString().split('T')[0];
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
}
