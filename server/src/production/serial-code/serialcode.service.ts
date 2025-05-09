import * as moment from 'moment-timezone';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';

// เพิ่ม interface สำหรับ SerialCounter model
interface SerialCounter {
  prefix: string;
  machine_number: string;
  date: string;
  sequence: number;
}

@Injectable()
export class SerialCodeService {
  constructor(
    @InjectModel('SerialCounter')
    private serialCounterModel: Model<SerialCounter>,
    @InjectModel('ProductionRecord') private productionRecordModel: Model<any>,
  ) {}

  /**
   * สร้าง serial code สำหรับ production record แบบไม่ใช้ transaction
   * เหมาะสำหรับ MongoDB standalone server
   */
  async generateSerialCode(machine_number: string): Promise<string> {
    try {
      // 1. สร้างข้อมูลพื้นฐานสำหรับ serial code
      const thaiTime = moment().tz('Asia/Bangkok');
      const dateStr = thaiTime.format('YYYY-MM-DD');
      const prefix = `PR${thaiTime.format('YYMMDD')}`;

      // 2. สร้างส่วนประกอบที่เป็น unique เสมอ
      const timestamp = Date.now().toString();
      const processId = process.pid % 10000;
      const randomComponent = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');

      // 3. ดึงค่า sequence ปัจจุบันและเพิ่มขึ้น 1 โดยใช้ findOneAndUpdate (atomic operation)
      let counterDoc;
      let maxAttempts = 3;
      let attempts = 0;

      // ลองหลายครั้งในกรณีที่มีการแข่งขันกัน (race condition)
      while (attempts < maxAttempts) {
        try {
          counterDoc = await this.serialCounterModel.findOneAndUpdate(
            { prefix: prefix, machine_number: machine_number, date: dateStr },
            { $inc: { sequence: 1 } },
            { upsert: true, new: true },
          );
          break; // ออกจาก loop ถ้าทำงานสำเร็จ
        } catch (err) {
          attempts++;
          if (attempts >= maxAttempts) throw err;
          // รอเล็กน้อยก่อนลองใหม่
          await new Promise((resolve) => setTimeout(resolve, 100 * attempts));
        }
      }

      const sequence = counterDoc.sequence;

      // 4. สร้าง serial code ที่มีความเป็น unique สูง
      const serialCode = `B8MES|${prefix}-${machine_number}-${sequence.toString().padStart(4, '0')}-${timestamp.slice(-6)}-${processId}-${randomComponent}`;

      // 5. ตรวจสอบการซ้ำ (โอกาสเกิดน้อยมาก แต่ก็ควรเช็ค)
      const existingRecord = await this.productionRecordModel
        .findOne({ serial_code: serialCode })
        .exec();

      if (existingRecord) {
        // ในกรณีที่ซ้ำ (แทบจะเป็นไปไม่ได้) ให้ลองสร้างใหม่
        return this.generateSerialCode(machine_number);
      }

      return serialCode;
    } catch (error) {
      console.error('Error generating serial code:', error);

      // ถ้าเกิดข้อผิดพลาดร้ายแรง ให้ใช้วิธีสร้าง serial แบบ fallback ที่ยังมีความ unique
      const fallbackTimestamp = Date.now().toString();
      const fallbackRandom = Math.random().toString(36).substring(2, 10);
      const fallbackCode = `B8MES|FALLBACK-${machine_number}-${fallbackTimestamp}-${fallbackRandom}`;

      // บันทึก log เพื่อแจ้งว่ามีการใช้ fallback code
      console.warn(
        `Generated fallback serial code due to error: ${fallbackCode}`,
      );

      return fallbackCode;
    }
  }

  /**
   * ตรวจสอบว่า serial code มีอยู่แล้วหรือไม่
   */
  async isSerialCodeExists(serialCode: string): Promise<boolean> {
    const existingRecord = await this.productionRecordModel
      .findOne({ serial_code: serialCode })
      .exec();
    return existingRecord !== null;
  }

  /**
   * สร้าง serial code ในรูปแบบ custom
   */
  async generateCustomSerialCode(
    machine_number: string,
    customPrefix?: string,
    customFormat?: string,
  ): Promise<string> {
    try {
      const thaiTime = moment().tz('Asia/Bangkok');
      const dateStr = thaiTime.format('YYYY-MM-DD');
      const prefix = customPrefix || `PR${thaiTime.format('YYMMDD')}`;

      // ดึงค่า sequence
      const counterDoc = await this.serialCounterModel.findOneAndUpdate(
        { prefix: prefix, machine_number: machine_number, date: dateStr },
        { $inc: { sequence: 1 } },
        { upsert: true, new: true },
      );

      const sequence = counterDoc.sequence;

      // สร้าง serial code ตาม format ที่กำหนด หรือใช้ format เริ่มต้น
      let serialCode: string;

      if (customFormat) {
        // ทำการแทนที่ placeholder ด้วยค่าจริง
        serialCode = customFormat
          .replace('{PREFIX}', prefix)
          .replace('{MACHINE}', machine_number)
          .replace('{SEQ}', sequence.toString().padStart(4, '0'))
          .replace('{DATE}', thaiTime.format('YYYYMMDD'))
          .replace('{TIME}', thaiTime.format('HHmmss'))
          .replace(
            '{RAND}',
            Math.floor(Math.random() * 10000)
              .toString()
              .padStart(4, '0'),
          );
      } else {
        // ใช้ format เริ่มต้น
        const timestamp = Date.now().toString();
        const processId = process.pid % 10000;
        const randomComponent = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0');

        serialCode = `B8MES|${prefix}-${machine_number}-${sequence.toString().padStart(4, '0')}-${timestamp.slice(-6)}-${processId}-${randomComponent}`;
      }

      // ตรวจสอบการซ้ำ
      const exists = await this.isSerialCodeExists(serialCode);
      if (exists) {
        return this.generateCustomSerialCode(
          machine_number,
          customPrefix,
          customFormat,
        );
      }

      return serialCode;
    } catch (error) {
      console.error('Error generating custom serial code:', error);
      throw new Error('Failed to generate custom serial code');
    }
  }
}
