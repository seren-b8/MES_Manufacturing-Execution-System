import * as moment from 'moment-timezone';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
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

  /**
   * สร้าง serial code รูปแบบใหม่ แบบฐาน 16 และรวม material_number
   * ลำดับจะอยู่ท้ายสุด
   */
  async generateHexSerialCode(
    machine_number: string,
    material_number: string,
  ): Promise<string> {
    try {
      // 1. สร้างข้อมูลวันที่
      const thaiTime = moment().tz('Asia/Bangkok');
      const dateStr = thaiTime.format('YYYY-MM-DD');
      const dateYMD = thaiTime.format('YYMMDD');

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

      // 4. สร้างรหัสเฉพาะแบบกระชับ
      // ใช้เทคนิค bitwise operation เพื่อรวมค่าวันที่, timestamp, process และ random
      const timestamp = Date.now() % 16777216; // 24 bits (0 - 16777215)
      const processId = process.pid % 4096; // 12 bits (0 - 4095)
      const randomNum = Math.floor(Math.random() * 4096); // 12 bits (0 - 4095)

      // คำนวณแบบแยกส่วนชัดเจน ไม่ทับซ้อน
      // ใช้ bitwise operations
      const encodedValue =
        (BigInt(timestamp) << 32n) |
        (BigInt(processId) << 16n) |
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

      // 6. สร้าง serial code ตามรูปแบบที่ต้องการ
      // ตามที่คุณต้องการ material และ machine รวมกัน
      // แต่เพิ่ม prefix เล็กๆ เพื่อให้อ่านง่ายขึ้น
      const serialCode = `B8MES|M${materialHex}${machineHex}-${uniqueHex}-${sequence}`;

      // 7. ตรวจสอบการซ้ำ
      const existingRecord = await this.productionRecordModel
        .findOne({ serial_code: serialCode })
        .exec();

      if (existingRecord) {
        return this.generateHexSerialCode(machine_number, material_number);
      }
      return serialCode;
    } catch (error) {
      console.error('Error generating hex serial code:', error);

      const fallbackHex = Date.now().toString(16).toUpperCase();
      const randomHex = Math.random()
        .toString(16)
        .substring(2, 6)
        .toUpperCase();
      return `B8MES|FALLBACK-${machine_number}-${material_number}-${fallbackHex}-${randomHex}`;
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
