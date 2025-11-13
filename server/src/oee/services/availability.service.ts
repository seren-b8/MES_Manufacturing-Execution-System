import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import moment = require('moment-timezone');
import { Model } from 'mongoose';
import { MachineInfoService } from 'src/machine/machine-info/machine-info.service';
import { PlannedDowntime } from 'src/schema/planned-downtime.schema';
import { TimelineMachine } from 'src/schema/timeline-machine.schema';
import { TimeFrame } from 'src/shared/interface/oee';
import { number } from 'yargs';

export interface AvailabilityRecord {
  machineNumber: string;
  availability: number; // ปรับทศนิยม 2 ตำแหน่ง
  adjustedAvailability: number; // availability ที่ไม่นับ planned downtime
  totalOnTime: number; // หน่วยเป็นเวลา (วินาที/นาที)
  totalOffTime: number; // หน่วยเป็นเวลา (วินาที/นาที)
  totalAlarmTime: number; // หน่วยเป็นเวลา (วินาที/นาที)
  totalTime: number; // หน่วยเป็นเวลา (วินาที/นาที) - คือเวลาทั้งหมดที่พิจารณา
  plannedDowntime: number;
  downtimeBreakdown: DowntimeBreakdown; // เพิ่มส่วน downtime breakdown
  intervals: any; // รายละเอียดของช่วงเวลา
}

export interface DowntimeBreakdown {
  plannedDowntime: number;
  unplannedDowntime: number;
  totalDowntime: number;
  downtimeReasons: {
    maintenance: number;
    setup: number;
    break: number;
    alarm: number;
    material_change: number;
    cleaning: number;
    other: number;
  };
}
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly machineInfoService: MachineInfoService,
    @InjectModel(PlannedDowntime.name)
    private readonly plannedDowntimeModel: Model<PlannedDowntime>,
    @InjectModel(TimelineMachine.name)
    private readonly timelineMachineModel: Model<TimelineMachine>,
  ) {}

  async getAvailabilityDetails(
    timeframe: TimeFrame,
  ): Promise<AvailabilityRecord[]> {
    try {
      const machineNumbers =
        timeframe.machine_numbers.length < 1 ? null : timeframe.machine_numbers;

      const statusResponse =
        await this.machineInfoService.getMachineStatusByPeriod(
          timeframe.start_time,
          timeframe.end_time,
          60,
          machineNumbers,
        );

      const machineData = Array.isArray(statusResponse)
        ? statusResponse
        : statusResponse?.data || [];

      if (!Array.isArray(machineData) || machineData.length === 0) {
        return [];
      }

      const allMachineNumbers = machineData.map((m) => m.machine_number);

      const plannedDowntimeRecords = await this.plannedDowntimeModel
        .find({
          machine_number: { $in: allMachineNumbers }, // Query for all machines
          shift: timeframe.shift_type,
          date: {
            $gte: moment(timeframe.start_time)
              .tz('Asia/Bangkok')
              .startOf('day')
              .toDate(),
            $lte: moment(timeframe.end_time)
              .tz('Asia/Bangkok')
              .endOf('day')
              .toDate(),
          },
          status: 'active',
        })
        .exec();

      // Group planned downtime by machine number for quick access
      const plannedDowntimeMap = plannedDowntimeRecords.reduce(
        (acc, record) => {
          const machineNum = record.machine_number as string;
          if (!acc[machineNum]) {
            acc[machineNum] = [];
          }
          acc[machineNum].push(record);
          return acc;
        },
        {} as Record<string, any[]>,
      );
      const timelineRecords = await this.timelineMachineModel
        .find({
          machine_number: { $in: allMachineNumbers }, // Query for all machines
          createdAt: {
            $gte: timeframe.start_time,
            $lte: timeframe.end_time,
          },
        })
        .sort({ createdAt: 1 })
        .exec();

      // Group timeline records by machine number
      const timelineMap = timelineRecords.reduce(
        (acc, record) => {
          const machineNum = record.machine_number as string;
          if (!acc[machineNum]) {
            acc[machineNum] = [];
          }
          acc[machineNum].push(record);
          return acc;
        },
        {} as Record<string, any[]>,
      );
      const results: AvailabilityRecord[] = [];

      const machinePromises = machineData.map(async (machine: any) => {
        let totalOnTime = 0;
        let totalOffTime = 0;
        let totalAlarmTime = 0;

        machine.intervals?.forEach((interval: any) => {
          totalOnTime += interval.ON || 0;
          totalOffTime += interval.OFF || 0;
          totalAlarmTime += interval.ALARM || 0;
        });

        const totalTime = totalOnTime + totalOffTime + totalAlarmTime;
        const availability =
          totalTime > 0 ? (totalOnTime / totalTime) * 100 : 0;

        const machineNumber = machine.machine_number as string;

        const downtimeBreakdown = this.calculateDowntimeBreakdownLocal(
          machineNumber,
          timeframe,
          plannedDowntimeMap[machineNumber] || [],
          timelineMap[machineNumber] || [],
          this.getPlannedDowntime, // Pass the original getPlannedDowntime method
        );

        const adjustedAvailability = this.calculateAdjustedAvailability(
          totalOnTime,
          totalTime,
          downtimeBreakdown.plannedDowntime,
        );

        return {
          machineNumber,
          availability: Math.round(availability * 100) / 100,
          adjustedAvailability: Math.round(adjustedAvailability * 100) / 100,
          totalOnTime,
          totalOffTime,
          totalAlarmTime,
          totalTime,
          plannedDowntime: downtimeBreakdown.plannedDowntime,
          downtimeBreakdown,
          intervals: machine.intervals || [],
        };
      });

      // Wait for all machine calculations to complete
      const resolvedResults = await Promise.all(machinePromises);
      results.push(...resolvedResults);

      return results;
    } catch (error) {
      console.error('Error getting availability details:', error);
      return [];
    }
  }

  private calculateDowntimeBreakdownLocal(
    machineNumber: string,
    timeframe: TimeFrame,
    machinePlannedDowntimes: any[], // Grouped PlannedDowntime records for this machine
    machineTimelineRecords: any[], // Grouped Timeline records for this machine
    getPlannedDowntimeFn: (
      machineNumber: string,
      startTime: Date,
      endTime: Date,
      shift: string,
    ) => Promise<number>,
  ): DowntimeBreakdown {
    let totalPlannedDowntime = 0;
    for (const downtime of machinePlannedDowntimes) {
      const startMoment = moment(timeframe.start_time).tz('Asia/Bangkok');
      const endMoment = moment(timeframe.end_time).tz('Asia/Bangkok');
      const downtimeDate = moment(downtime.date).tz('Asia/Bangkok');

      let shiftStart: moment.Moment;
      let shiftEnd: moment.Moment;

      if (downtime.shift === 'day') {
        shiftStart = downtimeDate.clone().hour(8).minute(0).second(0);
        shiftEnd = downtimeDate.clone().hour(20).minute(0).second(0);
      } else if (downtime.shift === 'night') {
        shiftStart = downtimeDate.clone().hour(20).minute(0).second(0);
        shiftEnd = downtimeDate
          .clone()
          .add(1, 'day')
          .hour(8)
          .minute(0)
          .second(0);
      } else {
        // 'all' shift - full day
        shiftStart = downtimeDate.clone().hour(8).minute(0).second(0);
        shiftEnd = downtimeDate
          .clone()
          .add(1, 'day')
          .hour(8)
          .minute(0)
          .second(0);
      }

      // Check if shift overlaps with requested time range
      const overlapStart = moment.max(startMoment, shiftStart);
      const overlapEnd = moment.min(endMoment, shiftEnd);

      if (overlapStart.isBefore(overlapEnd)) {
        // Calculate overlap duration in minutes
        const overlapMinutes = overlapEnd.diff(overlapStart, 'minutes');

        // Use the minimum of planned downtime and actual overlap
        const applicableDowntime = Math.min(
          downtime.planned_downtime_minutes,
          overlapMinutes,
        );

        totalPlannedDowntime += applicableDowntime;
      }
    }
    const plannedDowntime = totalPlannedDowntime; // This is the total planned downtime

    // Initialize downtime reasons
    const downtimeReasons = {
      maintenance: 0,
      setup: 0,
      break: 0,
      alarm: 0,
      material_change: 0,
      cleaning: 0,
      other: 0,
    };

    // Sum planned downtime by type using the bulk-fetched data
    for (const downtime of machinePlannedDowntimes) {
      const downtimeType = downtime.downtime_type;

      if (downtimeReasons.hasOwnProperty(downtimeType)) {
        downtimeReasons[downtimeType as keyof typeof downtimeReasons] +=
          downtime.planned_downtime_minutes;
      } else {
        downtimeReasons.other += downtime.planned_downtime_minutes;
      }
    }

    // Calculate actual downtime from timeline using the bulk-fetched data
    let actualDowntime = 0;
    let alarmTime = 0;

    for (let i = 0; i < machineTimelineRecords.length - 1; i++) {
      const currentRecord = machineTimelineRecords[i];
      const nextRecord = machineTimelineRecords[i + 1];

      const duration = moment(nextRecord.createdAt).diff(
        moment(currentRecord.createdAt),
        'minutes',
      );

      if (currentRecord.status === 'OFF') {
        actualDowntime += duration;
      } else if (currentRecord.status === 'ALARM') {
        alarmTime += duration;
        actualDowntime += duration;
      }
    }

    // Add alarm time to downtime reasons
    downtimeReasons.alarm += alarmTime;

    // Calculate unplanned downtime
    const unplannedDowntime = Math.max(0, actualDowntime - plannedDowntime);
    const totalDowntime = actualDowntime;

    return {
      plannedDowntime,
      unplannedDowntime,
      totalDowntime,
      downtimeReasons,
    };
  }

  async getPlannedDowntime(
    machineNumber: string,
    startTime: Date,
    endTime: Date,
    shift: string,
  ): Promise<number> {
    try {
      const startMoment = moment(startTime).tz('Asia/Bangkok');
      const endMoment = moment(endTime).tz('Asia/Bangkok');

      const plannedDowntimes = await this.plannedDowntimeModel
        .find({
          machine_number: machineNumber,
          shift: shift,
          date: {
            $gte: startMoment.startOf('day').toDate(),
            $lte: endMoment.endOf('day').toDate(),
          },
          status: 'active',
        })
        .exec();

      let totalPlannedDowntime = 0;

      for (const downtime of plannedDowntimes) {
        const downtimeDate = moment(downtime.date).tz('Asia/Bangkok');

        let shiftStart: moment.Moment;
        let shiftEnd: moment.Moment;

        if (downtime.shift === 'day') {
          shiftStart = downtimeDate.clone().hour(8).minute(0).second(0);
          shiftEnd = downtimeDate.clone().hour(20).minute(0).second(0);
        } else if (downtime.shift === 'night') {
          shiftStart = downtimeDate.clone().hour(20).minute(0).second(0);
          shiftEnd = downtimeDate
            .clone()
            .add(1, 'day')
            .hour(8)
            .minute(0)
            .second(0);
        } else {
          // 'all' shift - full day
          shiftStart = downtimeDate.clone().hour(8).minute(0).second(0);
          shiftEnd = downtimeDate
            .clone()
            .add(1, 'day')
            .hour(8)
            .minute(0)
            .second(0);
        }

        // Check if shift overlaps with requested time range
        const overlapStart = moment.max(startMoment, shiftStart);
        const overlapEnd = moment.min(endMoment, shiftEnd);

        if (overlapStart.isBefore(overlapEnd)) {
          // Calculate overlap duration in minutes
          const overlapMinutes = overlapEnd.diff(overlapStart, 'minutes');

          // Use the minimum of planned downtime and actual overlap
          const applicableDowntime = Math.min(
            downtime.planned_downtime_minutes,
            overlapMinutes,
          );

          totalPlannedDowntime += applicableDowntime;
        }
      }

      return totalPlannedDowntime;
    } catch (error) {
      console.error('Error getting planned downtime:', error);
      return 0;
    }
  }

  private calculateAdjustedAvailability(
    totalOnTime: number,
    totalTime: number,
    plannedDowntime: number,
  ): number {
    // Convert planned downtime from minutes to same unit as totalTime
    // Assuming totalTime is in seconds, convert plannedDowntime to seconds
    const plannedDowntimeSeconds = plannedDowntime * 60;

    const adjustedTotalTime = totalTime - plannedDowntimeSeconds;

    if (adjustedTotalTime <= 0) {
      return 0;
    }

    const adjustedAvailability = (totalOnTime / adjustedTotalTime) * 100;

    // Ensure availability doesn't exceed 100%
    return Math.min(100, Math.round(adjustedAvailability * 100) / 100);
  }
}
