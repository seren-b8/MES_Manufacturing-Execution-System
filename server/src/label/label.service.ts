import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LabelJob } from 'src/schema/label-job.shema';
import { PrinterDevice } from 'src/schema/printer-device.schema';
import { LabelGeneratorService } from './services/label-generator.service';
import { FileClientService } from 'src/shared/services/file-client/file-client.service';
import { ResponseFormat } from 'src/shared/interface';
import { LabelData } from 'src/shared/interface/label-data';
import { LabelDataDto } from './dto/generate-label.dto';

export interface GenerateLabelDto {
  production_record_ids: string[];
  co_product_record_ids?: string[];
  label_type:
    | '1_part'
    | '2_part'
    | 'co_product_combined'
    | 'co_product_separate';
  printer_id: string;
  position_mapping?: {
    position_1: { type: 'main' | 'co'; record_id: string };
    position_2?: { type: 'main' | 'co'; record_id: string };
  };
  copies?: number;
}

@Injectable()
export class LabelService {
  constructor(
    @InjectModel(LabelJob.name) private readonly labelJobModel: Model<LabelJob>,
    @InjectModel(PrinterDevice.name)
    private readonly printerDeviceModel: Model<PrinterDevice>,
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

      if (printer.status !== 'active') {
        throw new Error('Printer is not active');
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

  async printLabel(jobId: string): Promise<ResponseFormat<LabelJob>> {
    try {
      const job = await this.labelJobModel
        .findById(jobId)
        .populate('printer_id')
        .exec();

      if (!job) {
        throw new Error('Label job not found');
      }

      if (job.status === 'printed') {
        throw new Error('Label already printed');
      }

      // อัพเดทสถานะเป็น sending
      job.status = 'sent';
      await job.save();

      // ส่งไปปริ้น (mock - ในที่นี้จะ simulate)
      await this.sendToPrinter(job);

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

  // Mock printer communication
  private async sendToPrinter(job: LabelJob): Promise<void> {
    const printer = job.printer_id as any; // populated

    console.log(
      `Sending label to printer: ${printer.device_name} (${printer.ip_device})`,
    );
    console.log(`Label path: ${job.image_path}`);
    console.log(`Copies: ${job.copies}`);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // ในการใช้งานจริง จะมี logic สำหรับส่งไปยัง printer
    // เช่น HTTP POST, TCP Socket, หรือ printer driver

    console.log('Label sent successfully');
  }

  private async prepareLabelDataFromDto(
    generateLabelDto: GenerateLabelDto,
  ): Promise<LabelDataDto> {
    return;
  }
}
