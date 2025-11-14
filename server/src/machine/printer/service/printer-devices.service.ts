// src/printer/printer-devices.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrinterDevice } from 'src/schema/printer-device.schema';
import {
  CreatePrinterDeviceDto,
  UpdatePrinterDeviceDto,
} from '../../dto/printer.dto';
import { ResponseFormat } from 'src/shared/interface';

@Injectable()
export class PrinterDevicesService {
  private readonly logger = new Logger(PrinterDevicesService.name);
  private readonly PAPER_WIDTH = 576; // 80mm (576 dots)
  constructor(
    @InjectModel(PrinterDevice.name)
    private readonly printerDeviceModel: Model<PrinterDevice>,
  ) {}

  async create(
    createPrinterDeviceDto: CreatePrinterDeviceDto,
  ): Promise<ResponseFormat<PrinterDevice>> {
    try {
      const existingPrinter = await this.printerDeviceModel
        .findOne({
          device_name: createPrinterDeviceDto.device_name,
        })
        .exec();

      if (existingPrinter) {
        throw new HttpException(
          {
            status: 'error',
            message: `Printer with name ${createPrinterDeviceDto.device_name} already exists`,
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const newPrinterDevice = new this.printerDeviceModel(
        createPrinterDeviceDto,
      );
      const savedPrinterDevice = await newPrinterDevice.save();

      return {
        status: 'success',
        message: 'Printer device created successfully',
        data: [savedPrinterDevice],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to create printer device: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(): Promise<ResponseFormat<PrinterDevice>> {
    try {
      const printerDevices = await this.printerDeviceModel.find().exec();

      return {
        status: 'success',
        message: 'Printer devices retrieved successfully',
        data: printerDevices,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to retrieve printer devices: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<ResponseFormat<PrinterDevice>> {
    try {
      const printerDevice = await this.printerDeviceModel.findById(id).exec();

      if (!printerDevice) {
        throw new HttpException(
          {
            status: 'error',
            message: `Printer device with ID ${id} not found`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Printer device retrieved successfully',
        data: [printerDevice],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to retrieve printer device: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updatePrinterDeviceDto: UpdatePrinterDeviceDto,
  ): Promise<ResponseFormat<PrinterDevice>> {
    try {
      const printerDevice = await this.printerDeviceModel.findById(id).exec();

      if (!printerDevice) {
        throw new HttpException(
          {
            status: 'error',
            message: `Printer device with ID ${id} not found`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ตรวจสอบว่าชื่อไม่ซ้ำกับเครื่องอื่น (ถ้ามีการอัพเดตชื่อ)
      if (
        updatePrinterDeviceDto.device_name &&
        updatePrinterDeviceDto.device_name !== printerDevice.device_name
      ) {
        const existingPrinter = await this.printerDeviceModel
          .findOne({
            device_name: updatePrinterDeviceDto.device_name,
          })
          .exec();

        if (existingPrinter) {
          throw new HttpException(
            {
              status: 'error',
              message: `Printer with name ${updatePrinterDeviceDto.device_name} already exists`,
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const updatedPrinterDevice = await this.printerDeviceModel
        .findByIdAndUpdate(id, updatePrinterDeviceDto, { new: true })
        .exec();

      return {
        status: 'success',
        message: 'Printer device updated successfully',
        data: [updatedPrinterDevice],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to update printer device: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<ResponseFormat<PrinterDevice>> {
    try {
      const deletedPrinterDevice = await this.printerDeviceModel
        .findByIdAndDelete(id)
        .exec();

      if (!deletedPrinterDevice) {
        throw new HttpException(
          {
            status: 'error',
            message: `Printer device with ID ${id} not found`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Printer device deleted successfully',
        data: [deletedPrinterDevice],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to delete printer device: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByType(type: string): Promise<ResponseFormat<PrinterDevice>> {
    try {
      const printers = await this.printerDeviceModel
        .find({
          printer_type: type,
          status: 'active',
        })
        .exec();

      return {
        status: 'success',
        message: `Found ${printers.length} ${type} printers`,
        data: printers,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to find printers by type: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateAllPrintersStatus(): Promise<ResponseFormat<any>> {
    try {
      // ดึงข้อมูลเครื่องปริ้นทั้งหมด
      const printers = await this.printerDeviceModel.find().exec();

      if (printers.length === 0) {
        return {
          status: 'success',
          message: 'No printers found in the system',
          data: [],
        };
      }

      // สร้าง array เพื่อเก็บผลลัพธ์
      const results = [];
      const statusChanges = [];

      // ตรวจสอบสถานะเครื่องปริ้นทั้งหมดแบบ parallel
      await Promise.all(
        printers.map(async (printer) => {
          try {
            // ส่ง ping request ไปที่เครื่องปริ้น
            const port = printer.is_socket ? 9100 : 8000;
            const isOnline = await this.checkPrinterConnection(
              printer.ip_device,
              port,
            );

            // ตรวจสอบการเปลี่ยนแปลงสถานะ
            const oldStatus = printer.status;

            const newStatus = isOnline ? 'active' : 'inactive'; //inactive

            // บันทึกเฉพาะเมื่อมีการเปลี่ยนแปลงสถานะ
            if (oldStatus !== newStatus) {
              printer.status = newStatus;
              await printer.save();
              statusChanges.push({
                device_name: printer.device_name,
                ip_device: printer.ip_device,
                old_status: oldStatus,
                new_status: newStatus,
              });
            }

            // เก็บผลลัพธ์
            results.push({
              id: printer._id,
              device_name: printer.device_name,
              ip_device: printer.ip_device,
              status: newStatus,
              is_online: isOnline,
            });
          } catch (error) {
            // บันทึกข้อผิดพลาดสำหรับเครื่องปริ้นนี้แต่ทำงานต่อกับเครื่องอื่น
            results.push({
              id: printer._id,
              device_name: printer.device_name,
              ip_device: printer.ip_device,
              status: 'error',
              error: (error as Error).message,
            });
          }
        }),
      );

      return {
        status: 'success',
        message: `Updated status for ${printers.length} printers. ${statusChanges.length} status changes detected.`,
        data: results,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Error updating all printer statuses: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkPrinterStatus(id: string): Promise<ResponseFormat<any>> {
    try {
      const printer = await this.printerDeviceModel.findById(id).exec();

      if (!printer) {
        throw new HttpException(
          {
            status: 'error',
            message: `Printer device with ID ${id} not found`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      try {
        // ส่ง ping request ไปที่เครื่องปริ้น
        const port = printer.is_socket ? 9100 : 8000;

        const isOnline = await this.checkPrinterConnection(
          printer.ip_device,
          port,
        );

        // อัพเดทสถานะเครื่องปริ้น
        const oldStatus = printer.status;
        printer.status = isOnline ? 'active' : 'active';

        // บันทึกเฉพาะเมื่อมีการเปลี่ยนแปลงสถานะ
        if (oldStatus !== printer.status) {
          await printer.save();
        }

        return {
          status: 'success',
          message: `Printer status is ${printer.status}`,
          data: [
            {
              device_name: printer.device_name,
              ip_device: printer.ip_device,
              status: printer.status,
              is_online: isOnline,
            },
          ],
        };
      } catch (error) {
        throw new HttpException(
          {
            status: 'error',
            message: `Failed to check printer status: ${(error as Error).message}`,
            data: [],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Error checking printer status: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async checkPrinterConnection(
    ip: string,
    port: number = 8000,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      const timeout = 3000;

      socket.setTimeout(timeout);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        resolve(false);
      });

      socket.connect(port, ip);
    });
  }
}
