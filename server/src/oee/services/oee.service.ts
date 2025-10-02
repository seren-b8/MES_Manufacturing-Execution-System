import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { QualityService } from './quality.service';
import { AvailabilityService } from './availability.service';
import { PerformanceService } from './performance.service';
import { OEEHourly } from 'src/schema/oee-hourly.schema';
// import { OEEDaily } from '../schemas/oee-daily.schema';
import { OEEQuery, ShiftConfig, TimeFrame } from 'src/shared/interface/oee';
import { OEEResponseDto } from '../dto/timeframe.dto';
import { ResponseFormat } from 'src/shared/interface';
import * as moment from 'moment-timezone';
import { GetHourlyOEEDto } from '../dto/get-hourly-oee.dto';
import { machine } from 'os';
import { OEEDaily } from 'src/schema/oee-daily.schema';
import { GetDailyOEEDto } from '../dto/get-daily-oee.dto';
import { OEEQueryDto } from '../dto/oee-query.dto';

@Injectable()
export class OEEService {
  constructor(
    @InjectModel(OEEHourly.name) private oeeHourlyModel: Model<OEEHourly>,
    @InjectModel(OEEDaily.name) private oeeDailyModel: Model<OEEDaily>,
    private qualityService: QualityService,
    private availabilityService: AvailabilityService,
    private performanceService: PerformanceService,
  ) {}

  async realTimeOEE(query: OEEQuery): Promise<ResponseFormat<any>> {
    try {
      const { date, shift, machine_numbers } = query;
      let combinedData: any[] = [];
      let machineList: string[] = [];

      const timeFrame = this.calculateProductionShiftTimeFrame();
      let startTime: Date | undefined;
      let endTime: Date | undefined;

      let isNotCurrentProductionDate = false;

      if (date) {
        const targetDate = moment(date).tz('Asia/Bangkok').startOf('day');
        const now = moment().tz('Asia/Bangkok');

        // คำนวณ production date ของปัจจุบัน
        const currentProductionDate = now.clone();
        if (now.hour() < 8) {
          currentProductionDate.subtract(1, 'day');
        }
        currentProductionDate.startOf('day');

        // เช็คว่าไม่ใช่ production date ปัจจุบัน
        isNotCurrentProductionDate = !targetDate.isSame(
          currentProductionDate,
          'day',
        );

        // คำนวณ shift timeframe
        if (shift === 'day' || shift === 'night') {
          const result = this.calculateShiftTimeframeForDate(date, shift);
          startTime = result.startTime;
          endTime = result.endTime;
        }
      }
      // --- 🚨 Logic สำหรับดึงข้อมูลย้อนหลังรายวัน/กะ 🚨 ---
      if (
        date &&
        startTime &&
        timeFrame.start_time.toString() !== startTime.toString() &&
        (shift === 'day' || shift === 'night')
      ) {
        combinedData = await this.getHistoricalOEEByDayAndShift(
          date,
          shift,
          machine_numbers,
        );
        machineList = combinedData.map((d) => d.machineNumber);

        return {
          status: 'success',
          message: `Historical OEE data retrieved at ${date} ${shift} `,
          data: combinedData,
        };
      }

      if (date && !shift && isNotCurrentProductionDate) {
        const filter: any = {
          date: moment(date).tz('Asia/Bangkok').startOf('day').toDate(),
        };

        if (machine_numbers?.length > 0) {
          filter.machine_number = { $in: machine_numbers };
        }

        const dailyRecords = await this.oeeDailyModel
          .find(filter)
          .sort({ machine_number: 1 })
          .exec();

        if (dailyRecords.length > 0) {
          combinedData = dailyRecords.map((record) => ({
            machineNumber: record.machine_number,
            quality: record.quality,
            availability: record.availability,
            performance: record.performance,
            oee: record.oee,
            // // เพิ่มข้อมูลเสริม
            // shift_breakdown: record.shift_breakdown,
            // data_warnings: record.data_warnings,
            // has_incomplete_data: record.has_incomplete_data,
          }));

          return {
            status: 'success',
            message: `Daily OEE data retrieved for ${moment(date).format('YYYY-MM-DD')}`,
            data: combinedData,
          };
        } else {
          const requestedDate = moment(date).format('YYYY-MM-DD');
          const nextGenerationTime = moment(date)
            .tz('Asia/Bangkok')
            .add(1, 'day')
            .set({ hour: 8, minute: 10, second: 0 })
            .format('YYYY-MM-DD HH:mm');

          throw new HttpException(
            {
              status: 'error',
              message: `Daily OEE data for ${requestedDate} is not yet available. It will be automatically generated at ${nextGenerationTime}.`,
              data: [],
            },
            HttpStatus.NOT_FOUND,
          );
        }
      }

      const quality = await this.qualityService.calculate(timeFrame);

      const availability =
        await this.availabilityService.getAvailabilityDetails(timeFrame);
      const performance =
        await this.performanceService.getMultiMachinePerformanceArray(
          timeFrame,
        );

      machineList =
        timeFrame.machine_numbers?.length > 0
          ? timeFrame.machine_numbers
          : this.getAllUniqueMachines(quality, availability, performance);

      combinedData = machineList.map((machineNumber) => {
        const qualityData = quality.find(
          (q) => q.machineNumber === machineNumber,
        );
        const availabilityData = availability.find(
          (a) => a.machineNumber === machineNumber,
        );
        const performanceData = performance.find(
          (p) => p.machineNumber === machineNumber,
        );

        return {
          machineNumber,
          quality: qualityData?.quality || 0,
          availability: availabilityData?.availability || 0,
          performance: performanceData?.performance || 0,

          oee:
            Math.round(
              (((qualityData?.quality || 0) *
                (availabilityData?.availability || 0) *
                (performanceData?.performance || 0)) /
                10000) *
                100,
            ) / 100,
        };
      });

      const machineCount = machineList.length;

      const factoryTotal = this.calculateFactoryOEEAvg(
        quality,
        availability,
        performance,
        machineCount,
      );

      return {
        status: 'success',
        message: 'Real-time OEE calculated successfully',
        data: [...combinedData, factoryTotal],
      };
    } catch (error) {
      // Handle specific HttpException
      if (error instanceof HttpException) {
        throw error;
      }

      if (
        (error as Error).name === 'MongoError' ||
        (error as Error).name === 'MongoServerError'
      ) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Database error occurred while calculating OEE',
            data: [],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Handle unexpected errors
      throw new HttpException(
        {
          status: 'error',
          message:
            (error as Error).message || 'Failed to calculate real-time OEE',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async saveHourlyOEE(): Promise<ResponseFormat<any>> {
    try {
      const timeFrame = this.calculateCompletedShiftTimeFrame();

      const quality = await this.qualityService.calculate(timeFrame);

      const availability =
        await this.availabilityService.getAvailabilityDetails(timeFrame);
      const performance =
        await this.performanceService.getMultiMachinePerformanceArray(
          timeFrame,
        );

      const machineList =
        timeFrame.machine_numbers?.length > 0
          ? timeFrame.machine_numbers
          : this.getAllUniqueMachines(quality, availability, performance);

      // วิธีรวมข้อมูลใน array
      const combinedData = machineList.map((machineNumber) => {
        // หา quality data
        const qualityData = quality.find(
          (q) => q.machineNumber === machineNumber,
        );

        // หา availability data
        const availabilityData = availability.find(
          (a) => a.machineNumber === machineNumber,
        );

        // หา performance data
        const performanceData = performance.find(
          (p) => p.machineNumber === machineNumber,
        );

        // --- Construct the OEE Record for the database ---
        // Note: The structure now matches the OEEHourly schema (using startTime instead of 'hour')
        const oeeRecord = {
          machine_number: machineNumber, // machineNumber
          start_time: timeFrame.start_time,
          end_time: timeFrame.end_time,
          shift: timeFrame.shift_type, // shift
          quality: qualityData?.quality || 0,
          availability: availabilityData?.availability || 0,
          performance: performanceData?.performance || 0,
          // คำนวณ OEE
          oee:
            Math.round(
              (((qualityData?.quality || 0) *
                (availabilityData?.availability || 0) *
                (performanceData?.performance || 0)) /
                10000) *
                100,
            ) / 100,
          ...(qualityData && {
            quality_pieces_data: {
              good_pieces: qualityData.goodPieces,
              not_good_pieces: qualityData.notGoodPieces,
              total_pieces: qualityData.totalPieces,
            },
          }),
          ...(availabilityData && {
            availability_data: {
              total_on_time: availabilityData.totalOnTime,
              total_off_time: availabilityData.totalOffTime,
              total_alarm_time: availabilityData.totalAlarmTime,
              total_time: availabilityData.totalTime,
              planned_downtime:
                availabilityData.downtimeBreakdown.plannedDowntime,
            },
          }),
          ...(performanceData && {
            performance_data: {
              actual_shots: performanceData.actualShots,
              theoretical_shots: performanceData.theoreticalShots,
              target_cycle_time: performanceData.targetCycleTime,
              timeframe_duration_seconds:
                performanceData.timeframeDurationSeconds,
            },
          }),
        };

        return oeeRecord;
      });

      // --- NEW: Save/Upsert Data to Database ---
      const savedRecords = [];
      for (const record of combinedData) {
        try {
          const savedDoc = await this.oeeHourlyModel.create(record);
          savedRecords.push(savedDoc);
        } catch (error) {
          // Type guard สำหรับ MongoDB duplicate key error
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 11000
          ) {
            console.log(
              `Skipping duplicate for machine ${record.machine_number}`,
            );
            continue;
          }
          throw error;
        }
      }

      const factoryAverage = this.calculateFactoryAverageOEE(combinedData);

      if (factoryAverage) {
        const factoryRecord = {
          ...factoryAverage,
          start_time: timeFrame.start_time,
          end_time: timeFrame.end_time,
          shift: timeFrame.shift_type,
        };

        try {
          const savedFactory = await this.oeeHourlyModel.create(factoryRecord);
          savedRecords.push(savedFactory);
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 11000
          ) {
            console.log('Skipping duplicate for factory average (ALL)');
          } else {
            throw error;
          }
        }
      }

      return {
        status: 'success',
        message: `Hourly OEE calculated and saved successfully for ${savedRecords.length} machines.`,
        data: savedRecords,
      };
    } catch (error) {
      return {
        status: 'error',
        message:
          (error as Error).message || 'Failed to calculate and save hourly OEE',
        data: [],
      };
    }
  }

  async getHourlyOEE(
    query: GetHourlyOEEDto,
  ): Promise<ResponseFormat<OEEHourly>> {
    try {
      const filter: any = {};

      // Machine filter
      if (query.machine_number) {
        filter.machine_number = query.machine_number;
      } else if (query.machine_numbers?.length > 0) {
        filter.machine_number = { $in: query.machine_numbers };
      }

      // Date range filter
      if (query.start_date || query.end_date) {
        filter.start_time = {};
        if (query.start_date) {
          filter.start_time.$gte = moment(query.start_date)
            .tz('Asia/Bangkok')
            .startOf('day')
            .toDate();
        }
        if (query.end_date) {
          filter.start_time.$lte = moment(query.end_date)
            .tz('Asia/Bangkok')
            .endOf('day')
            .toDate();
        }
      }

      // Shift filter
      if (query.shift_type) {
        filter.shift_type = query.shift_type;
      }

      const records = await this.oeeHourlyModel
        .find(filter)
        .sort({ machine_number: 1, hour: -1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${records.length} hourly OEE records`,
        data: records,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message || 'Failed to get hourly OEE',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async saveDailyOEE(targetDate?: string): Promise<ResponseFormat<OEEDaily>> {
    try {
      const date = targetDate
        ? moment(targetDate).tz('Asia/Bangkok').startOf('day')
        : moment().tz('Asia/Bangkok').subtract(1, 'day').startOf('day');

      const dayShiftData = await this.getShiftOEEData(date.toDate(), 'day');
      const nightShiftData = await this.getShiftOEEData(date.toDate(), 'night');

      const machines = this.getUniqueMachines(dayShiftData, nightShiftData);
      const savedRecords = [];

      for (const machineNumber of machines) {
        const dayRecord = dayShiftData.find(
          (d) => d.machine_number === machineNumber,
        );
        const nightRecord = nightShiftData.find(
          (d) => d.machine_number === machineNumber,
        );

        const dailyOEE = this.calculateDailyOEE(dayRecord, nightRecord);

        const record = {
          machine_number: machineNumber,
          date: date.toDate(),
          ...dailyOEE,
          shift_breakdown: {
            day_shift: dayRecord || {
              oee: 0,
              quality: 0,
              availability: 0,
              performance: 0,
            },
            night_shift: nightRecord || {
              oee: 0,
              quality: 0,
              availability: 0,
              performance: 0,
            },
          },
        };

        const saved = await this.oeeDailyModel.findOneAndUpdate(
          { machine_number: machineNumber, date: date.toDate() },
          record,
          { upsert: true, new: true },
        );
        savedRecords.push(saved);
      }

      const factoryAvg = this.calculateDailyFactoryAverage(savedRecords);
      if (factoryAvg) {
        const factorySaved = await this.oeeDailyModel.findOneAndUpdate(
          { machine_number: 'ALL', date: date.toDate() },
          { ...factoryAvg, date: date.toDate() },
          { upsert: true, new: true },
        );
        savedRecords.push(factorySaved);
      }

      return {
        status: 'success',
        message: `Daily OEE saved for ${savedRecords.length} machines`,
        data: savedRecords,
      };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message || 'Failed to save daily OEE',
        data: [],
      };
    }
  }

  async getDailyOEE(query: GetDailyOEEDto): Promise<ResponseFormat<OEEDaily>> {
    try {
      const filter: any = {};

      // Machine filter
      if (query.machine_number) {
        filter.machine_number = query.machine_number;
      } else if (query.machine_numbers?.length > 0) {
        filter.machine_number = { $in: query.machine_numbers };
      }
      if (query.has_incomplete_data !== undefined) {
        filter.has_incomplete_data = query.has_incomplete_data;
      }

      if (query.exclude_warnings) {
        filter.data_warnings = { $size: 0 }; // เฉพาะที่ไม่มี warning
      }

      // Date range filter
      if (query.start_date || query.end_date) {
        filter.date = {};
        if (query.start_date) {
          filter.date.$gte = moment(query.start_date)
            .tz('Asia/Bangkok')
            .startOf('day')
            .toDate();
        }
        if (query.end_date) {
          filter.date.$lte = moment(query.end_date)
            .tz('Asia/Bangkok')
            .endOf('day')
            .toDate();
        }
      }

      const records = await this.oeeDailyModel
        .find(filter)
        .sort({ machine_number: 1, date: -1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${records.length} daily OEE records`,
        data: records,
      };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message || 'Failed to get daily OEE',
        data: [],
      };
    }
  }

  private async getShiftOEEData(
    date: Date,
    shift: 'day' | 'night',
  ): Promise<any[]> {
    const { startTime, endTime } = this.calculateShiftTimeframeForDate(
      moment(date).format('YYYY-MM-DD'),
      shift,
    );

    // ใช้ aggregation เพื่อดึง record ล่าสุดของแต่ละเครื่อง
    const pipeline: PipelineStage[] = [
      {
        $match: {
          start_time: { $gte: startTime, $lte: endTime },
          shift: shift,
          machine_number: { $ne: 'ALL' },
        },
      },
      {
        $sort: { machine_number: 1, end_time: -1 }, // เรียงตาม end_time จากมากไปน้อย
      },
      {
        $group: {
          _id: '$machine_number',
          // ดึงเอกสารแรก (end_time สูงสุด) ของแต่ละเครื่อง
          machine_number: { $first: '$machine_number' },
          oee: { $first: '$oee' },
          quality: { $first: '$quality' },
          availability: { $first: '$availability' },
          performance: { $first: '$performance' },
          quality_pieces_data: { $first: '$quality_pieces_data' },
          availability_data: { $first: '$availability_data' },
          performance_data: { $first: '$performance_data' },
          start_time: { $first: '$start_time' },
          end_time: { $first: '$end_time' },
        },
      },
      {
        $project: {
          _id: 0,
          machine_number: 1,
          oee: 1,
          quality: 1,
          availability: 1,
          performance: 1,
          quality_pieces_data: 1,
          availability_data: 1,
          performance_data: 1,
          start_time: 1,
          end_time: 1,
        },
      },
    ];

    return this.oeeHourlyModel.aggregate(pipeline).exec();
  }

  private calculateDailyOEE(dayShift?: any, nightShift?: any) {
    const shifts = [dayShift, nightShift].filter(
      (s) => s && this.hasAnyMetric(s),
    );

    if (shifts.length === 0) {
      return {
        oee: 0,
        quality: 0,
        availability: 0,
        performance: 0,
        warnings: [],
        has_incomplete_data: false,
        hours_summary: {
          day_shift_hours: 0,
          night_shift_hours: 0,
          total_hours: 0,
        },
        raw_totals: null,
      };
    }

    const metrics = ['quality', 'availability', 'performance'];
    const result: any = { warnings: [] };

    metrics.forEach((metric) => {
      const values = shifts.map((s) => s[metric] || 0).filter((v) => v > 0);
      result[metric] =
        values.length > 0
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : 0;
    });

    result.oee =
      (result.quality * result.availability * result.performance) / 10000;

    // ตรวจสอบและเพิ่ม warnings
    if (
      result.quality === 0 &&
      (result.availability > 0 || result.performance > 0)
    ) {
      result.warnings.push('no_production_records');
    }
    if (result.performance > 150) {
      result.warnings.push('performance_over_150_percent');
    }
    if (!dayShift || !this.hasAnyMetric(dayShift)) {
      result.warnings.push('missing_day_shift_data');
    }
    if (!nightShift || !this.hasAnyMetric(nightShift)) {
      result.warnings.push('missing_night_shift_data');
    }

    // คำนวณ hours summary
    result.hours_summary = {
      day_shift_hours: dayShift && this.hasAnyMetric(dayShift) ? 12 : 0,
      night_shift_hours: nightShift && this.hasAnyMetric(nightShift) ? 12 : 0,
      total_hours: shifts.length * 12,
    };

    // คำนวณ raw totals
    result.raw_totals = this.calculateRawTotals(dayShift, nightShift);

    // ตั้ง incomplete flag
    result.has_incomplete_data = result.warnings.length > 0;
    result.incomplete_reason = result.warnings.join(', ');

    return {
      oee: Math.round(result.oee * 100) / 100,
      quality: Math.round(result.quality * 100) / 100,
      availability: Math.round(result.availability * 100) / 100,
      performance: Math.round(result.performance * 100) / 100,
      data_warnings: result.warnings,
      has_incomplete_data: result.has_incomplete_data,
      incomplete_reason: result.incomplete_reason,
      hours_summary: result.hours_summary,
      raw_totals: result.raw_totals,
    };
  }

  private calculateRawTotals(dayShift?: any, nightShift?: any) {
    const shifts = [dayShift, nightShift].filter((s) => s);

    if (shifts.length === 0) return null;

    return {
      total_good_pieces: shifts.reduce(
        (sum, s) => sum + (s.quality_pieces_data?.good_pieces || 0),
        0,
      ),
      total_not_good_pieces: shifts.reduce(
        (sum, s) => sum + (s.quality_pieces_data?.not_good_pieces || 0),
        0,
      ),
      total_pieces: shifts.reduce(
        (sum, s) => sum + (s.quality_pieces_data?.total_pieces || 0),
        0,
      ),
      total_on_time: shifts.reduce(
        (sum, s) => sum + (s.availability_data?.total_on_time || 0),
        0,
      ),
      total_actual_shots: shifts.reduce(
        (sum, s) => sum + (s.performance_data?.actual_shots || 0),
        0,
      ),
      total_theoretical_shots: shifts.reduce(
        (sum, s) => sum + (s.performance_data?.theoretical_shots || 0),
        0,
      ),
    };
  }

  private hasAnyMetric(shift: any): boolean {
    return shift.quality > 0 || shift.availability > 0 || shift.performance > 0;
  }

  private getUniqueMachines(...arrays: any[][]): string[] {
    const machines = new Set<string>();
    arrays.forEach((arr) => {
      arr.forEach((item) => {
        if (item?.machine_number && item.machine_number !== 'ALL') {
          machines.add(item.machine_number);
        }
      });
    });
    return Array.from(machines);
  }

  private calculateDailyFactoryAverage(records: any[]): any {
    const validRecords = records.filter((r) => r.machine_number !== 'ALL');
    if (validRecords.length === 0) return null;

    const sum = validRecords.reduce(
      (acc, r) => ({
        quality: acc.quality + r.quality,
        availability: acc.availability + r.availability,
        performance: acc.performance + r.performance,
      }),
      { quality: 0, availability: 0, performance: 0 },
    );

    const count = validRecords.length;
    const avgQ = sum.quality / count;
    const avgA = sum.availability / count;
    const avgP = sum.performance / count;

    return {
      machine_number: 'ALL',
      oee: Math.round(((avgQ * avgA * avgP) / 10000) * 100) / 100,
      quality: Math.round(avgQ * 100) / 100,
      availability: Math.round(avgA * 100) / 100,
      performance: Math.round(avgP * 100) / 100,
    };
  }

  private getAllUniqueMachines(
    quality: any[],
    availability: any[],
    performance: any[],
  ): string[] {
    const machines = new Set<string>();
    quality.forEach((q) => q.machineNumber && machines.add(q.machineNumber));
    availability.forEach(
      (a) => a.machineNumber && machines.add(a.machineNumber),
    );
    performance.forEach(
      (p) => p.machineNumber && machines.add(p.machineNumber),
    );
    return Array.from(machines);
  }

  private calculateProductionShiftTimeFrame(): TimeFrame {
    const now = moment().tz('Asia/Bangkok');
    const shiftConfig: ShiftConfig = {
      day: { start: 8, end: 20 }, // 08:00 - 20:00
      night: { start: 20, end: 8 }, // 20:00 - 08:00
    };

    // ปรับนาทีลงเลข 5 และ 0
    const adjustedEndTime = this.roundDownToFiveMinutes(now);

    // หาช่วงกะปัจจุบัน
    const shiftInfo = this.getCurrentShiftInfo(now, shiftConfig);

    return {
      machine_numbers: [],
      start_time: shiftInfo.shift_start.toDate(),
      end_time: adjustedEndTime.toDate(),
      shift_type: shiftInfo.shift_type,
    };
  }

  private calculateCompletedShiftTimeFrame(): TimeFrame {
    const now = moment().tz('Asia/Bangkok');
    const shiftConfig: ShiftConfig = {
      day: { start: 8, end: 20 },
      night: { start: 20, end: 8 },
    };

    const currentShiftInfo = this.getCurrentShiftInfo(now, shiftConfig);

    // ✅ คำนวณกะที่เสร็จสมบูรณ์ล่าสุด
    const completedShift = this.getLastCompletedShift(
      now,
      currentShiftInfo,
      shiftConfig,
    );

    return {
      machine_numbers: [],
      start_time: completedShift.shift_start.toDate(),
      end_time: completedShift.shift_end.toDate(),
      shift_type: completedShift.shift_type,
    };
  }

  private getLastCompletedShift(
    currentTime: moment.Moment,
    currentShift: any,
    config: ShiftConfig,
  ) {
    const hour = currentTime.hour();
    const minute = currentTime.minute();

    // ✅ ถ้าเพิ่งเริ่มกะใหม่ (ช่วง 5 นาทีแรก) ให้ใช้กะก่อนหน้า
    const isNewShiftStart =
      (hour === config.day.start && minute < 5) || // 08:00-08:04
      (hour === config.night.start && minute < 5); // 20:00-20:04

    if (isNewShiftStart) {
      // ใช้กะก่อนหน้า
      if (hour === config.day.start) {
        // เพิ่งเริ่มกะวัน → ใช้กะกลางคืนที่ผ่านมา
        return {
          shift_type: 'night',
          shift_start: currentTime
            .clone()
            .subtract(1, 'day')
            .startOf('day')
            .add(config.night.start, 'hours'), // 20:00 เมื่อวาน
          shift_end: currentTime
            .clone()
            .startOf('day')
            .add(config.day.start, 'hours'), // 08:00 วันนี้
        };
      } else {
        // เพิ่งเริ่มกะกลางคืน → ใช้กะวันที่ผ่านมา
        return {
          shift_type: 'day',
          shift_start: currentTime
            .clone()
            .startOf('day')
            .add(config.day.start, 'hours'),
          shift_end: currentTime
            .clone()
            .startOf('day')
            .add(config.night.start, 'hours'),
        };
      }
    }

    // ✅ ไม่ใช่ช่วงเริ่มกะใหม่ → ใช้กะปัจจุบัน
    const adjustedEndTime = this.roundDownToFiveMinutes(currentTime);

    return {
      shift_type: currentShift.shift_type,
      shift_start: currentShift.shift_start,
      shift_end: adjustedEndTime,
    };
  }

  private roundDownToFiveMinutes(time: moment.Moment): moment.Moment {
    const minutes = time.minutes();
    const roundedMinutes = Math.floor(minutes / 5) * 5;
    return time.clone().minutes(roundedMinutes).seconds(0).milliseconds(0);
  }

  async getHistoricalOEEByDayAndShift(
    dateStr: string,
    shift: 'day' | 'night',
    machineNumbers?: string[],
  ): Promise<any[]> {
    // 1. กำหนดช่วงเวลาของกะที่ต้องการ
    const { startTime, endTime } = this.calculateShiftTimeframeForDate(
      dateStr,
      shift,
    );

    const match: any = {
      start_time: { $gte: startTime, $lte: endTime },
      shift: shift,
    };

    if (machineNumbers?.length) {
      match.machine_number = { $in: machineNumbers };
    }

    // 2. ใช้ Aggregation Pipeline เพื่อดึงข้อมูลล่าสุดของแต่ละเครื่อง
    const pipeline: PipelineStage[] = [
      // 1. กรองตามช่วงเวลาและกะที่กำหนด
      { $match: match },

      // 2. จัดกลุ่มตาม machine_number และดึงเอกสารล่าสุด
      {
        $sort: { start_time: -1 }, // เรียงจากเวลาล่าสุดไปก่อน
      },
      {
        $group: {
          _id: '$machine_number',
          // ดึงฟิลด์ของเอกสารแรก (ซึ่งคือเอกสารล่าสุดหลังการ sort)
          latestOEE: { $first: '$oee' },
          latestQuality: { $first: '$quality' },
          latestAvailability: { $first: '$availability' },
          latestPerformance: { $first: '$performance' },
          latestStartTime: { $first: '$start_time' }, // ใช้สำหรับตรวจสอบ/ debug
        },
      },

      // 3. ปรับโครงสร้างผลลัพธ์ให้ตรงกับที่ต้องการ
      {
        $project: {
          _id: 0,
          machineNumber: '$_id',
          oee: '$latestOEE',
          quality: '$latestQuality',
          availability: '$latestAvailability',
          performance: '$latestPerformance',
          // startTime: '$latestStartTime', // เพิ่มเข้ามาเพื่อการตรวจสอบ
        },
      },
    ];

    // สมมติว่า oeeHourlyService.aggregate() ใช้กับ OEEHourly collection
    // และคืนค่าเป็น Promise<any[]>
    return this.oeeHourlyModel.aggregate(pipeline);
  }

  private calculateShiftTimeframeForDate(
    dateStr: string,
    shift: 'day' | 'night',
  ) {
    // ใช้ moment(dateStr) เพื่อสร้าง object จาก string และ ensure ว่าเป็นเริ่มต้นของวันนั้นๆ (เที่ยงคืน)
    const baseDay = moment.tz(dateStr, 'Asia/Bangkok').startOf('day');
    let startTime: moment.Moment;
    let endTime: moment.Moment;

    if (shift === 'day') {
      // ⏰ กะ Day: เริ่ม 8:00 AM และ สิ้นสุด 8:00 PM ของวันเดียวกัน

      // ตั้งค่า startTime เป็น 08:00 ของวันที่ baseDay
      startTime = baseDay
        .clone()
        .hours(8)
        .minutes(0)
        .seconds(0)
        .milliseconds(0);

      // ตั้งค่า endTime เป็น 20:00 ของวันที่ baseDay
      endTime = baseDay.clone().hours(20).minutes(0).seconds(1).milliseconds(0);
    } else {
      // 'night'
      // 🌙 กะ Night: เริ่ม 8:00 PM ของวันเดียวกัน และ สิ้นสุด 8:00 AM ของวันถัดไป

      // ตั้งค่า startTime เป็น 20:00 ของวันที่ baseDay
      startTime = baseDay
        .clone()
        .hours(20)
        .minutes(0)
        .seconds(0)
        .milliseconds(0);

      // ตั้งค่า endTime เป็น 08:00 ของวันถัดไป (baseDay.add(1, 'day') จะเปลี่ยน baseDay โดยตรง, ควรใช้ clone ก่อน)
      endTime = baseDay
        .clone()
        .add(1, 'day')
        .hours(8)
        .minutes(0)
        .seconds(0)
        .milliseconds(0);
    }

    // ส่งคืนค่าเป็น Object ที่มี Date object (ใช้ .toDate() ของ moment) เพื่อให้เข้ากันได้กับ TimeFrame type เดิม
    // const timeFrame: { machine_numbers: string[]; start_time: Date; end_time: Date; shift_type?: "day" | "night";}
    return {
      startTime: startTime.toDate(),
      endTime: endTime.toDate(),
    };
  }

  private getCurrentShiftInfo(currentTime: moment.Moment, config: ShiftConfig) {
    const hour = currentTime.hour();
    const minute = currentTime.minute();

    let shiftType: 'day' | 'night';
    let shiftStart: moment.Moment;
    let nextShiftStart: moment.Moment;

    // Day Shift: 08:00:00 - 20:00:00 (inclusive)
    const isDayShift =
      (hour > config.day.start && hour < config.day.end) || // 09:00-19:59
      (hour === config.day.start && minute >= 0) || // 08:00:00-08:59:59
      (hour === config.day.end && minute === 0); // 20:00:00 only

    if (isDayShift) {
      shiftType = 'day';
      shiftStart = currentTime
        .clone()
        .startOf('day')
        .add(config.day.start, 'hours');
      nextShiftStart = currentTime
        .clone()
        .startOf('day')
        .add(config.day.end, 'hours');
    }
    // Night Shift: 20:00:01 - 08:00:00 (spans two days)
    else {
      shiftType = 'night';

      // Night part 1: 20:00:01 - 23:59:59 (today)
      if (
        hour >= config.night.start ||
        (hour === config.day.end && minute > 0)
      ) {
        shiftStart = currentTime
          .clone()
          .startOf('day')
          .add(config.night.start, 'hours');
        nextShiftStart = currentTime
          .clone()
          .add(1, 'day')
          .startOf('day')
          .add(config.day.start, 'hours');
      }
      // Night part 2: 00:00:00 - 08:00:00 (today, but shift started yesterday)
      else {
        shiftStart = currentTime
          .clone()
          .subtract(1, 'day')
          .startOf('day')
          .add(config.night.start, 'hours');
        nextShiftStart = currentTime
          .clone()
          .startOf('day')
          .add(config.day.start, 'hours');
      }
    }

    return {
      shift_type: shiftType,
      shift_start: shiftStart,
      next_shift_start: nextShiftStart,
    };
  }

  private calculateFactoryOEE(
    qualityArray: any[],
    availabilityArray: any[],
    performanceArray: any[],
  ): any {
    // Filter เฉพาะเครื่องที่มีข้อมูล
    const validQualityData = qualityArray.filter(
      (q) => (q.goodPieces || 0) + (q.notGoodPieces || 0) > 0,
    );

    const validAvailabilityData = availabilityArray.filter(
      (a) =>
        (a.totalOnTime || 0) +
          (a.totalOffTime || 0) +
          (a.totalAlarmTime || 0) +
          (a.plannedDowntime || 0) >
        0,
    );

    const validPerformanceData = performanceArray.filter(
      (p) => (p.actualShots || 0) > 0 && (p.theoreticalShots || 0) > 0,
    );

    // Factory Quality Total
    const qualityTotals = validQualityData.reduce(
      (acc, q) => {
        acc.totalGoodPieces += q.goodPieces || 0;
        acc.totalNotGoodPieces += q.notGoodPieces || 0;
        return acc;
      },
      { totalGoodPieces: 0, totalNotGoodPieces: 0 },
    );

    // Factory Availability Total
    const availabilityTotals = validAvailabilityData.reduce(
      (acc, a) => {
        acc.totalOnTime += a.totalOnTime || 0;
        acc.totalOffTime += a.totalOffTime || 0;
        acc.totalAlarmTime += a.totalAlarmTime || 0;
        acc.plannedDowntime += a.plannedDowntime || 0;
        return acc;
      },
      {
        totalOnTime: 0,
        totalOffTime: 0,
        totalAlarmTime: 0,
        plannedDowntime: 0,
      },
    );

    // Factory Performance Total
    const performanceTotals = validPerformanceData.reduce(
      (acc, p) => {
        acc.totalActualShots += p.actualShots || 0;
        acc.totalTheoreticalShots += p.theoreticalShots || 0;
        return acc;
      },
      { totalActualShots: 0, totalTheoreticalShots: 0 },
    );

    // Calculate Factory Metrics
    const totalPieces =
      qualityTotals.totalGoodPieces + qualityTotals.totalNotGoodPieces;
    const plannedProductionTime =
      availabilityTotals.totalOnTime +
      availabilityTotals.totalOffTime +
      availabilityTotals.totalAlarmTime -
      availabilityTotals.plannedDowntime;

    const factoryQuality =
      totalPieces > 0 ? (qualityTotals.totalGoodPieces / totalPieces) * 100 : 0;

    const factoryAvailability =
      plannedProductionTime > 0
        ? (availabilityTotals.totalOnTime / plannedProductionTime) * 100
        : 0;

    const factoryPerformance =
      performanceTotals.totalTheoreticalShots > 0
        ? (performanceTotals.totalActualShots /
            performanceTotals.totalTheoreticalShots) *
          100
        : 0;

    const factoryOEE =
      (factoryQuality *
        (factoryAvailability > 100 ? 100 : factoryAvailability) *
        factoryPerformance) /
      10000;

    return {
      machineNumber: 'ALL',
      quality: Math.round(factoryQuality * 100) / 100,
      availability: Math.round(factoryAvailability * 100) / 100,
      performance: Math.round(factoryPerformance * 100) / 100,
      oee: Math.round(factoryOEE * 100) / 100,

      // // Factory Summary Data
      // totalGoodPieces: qualityTotals.totalGoodPieces,
      // totalNotGoodPieces: qualityTotals.totalNotGoodPieces,
      // totalPieces: totalPieces,
      // totalOnTime: Math.round(availabilityTotals.totalOnTime * 100) / 100,
      // totalActualShots: performanceTotals.totalActualShots,
      // totalTheoreticalShots:
      //   Math.round(performanceTotals.totalTheoreticalShots * 100) / 100,

      // // Machine counts
      // activeMachines: qualityArray.length,
      // validQualityMachines: validQualityData.length,
      // validAvailabilityMachines: validAvailabilityData.length,
      // validPerformanceMachines: validPerformanceData.length,
    };
  }

  private calculateFactoryOEEAvg(
    qualityArray: any[],
    availabilityArray: any[],
    performanceArray: any[],
    machineCount: number, // จำนวนเครื่องจักรทั้งหมด
  ): any {
    // 1. กรองเฉพาะเครื่องที่มีข้อมูลตามเกณฑ์เดิม (เพื่อให้แน่ใจว่าค่าที่นำมาเฉลี่ยมีความหมาย)
    const validQualityData = qualityArray.filter(
      (q) => (q.goodPieces || 0) + (q.notGoodPieces || 0) > 0,
    );
    const validAvailabilityData = availabilityArray.filter(
      (a) =>
        (a.totalOnTime || 0) +
          (a.totalOffTime || 0) +
          (a.totalAlarmTime || 0) +
          (a.plannedDowntime || 0) >
        0,
    );
    // สำหรับ Performance ในการคำนวณ OEE แบบรวม (aggregate OEE) มักใช้ Shots/Pieces รวม
    // แต่สำหรับการเฉลี่ย เราจะใช้ค่า Performance ที่คำนวณไว้แล้ว (p.performance)
    const validPerformanceData = performanceArray.filter(
      // กรองตามเงื่อนไขเดิมสำหรับ total shots ถ้ามี (p.actualShots > 0 และ p.theoreticalShots > 0)
      // หรืออย่างน้อยต้องมีค่า performance ที่คำนวณไว้แล้ว
      (p) =>
        (p.actualShots || 0) > 0 ||
        (p.performance !== undefined && p.performance !== null),
    );

    // 2. คำนวณผลรวมของค่า Quality, Availability, และ Performance ที่คำนวณไว้แล้วในแต่ละเครื่อง

    // Quality Total
    const totalQualityValue = validQualityData.reduce(
      (acc, q) => acc + (q.quality || 0), // สมมติว่า q.quality คือค่า Quality ที่คำนวณไว้แล้ว (เป็น %)
      0,
    );

    // Availability Total
    const totalAvailabilityValue = validAvailabilityData.reduce(
      (acc, a) => acc + (a.availability || 0), // สมมติว่า a.availability คือค่า Availability ที่คำนวณไว้แล้ว (เป็น %)
      0,
    );

    // Performance Total
    const totalPerformanceValue = validPerformanceData.reduce(
      (acc, p) => acc + (p.performance || 0), // สมมติว่า p.performance คือค่า Performance ที่คำนวณไว้แล้ว (เป็น %)
      0,
    );

    // 3. คำนวณ Factory Metrics โดยใช้ค่าเฉลี่ย

    // ค่าเฉลี่ย Quality (หารด้วย machineCount ทั้งหมด)
    const factoryQualityAvg =
      machineCount > 0 ? totalQualityValue / machineCount : 0;

    // ค่าเฉลี่ย Availability (หารด้วย machineCount ทั้งหมด)
    const factoryAvailabilityAvg =
      machineCount > 0 ? totalAvailabilityValue / machineCount : 0;

    // ค่าเฉลี่ย Performance (หารด้วย machineCount ทั้งหมด)
    const factoryPerformanceAvg =
      machineCount > 0 ? totalPerformanceValue / machineCount : 0;

    // 4. คำนวณ Factory OEE (OEE = Q x A x P)
    // OEE = (Q/100) * (A/100) * (P/100) * 100
    const factoryOEEAvg =
      (factoryQualityAvg * factoryAvailabilityAvg * factoryPerformanceAvg) /
      10000;

    // 5. ส่งคืนผลลัพธ์
    return {
      machineNumber: 'ALL', // กำหนดเป็น 'ALL_AVG' เพื่อระบุว่าคำนวณจากค่าเฉลี่ย
      quality: Math.round(factoryQualityAvg * 100) / 100,
      availability: Math.round(factoryAvailabilityAvg * 100) / 100,
      performance: Math.round(factoryPerformanceAvg * 100) / 100,
      oee: Math.round(factoryOEEAvg * 100) / 100,
    };
  }

  private calculateFactoryAverageOEE(machineOEEData: any[]): any {
    if (machineOEEData.length === 0) {
      return null;
    }

    const totalQuality = machineOEEData.reduce((sum, m) => sum + m.quality, 0);
    const totalAvailability = machineOEEData.reduce(
      (sum, m) => sum + m.availability,
      0,
    );
    const totalPerformance = machineOEEData.reduce(
      (sum, m) => sum + m.performance,
      0,
    );
    const count = machineOEEData.length;

    const avgQuality = Math.round((totalQuality / count) * 100) / 100;
    const avgAvailability = Math.round((totalAvailability / count) * 100) / 100;
    const avgPerformance = Math.round((totalPerformance / count) * 100) / 100;
    const avgOEE =
      Math.round(
        ((avgQuality * avgAvailability * avgPerformance) / 10000) * 100,
      ) / 100;

    return {
      machine_number: 'ALL',
      quality: avgQuality,
      availability: avgAvailability,
      performance: avgPerformance,
      oee: avgOEE,
    };
  }

  async calculateFactoryOEEOnly(timeFrame: TimeFrame): Promise<any> {
    const quality = await this.qualityService.calculate(timeFrame);
    const availability =
      await this.availabilityService.getAvailabilityDetails(timeFrame);
    // const availability =
    //   await this.availabilityService.getAvailabilityArray(timeFrame);
    const performance =
      await this.performanceService.getMultiMachinePerformanceArray(timeFrame);

    return this.calculateFactoryOEE(quality, availability, performance);
  }
}
