import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlannedDowntime } from 'src/schema/planned-downtime.schema';
import { ResponseFormat } from 'src/shared/interface';
import { UpdatePlannedDowntimeDto } from './dto/update-planned-downtime.dto';
import { CreatePlannedDowntimeDto } from './dto/create-planned-downtime.dto';
import { BulkCreatePlannedDowntimeDto } from './dto/bulk-create-planned-downtime.dto';
import { BulkCreateByTemplateDto } from './dto/bulk-create-by-template.dto';
import * as moment from 'moment-timezone';

// planned-downtime.service.ts
@Injectable()
export class PlannedDowntimeService {
  constructor(
    @InjectModel(PlannedDowntime.name)
    private plannedDowntimeModel: Model<PlannedDowntime>,
  ) {}

  async create(
    dto: CreatePlannedDowntimeDto,
  ): Promise<ResponseFormat<PlannedDowntime>> {
    try {
      const newDowntime = new this.plannedDowntimeModel(dto);
      const saved = await newDowntime.save();

      return {
        status: 'success',
        message: 'Planned downtime created successfully',
        data: [saved],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // เพิ่มใน planned-downtime.service.ts

  async bulkCreate(
    dto: BulkCreatePlannedDowntimeDto,
  ): Promise<ResponseFormat<PlannedDowntime>> {
    try {
      const downtimesToCreate: any[] = [];

      // สร้าง combination ทั้งหมด
      for (const machine of dto.machine_numbers) {
        for (const date of dto.dates) {
          for (const shift of dto.shifts) {
            downtimesToCreate.push({
              machine_number: machine,
              date: moment(date).tz('Asia/Bangkok').startOf('day').toDate(),
              shift: shift,
              planned_downtime_minutes: dto.planned_downtime_minutes,
              downtime_type: dto.downtime_type,
              description: dto.description,
            });
          }
        }
      }

      // ตรวจสอบข้อมูลซ้ำ
      const existingCheck = await this.checkDuplicates(downtimesToCreate);
      if (existingCheck.length > 0) {
        throw new Error(`Duplicate entries found: ${existingCheck.join(', ')}`);
      }

      // สร้างทั้งหมด
      const created =
        await this.plannedDowntimeModel.insertMany(downtimesToCreate);

      const plainCreated = created.map((doc) => doc.toObject());

      return {
        status: 'success',
        message: `Created ${plainCreated.length} planned downtime records`,
        data: plainCreated,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async bulkCreateByTemplate(
    dto: BulkCreateByTemplateDto,
  ): Promise<ResponseFormat<PlannedDowntime>> {
    try {
      // ตรวจสอบข้อมูลซ้ำ
      const downtimesToCreate = dto.downtimes.map((item) => ({
        ...item,
        date: moment(item.date).tz('Asia/Bangkok').startOf('day').toDate(),
      }));

      const existingCheck = await this.checkDuplicates(downtimesToCreate);
      if (existingCheck.length > 0) {
        throw new Error(`Duplicate entries found: ${existingCheck.join(', ')}`);
      }

      const created =
        await this.plannedDowntimeModel.insertMany(downtimesToCreate);

      return {
        status: 'success',
        message: `Created ${created.length} planned downtime records from template`,
        data: created,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async checkDuplicates(downtimes: any[]): Promise<string[]> {
    const duplicates: string[] = [];

    for (const dt of downtimes) {
      const existing = await this.plannedDowntimeModel.findOne({
        machine_number: dt.machine_number,
        date: dt.date,
        shift: dt.shift,
        status: 'active',
      });

      if (existing) {
        duplicates.push(`${dt.machine_number}-${dt.date}-${dt.shift}`);
      }
    }

    return duplicates;
  }

  async bulkDelete(
    machineNumbers: string[],
    dates: string[],
    shifts: string[],
  ): Promise<ResponseFormat<any>> {
    try {
      const deleteQuery = {
        machine_number: { $in: machineNumbers },
        date: { $in: dates.map((d) => new Date(d)) },
        shift: { $in: shifts },
      };

      const result = await this.plannedDowntimeModel.deleteMany(deleteQuery);

      return {
        status: 'success',
        message: `Deleted ${result.deletedCount} planned downtime records`,
        data: [],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByMachineAndDate(
    machineNumber: string,
    date: string,
    shift?: string,
  ): Promise<ResponseFormat<PlannedDowntime>> {
    try {
      const query: any = {
        machine_number: machineNumber,
        date: new Date(date),
        status: 'active',
      };

      if (shift && shift !== 'all') {
        query.shift = { $in: [shift, 'all'] };
      }

      const downtimes = await this.plannedDowntimeModel.find(query);

      return {
        status: 'success',
        message: 'Planned downtime retrieved successfully',
        data: downtimes,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTotalPlannedDowntime(
    machineNumber: string,
    date: string,
    shift: string,
  ): Promise<number> {
    const downtimes = await this.plannedDowntimeModel.find({
      machine_number: machineNumber,
      date: new Date(date),
      shift: { $in: [shift, 'all'] },
      status: 'active',
    });

    return downtimes.reduce(
      (total, dt) => total + dt.planned_downtime_minutes,
      0,
    );
  }

  async findByDateRange(
    startDate: string,
    endDate: string,
    shift?: string,
  ): Promise<ResponseFormat<PlannedDowntime[]>> {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // กำหนดให้วันที่สิ้นสุดครอบคลุมตลอดวัน (ถึง 23:59:59.999)
      end.setHours(23, 59, 59, 999);

      const query: any = {
        // ใช้ $gte (Greater Than or Equal) และ $lte (Less Than or Equal)
        // สำหรับการค้นหาในช่วงวัน
        date: {
          $gte: start,
          $lte: end,
        },
        status: 'active',
      };

      if (shift && shift !== 'all') {
        query.shift = { $in: [shift, 'all'] };
      }

      // ไม่ต้องระบุ machine_number ทำให้ดึงข้อมูลของทุกเครื่อง
      const downtimes = await this.plannedDowntimeModel.find(query);

      return {
        status: 'success',
        message:
          'Planned downtime retrieved successfully for all machines within the date range',
        data: downtimes as [],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    dto: UpdatePlannedDowntimeDto,
  ): Promise<ResponseFormat<PlannedDowntime>> {
    try {
      const updated = await this.plannedDowntimeModel.findByIdAndUpdate(
        id,
        dto,
        { new: true },
      );

      if (!updated) {
        throw new Error('Planned downtime not found');
      }

      return {
        status: 'success',
        message: 'Planned downtime updated successfully',
        data: [updated],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async delete(id: string): Promise<ResponseFormat<any>> {
    try {
      const deleted = await this.plannedDowntimeModel.findByIdAndDelete(id);

      if (!deleted) {
        throw new Error('Planned downtime not found');
      }

      return {
        status: 'success',
        message: 'Planned downtime deleted successfully',
        data: [],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message,
          data: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
