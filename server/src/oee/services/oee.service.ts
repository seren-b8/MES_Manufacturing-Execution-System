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
import { machine } from 'os';

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

  // private getCurrentShiftInfo(currentTime: moment.Moment, config: ShiftConfig) {
  //   const hour = currentTime.hour();
  //   let shiftType: 'day' | 'night';
  //   let shiftStart: moment.Moment;
  //   let nextShiftStart: moment.Moment;

  //   // กะกลางวัน: 08:00 - 20:00
  //   if (hour >= config.day.start && hour < config.day.end) {
  //     shiftType = 'day';
  //     shiftStart = currentTime
  //       .clone()
  //       .startOf('day')
  //       .add(config.day.start, 'hours');
  //     nextShiftStart = currentTime
  //       .clone()
  //       .startOf('day')
  //       .add(config.day.end, 'hours');
  //   }
  //   // กะกลางคืน: 20:00 - 08:00
  //   else {
  //     shiftType = 'night';
  //     if (hour >= config.night.start) {
  //       // เวลา 20:00-23:59 (วันเดียวกัน)
  //       shiftStart = currentTime
  //         .clone()
  //         .startOf('day')
  //         .add(config.night.start, 'hours');
  //       nextShiftStart = currentTime
  //         .clone()
  //         .add(1, 'day')
  //         .startOf('day')
  //         .add(config.day.start, 'hours');
  //     } else {
  //       // เวลา 00:00-07:59 (วันถัดไป)
  //       shiftStart = currentTime
  //         .clone()
  //         .subtract(1, 'day')
  //         .startOf('day')
  //         .add(config.night.start, 'hours');
  //       nextShiftStart = currentTime
  //         .clone()
  //         .startOf('day')
  //         .add(config.day.start, 'hours');
  //     }
  //   }

  //   return {
  //     shift_type: shiftType,
  //     shift_start: shiftStart,
  //     next_shift_start: nextShiftStart,
  //   };
  // }

  private getCurrentShiftInfo(currentTime: moment.Moment, config: ShiftConfig) {
    const hour = currentTime.hour();
    let shiftType: 'day' | 'night';
    let shiftStart: moment.Moment;
    let nextShiftStart: moment.Moment;

    if (hour >= config.day.start && hour <= config.day.end) {
      shiftType = 'day';
      shiftStart = currentTime
        .clone()
        .startOf('day')
        .add(config.day.start, 'hours');

      // ถ้าเป็นเวลา 20:xx น. ต้องดูว่าช่วงเวลาต่อไปคือวันถัดไปหรือไม่
      if (hour === config.day.end && currentTime.minute() > 0) {
        const dayShiftStart = currentTime
          .clone()
          .startOf('day')
          .add(config.day.start, 'hours'); // 08:00
        const nightShiftStartToday = currentTime
          .clone()
          .startOf('day')
          .add(config.day.end, 'hours'); // 20:00 today
        const nightShiftStartYesterday = currentTime
          .clone()
          .subtract(1, 'day')
          .startOf('day')
          .add(config.day.end, 'hours'); // 20:00 yesterday
        const dayShiftStartTomorrow = currentTime
          .clone()
          .add(1, 'day')
          .startOf('day')
          .add(config.day.start, 'hours'); // 08:00 tomorrow

        if (
          currentTime.isSameOrAfter(dayShiftStart) &&
          currentTime.isSameOrBefore(nightShiftStartToday)
        ) {
          shiftType = 'day';
          shiftStart = dayShiftStart;
          nextShiftStart = dayShiftStartTomorrow.subtract(12, 'hours'); // 20:00 today
        }
        // Check for Night shift 1 (20:00:01 to 23:59:59)
        else if (
          currentTime.isAfter(nightShiftStartToday) &&
          hour >= config.night.start
        ) {
          shiftType = 'night';
          shiftStart = nightShiftStartToday;
          nextShiftStart = dayShiftStartTomorrow; // 08:00 tomorrow
        }
        // Check for Night shift 2 (00:00:00 to 08:00:00 inclusive)
        else if (
          currentTime.isSameOrBefore(dayShiftStart) &&
          hour < config.day.start
        ) {
          shiftType = 'night';
          shiftStart = nightShiftStartYesterday; // 20:00 yesterday
          nextShiftStart = dayShiftStart; // 08:00 today
        }

        const isDayShift =
          (hour > config.day.start && hour < config.day.end) ||
          (hour === config.day.start && currentTime.minute() >= 0) || // Always true at 8:xx
          (hour === config.day.end && currentTime.minute() === 0); // 20:00 เป๊ะ

        if (isDayShift) {
          shiftType = 'day';
          shiftStart = currentTime
            .clone()
            .startOf('day')
            .add(config.day.start, 'hours');
          nextShiftStart = currentTime
            .clone()
            .startOf('day')
            .add(config.day.end, 'hours'); // 20:00 today
        }
        // กะกลางคืน: 20:01 - 08:00 (รวม 08:00)
        else {
          // Logic for 20:01 until 08:00:00
          shiftType = 'night';

          // If the current time is 20:01 or later today (20:01 - 23:59)
          if (
            hour >= config.night.start ||
            (hour === config.day.end && currentTime.minute() > 0)
          ) {
            shiftStart = currentTime
              .clone()
              .startOf('day')
              .add(config.night.start, 'hours'); // 20:00 today
            nextShiftStart = currentTime
              .clone()
              .add(1, 'day')
              .startOf('day')
              .add(config.day.start, 'hours'); // 08:00 tomorrow
          }
          // If the current time is 00:00 - 08:00:00
          else {
            shiftStart = currentTime
              .clone()
              .subtract(1, 'day')
              .startOf('day')
              .add(config.night.start, 'hours'); // 20:00 yesterday
            nextShiftStart = currentTime
              .clone()
              .startOf('day')
              .add(config.day.start, 'hours'); // 08:00 today
          }
        }
      }

      const dayShiftStart = currentTime
        .clone()
        .startOf('day')
        .add(config.day.start, 'hours'); // 08:00 today
      const nightShiftStartToday = currentTime
        .clone()
        .startOf('day')
        .add(config.day.end, 'hours'); // 20:00 today

      // Case 1: Day Shift (08:00:00 today up to and including 20:00:00 today)
      if (
        currentTime.isSameOrAfter(dayShiftStart) &&
        currentTime.isSameOrBefore(nightShiftStartToday)
      ) {
        shiftType = 'day';
        shiftStart = dayShiftStart;
        nextShiftStart = nightShiftStartToday.clone().add(1, 'second'); // Start of Night shift (20:00:01 today)

        nextShiftStart = currentTime
          .clone()
          .add(1, 'day')
          .startOf('day')
          .add(config.day.start, 'hours'); // 08:00 tomorrow
      }
      // Case 2: Night Shift - part 1 (20:00:01 today up to 23:59:59 today)
      else if (currentTime.isAfter(nightShiftStartToday)) {
        shiftType = 'night';
        shiftStart = nightShiftStartToday; // 20:00 today
        nextShiftStart = currentTime
          .clone()
          .add(1, 'day')
          .startOf('day')
          .add(config.day.start, 'hours'); // 08:00 tomorrow
      }
      // Case 3: Night Shift - part 2 (00:00:00 today up to and including 08:00:00 today)
      else {
        shiftType = 'night';
        shiftStart = currentTime
          .clone()
          .subtract(1, 'day')
          .startOf('day')
          .add(config.night.start, 'hours'); // 20:00 yesterday
        nextShiftStart = dayShiftStart; // 08:00 today
      }

      return {
        shift_type: shiftType,
        shift_start: shiftStart,
        next_shift_start: nextShiftStart,
      };
    }
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
