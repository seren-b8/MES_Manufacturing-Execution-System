import * as moment from 'moment-timezone';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { SerialCounter } from 'src/schema/serial-counter.schema';

@Injectable()
export class SerialCodeService {
  constructor(
    @InjectModel(SerialCounter.name)
    private serialCounterModel: Model<SerialCounter>,

    @InjectModel(ProductionRecord.name)
    private productionRecordModel: Model<ProductionRecord>,
  ) {}

  private calculateProductionDate(date?: Date): moment.Moment {
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
    return thaiTime;
  }

  /**
   * ตรวจสอบกะการทำงาน
   * Morning shift: 08:00 - 20:00
   * Night shift: 20:00 - 08:00
   */
  private determineShift(date?: Date): 'day' | 'night' {
    const thaiTime = date
      ? moment(date).tz('Asia/Bangkok')
      : moment().tz('Asia/Bangkok');

    const hour = thaiTime.hour();

    // กะเช้า: 08:00 - 19:59, กะดึก: 20:00 - 07:59
    if (hour >= 8 && hour < 20) {
      return 'day';
    } else {
      return 'night';
    }
  }

  async generateHexSerialCode(
    machine_number: string,
    material_number: string,
    type: 'OK' | 'NG',
  ): Promise<{ _id: mongoose.Types.ObjectId; serial: string }> {
    try {
      // 1. สร้างข้อมูลวันที่
      const now = moment().tz('Asia/Bangkok');
      const thaiTime = this.calculateProductionDate(now.toDate());
      const dateStr = thaiTime.format('YYYY-MM-DD');
      const dateYMD = thaiTime.format('YYMMDD');

      const shift = this.determineShift(now.toDate());

      // 2. แปลงเลขเครื่องเป็นฐาน 16
      const machineNum = parseInt(machine_number.replace(/\D/g, ''), 10);
      const machineHex = machineNum.toString(16).toUpperCase();

      // 3. แปลง Material Number เป็นฐาน 16
      const materialCleaned = material_number.replace(/[^A-Za-z0-9]/g, '');

      let materialHex: string;
      if (/^\d+$/.test(materialCleaned)) {
        // แปลงตัวเลขเป็นฐาน 16
        materialHex = parseInt(materialCleaned, 10).toString(16).toUpperCase();
      } else {
        // ถ้ามีทั้งตัวอักษรและตัวเลข ใช้การแปลงแบบฮ่าช
        materialHex = this.simpleHash(materialCleaned)
          .substring(0, 6)
          .toUpperCase();
      }

      const dateValue = parseInt(thaiTime.format('YYYYMMDD')); // 8 หลัก เช่น 20250518
      const processId = process.pid % 4096; // 12 bits (0 - 4095)
      const randomNum = Math.floor(Math.random() * 4096); // 12 bits (0 - 4095)

      const encodedValue =
        (BigInt(dateValue) << 32n) |
        (BigInt(processId) << 12n) |
        BigInt(randomNum);
      const uniqueHex = this.toBase62BigInt(encodedValue);

      // 5. ดึงลำดับ
      let counterDoc;
      let maxAttempts = 3;
      let attempts = 0;

      while (attempts < maxAttempts) {
        try {
          counterDoc = await this.serialCounterModel.findOneAndUpdate(
            {
              prefix: `PR${dateYMD}`,
              machine_number: machine_number,
              material_number: material_number,
              date: dateStr,
              shift: shift,
              type: type,
            },
            { $inc: { sequence: 1 } },
            { upsert: true, new: true },
          );
          break;
        } catch (err) {
          attempts++;
          if (attempts >= maxAttempts) throw err;
          await new Promise((resolve) => setTimeout(resolve, 100 * attempts));
        }
      }

      const sequence = counterDoc.sequence;

      const serialCode = `B8MES|${type}${materialHex}${machineHex}-${uniqueHex}-${sequence}`;

      const existingRecord = await this.productionRecordModel
        .findOne({ serial_code: serialCode })
        .exec();

      if (existingRecord) {
        return this.generateHexSerialCode(
          machine_number,
          material_number,
          type,
        );
      }
      return { _id: counterDoc._id, serial: serialCode };
    } catch (error) {
      console.error('Error generating hex serial code:', error);
      throw new HttpException(
        {
          status: 'error',
          message: 'Cannot create serial code',
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * สร้าง hash อย่างง่ายสำหรับ material number ที่มีทั้งตัวอักษรและตัวเลข
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * แปลง BigInt เป็น Base62 (0-9, A-Z, a-z)
   * รองรับตัวเลขขนาดใหญ่มาก
   *
   * @param num - BigInt ที่ต้องการแปลงเป็น Base62
   * @returns สตริง Base62
   */
  private toBase62BigInt(num: bigint): string {
    const characters =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';

    // จัดการกรณีเลข 0
    if (num === 0n) {
      return '0';
    }

    // จัดการกรณีเลขติดลบ
    const isNegative = num < 0n;
    if (isNegative) {
      num = -num; // ทำให้เป็นบวก
    }

    // แปลงเลขเป็น Base62
    while (num > 0n) {
      const remainder = Number(num % 62n); // แปลงเป็น Number เพื่อใช้เป็น index
      result = characters[remainder] + result;
      num = num / 62n;
    }

    // เพิ่มเครื่องหมายลบหากเป็นเลขติดลบ
    return isNegative ? `-${result}` : result;
  }
}
