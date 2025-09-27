import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QualityService } from './quality.service';
import { AvailabilityService } from './availability.service';
import { PerformanceService } from './performance.service';
import { OEEHourly } from 'src/schema/oee-hourly.schema';
// import { OEEDaily } from '../schemas/oee-daily.schema';
import { ShiftConfig, TimeFrame } from 'src/shared/interface/oee';
import { OEEResponseDto } from '../dto/timeframe.dto';
import { ResponseFormat } from 'src/shared/interface';
import * as moment from 'moment-timezone';
import { GetHourlyOEEDto } from '../dto/get-hourly-oee.dto';

@Injectable()
export class OEEService {
  constructor(
    @InjectModel(OEEHourly.name) private oeeHourlyModel: Model<OEEHourly>,
    // @InjectModel(OEEDaily.name) private oeeDailyModel: Model<OEEDaily>,
    private qualityService: QualityService,
    private availabilityService: AvailabilityService,
    private performanceService: PerformanceService,
  ) {}

  async realTimeOEE(): Promise<ResponseFormat<any>> {
    try {
      const timeFrame = this.calculateProductionShiftTimeFrame();

      const quality = await this.qualityService.calculate(timeFrame);

      const availability =
        await this.availabilityService.getAvailabilityDetails(timeFrame);
      const performance =
        await this.performanceService.getMultiMachinePerformanceArray(
          timeFrame,
        );
      // return availability as any;
      // return quality;
      // return performance as any;

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

        return {
          machineNumber,
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
        };
      });

      const factoryTotal = this.calculateFactoryOEE(
        quality,
        availability,
        performance,
      );

      return {
        status: 'success',
        message: 'Real-time OEE calculated successfully',
        data: [...combinedData, factoryTotal],
      };
    } catch (error) {
      return {
        status: 'error',
        message:
          (error as Error).message || 'Failed to calculate real-time OEE',
        data: [],
      };
    }
  }

  async saveHourlyOEE(): Promise<ResponseFormat<any>> {
    try {
      const timeFrame = this.calculateProductionShiftTimeFrame();

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
        // Use machineNumber, startTime, and shift as the unique key for the upsert
        const savedDoc = await this.oeeHourlyModel.findOneAndUpdate(
          {
            machine_number: record.machine_number,
            start_time: record.start_time,
            shift: record.shift,
          },
          record,
          { upsert: true, new: true }, // upsert: create if not found, new: return the updated document
        );
        savedRecords.push(savedDoc);
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
      return {
        status: 'error',
        message: (error as Error).message || 'Failed to get hourly OEE',
        data: [],
      };
    }
  }

  async saveDailyOEE(): Promise<void> {
    // TODO: Scheduled job to save daily OEE
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

  private roundDownToFiveMinutes(time: moment.Moment): moment.Moment {
    const minutes = time.minutes();
    const roundedMinutes = Math.floor(minutes / 5) * 5;
    return time.clone().minutes(roundedMinutes).seconds(0).milliseconds(0);
  }

  private getCurrentShiftInfo(currentTime: moment.Moment, config: ShiftConfig) {
    const hour = currentTime.hour();
    let shiftType: 'day' | 'night';
    let shiftStart: moment.Moment;
    let nextShiftStart: moment.Moment;

    // กะกลางวัน: 08:00 - 20:00
    if (hour >= config.day.start && hour < config.day.end) {
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
    // กะกลางคืน: 20:00 - 08:00
    else {
      shiftType = 'night';
      if (hour >= config.night.start) {
        // เวลา 20:00-23:59 (วันเดียวกัน)
        shiftStart = currentTime
          .clone()
          .startOf('day')
          .add(config.night.start, 'hours');
        nextShiftStart = currentTime
          .clone()
          .add(1, 'day')
          .startOf('day')
          .add(config.day.start, 'hours');
      } else {
        // เวลา 00:00-07:59 (วันถัดไป)
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

  private getShiftInfo(timestamp: Date): { type: 'day' | 'night'; hour: Date } {
    const moment_ts = moment(timestamp).tz('Asia/Bangkok');

    // Day shift: 08:00 - 20:00
    // Night shift: 20:00 - 08:00
    const hour = moment_ts.hour();
    const shiftType = hour >= 8 && hour < 20 ? 'day' : 'night';

    // Hour period (start of hour)
    const hourPeriod = moment_ts.startOf('hour').toDate();

    return { type: shiftType, hour: hourPeriod };
  }

  private calculateHourlyTimeFrames(): Array<
    TimeFrame & { shift: 'day' | 'night'; hour: Date }
  > {
    const frames: Array<TimeFrame & { shift: 'day' | 'night'; hour: Date }> =
      [];
    const now = moment().tz('Asia/Bangkok');

    // สร้าง timeframe สำหรับแต่ละชั่วโมงที่ต้องบันทึก
    for (let i = 0; i < 24; i++) {
      const hourStart = now.clone().subtract(i, 'hours').startOf('hour');
      const hourEnd = hourStart.clone().endOf('hour');

      const shiftInfo = this.getShiftInfo(hourStart.toDate());

      frames.push({
        machine_numbers: [],
        start_time: hourStart.toDate(),
        end_time: hourEnd.toDate(),
        shift: shiftInfo.type,
        hour: shiftInfo.hour,
      });
    }

    return frames;
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
        (a.totalOnTime || 0) + (a.totalOffTime || 0) + (a.totalAlarmTime || 0) >
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
        return acc;
      },
      { totalOnTime: 0, totalOffTime: 0, totalAlarmTime: 0 },
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
    const totalTime =
      availabilityTotals.totalOnTime +
      availabilityTotals.totalOffTime +
      availabilityTotals.totalAlarmTime;

    const factoryQuality =
      totalPieces > 0 ? (qualityTotals.totalGoodPieces / totalPieces) * 100 : 0;

    const factoryAvailability =
      totalTime > 0 ? (availabilityTotals.totalOnTime / totalTime) * 100 : 0;

    const factoryPerformance =
      performanceTotals.totalTheoreticalShots > 0
        ? (performanceTotals.totalActualShots /
            performanceTotals.totalTheoreticalShots) *
          100
        : 0;

    const factoryOEE =
      (factoryQuality * factoryAvailability * factoryPerformance) / 10000;

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
