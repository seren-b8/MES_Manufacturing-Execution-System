// src/printer/printer-devices.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrinterDevice } from 'src/schema/printer-device.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ResponseFormat } from 'src/shared/interface';
import { HttpService } from '@nestjs/axios';
import { LabelJob } from 'src/schema/label-job.shema';
import sharp = require('sharp'); // ✅ ไม่มี error
import { firstValueFrom } from 'rxjs';
import {
  PrinterTypes,
  ThermalPrinter,
  CharacterSet,
} from 'node-thermal-printer';

@Injectable()
export class PrinterOperationService {
  private readonly logger = new Logger(PrinterOperationService.name);
  private readonly PAPER_WIDTH = 576; // 80mm (576 dots)
  constructor(
    @InjectModel(PrinterDevice.name)
    private readonly printerDeviceModel: Model<PrinterDevice>,
    @InjectModel(LabelJob.name)
    private labelJobModel: Model<LabelJob>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Print label by Label Job ID
   */
  async printLabel(labelJobId: string): Promise<ResponseFormat<LabelJob>> {
    try {
      // 1. ดึงข้อมูล Label Job พร้อม populate printer
      const labelJob = await this.labelJobModel
        .findById(labelJobId)
        .populate('printer_id')
        .exec();

      if (!labelJob) {
        throw new NotFoundException(`Label Job ID ${labelJobId} not found`);
      }

      if (labelJob.status === 'printed') {
      }

      // 2. ตรวจสอบ printer
      const printer = labelJob.printer_id as any;
      if (!printer) {
        throw new NotFoundException(
          `Printer not assigned to Label Job ${labelJobId}`,
        );
      }

      if (printer.status !== 'active') {
        throw new Error(`Printer ${printer.device_name} is not active`);
      }

      // 3. กำหนดการ rotate ตาม label_type
      const shouldRotate = ['2_part', 'co_product_combined'].includes(
        labelJob.label_type,
      );

      // 4. ส่งพิมพ์
      await this.printFromUrl(
        labelJob.image_path,
        printer.ip_device,
        shouldRotate,
        labelJob.copies || 1,
      );

      // 5. อัพเดทสถานะ Label Job
      labelJob.status = 'printed';
      labelJob.printed_at = new Date();
      await labelJob.save();

      return {
        status: 'success',
        message: `Label printed successfully on ${printer.device_name}`,
        data: [labelJob],
      };
    } catch (error) {
      // อัพเดทสถานะเป็น failed
      await this.labelJobModel.findByIdAndUpdate(labelJobId, {
        status: 'failed',
        error_message: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Reprint existing label
   */
  async reprintLabel(
    originalLabelJobId: string,
    copies: number = 1,
  ): Promise<ResponseFormat<LabelJob>> {
    try {
      // 1. ดึง Label Job เดิม
      const originalJob = await this.labelJobModel
        .findById(originalLabelJobId)
        .populate('printer_id')
        .exec();

      if (!originalJob) {
        throw new NotFoundException(
          `Original Label Job ${originalLabelJobId} not found`,
        );
      }

      // 2. สร้าง Label Job ใหม่สำหรับ reprint
      const reprintJob = new this.labelJobModel({
        production_record_ids: originalJob.production_record_ids,
        co_product_record_ids: originalJob.co_product_record_ids,
        label_type: originalJob.label_type,
        printer_id: originalJob.printer_id,
        position_mapping: originalJob.position_mapping,
        image_path: originalJob.image_path,
        image_size: originalJob.image_size,
        status: 'pending',
        original_job_id: originalLabelJobId,
        is_reprint: true,
        reprint_count: (originalJob.reprint_count || 0) + 1,
        copies: copies,
      });

      await reprintJob.save();

      // 3. พิมพ์
      return await this.printLabel(reprintJob._id.toString());
    } catch (error) {
      throw error;
    }
  }

  /**
   * Print directly from URL (UPDATED - ใช้ node-thermal-printer)
   */
  async printFromUrl(
    url: string,
    printerIp: string,
    rotate: boolean = false,
    copies: number = 1,
  ): Promise<ResponseFormat<any>> {
    try {
      // 1. ดาวน์โหลดรูป
      const response = await firstValueFrom(
        this.httpService.get(url, { responseType: 'arraybuffer' }),
      );
      const imageBuffer = Buffer.from(response.data);

      // 2. ประมวลผลรูปภาพ
      let processedImage = sharp(imageBuffer);

      if (rotate) {
        processedImage = processedImage.rotate(90);
      }

      // Resize และแปลงเป็น black & white
      const finalImageBuffer = await processedImage
        .resize(this.PAPER_WIDTH, null, { fit: 'inside' })
        .greyscale()
        .threshold(128)
        .png() // แปลงเป็น PNG
        .toBuffer();

      // 3. สร้าง printer instance
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON, // หรือ PrinterTypes.STAR
        interface: `tcp://${printerIp}:9100`,
        characterSet: CharacterSet.PC437_USA,
        removeSpecialCharacters: false,
        lineCharacter: '=',
        options: {
          timeout: 5000,
        },
      });

      // 4. Print ตามจำนวน copies
      for (let i = 0; i < copies; i++) {
        // เชื่อมต่อกับ printer
        const isConnected = await printer.isPrinterConnected();
        if (!isConnected) {
          throw new Error(`Cannot connect to printer at ${printerIp}`);
        }

        // ตั้งค่า alignment
        printer.alignCenter();

        const tempFilePath = path.join(os.tmpdir(), `label_${Date.now()}.png`);
        fs.writeFileSync(tempFilePath, finalImageBuffer);

        // 2. Print from file path
        await printer.printImage(tempFilePath); // ✅ ใช้ path

        // 3. Cleanup (in finally block)
        fs.unlinkSync(tempFilePath);

        // ขึ้นบรรทัด
        // printer.newLine();

        // ตัดกระดาษ (เฉพาะครั้งสุดท้าย)
        if (i === copies - 1) {
          printer.cut();
        } else {
          printer.partialCut();
        }

        // Execute print
        await printer.execute();

        // รอเล็กน้อยระหว่าง copies
        if (i < copies - 1) {
          await this.delay(500);
        }
      }

      return { status: 'success', message: 'Print completed', data: [] };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  /**
   * Test printer connection (UPDATED)
   */
  async testPrinter(printerIP: string): Promise<ResponseFormat<any>> {
    try {
      // สร้าง printer instance
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${printerIP}:9100`,
        options: {
          timeout: 5000,
        },
      });

      // ทดสอบการเชื่อมต่อ
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error(`Cannot connect to printer at ${printerIP}`);
      }

      // พิมพ์ทดสอบ
      printer.alignCenter();
      printer.setTextDoubleHeight();
      printer.setTextDoubleWidth();
      printer.bold(true);
      printer.println('TEST PRINT');
      printer.bold(false);
      printer.setTextNormal();
      printer.newLine();
      printer.println(`Printer: ${printerIP}`);
      printer.println(`IP: ${printerIP}`);
      printer.println(`Location: N/A`);
      printer.newLine();
      printer.println(`Date: ${new Date().toLocaleDateString('th-TH')}`);
      printer.println(`Time: ${new Date().toLocaleTimeString('th-TH')}`);
      printer.newLine();
      printer.newLine();
      printer.newLine();
      printer.cut();

      await printer.execute();

      return {
        status: 'success',
        message: 'Test print completed',
        data: [printerIP],
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get printer status
   */
  async getPrinterStatus(
    printerId: string,
  ): Promise<ResponseFormat<PrinterDevice>> {
    try {
      const printer = await this.printerDeviceModel.findById(printerId).exec();

      if (!printer) {
        throw new NotFoundException(`Printer ID ${printerId} not found`);
      }

      // ตรวจสอบการเชื่อมต่อ
      try {
        const thermalPrinter = new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: `tcp://${printer.ip_device}:9100`,
          options: { timeout: 3000 },
        });

        const isConnected = await thermalPrinter.isPrinterConnected();
        printer.status = isConnected ? 'active' : 'inactive';
      } catch (error) {
        printer.status = 'inactive';
      }

      return {
        status: 'success',
        message: 'Printer status retrieved',
        data: [printer],
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get print queue (pending label jobs)
   */
  async getPrintQueue(printerId?: string): Promise<ResponseFormat<LabelJob>> {
    try {
      const query: any = {
        status: { $in: ['pending', 'generated', 'sent'] },
      };

      if (printerId) {
        query.printer_id = printerId;
      }

      const queue = await this.labelJobModel
        .find(query)
        .populate('printer_id')
        .sort({ createdAt: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${queue.length} jobs in queue`,
        data: queue,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Batch print multiple labels
   */
  async batchPrint(labelJobIds: string[]): Promise<ResponseFormat<any>> {
    const results = {
      success: [],
      failed: [],
    };

    for (const jobId of labelJobIds) {
      try {
        await this.printLabel(jobId);
        results.success.push(jobId);
      } catch (error) {
        results.failed.push({
          jobId,
          error: (error as Error).message,
        });
      }
    }

    return {
      status: results.failed.length === 0 ? 'success' : 'error',
      message: `Printed ${results.success.length}/${labelJobIds.length} labels`,
      data: [results],
    };
  }

  /**
   * Helper: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
