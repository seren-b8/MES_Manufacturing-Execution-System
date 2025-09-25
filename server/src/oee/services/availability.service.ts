import { Injectable } from '@nestjs/common';
import { MachineInfoService } from 'src/machine/machine-info/machine-info.service';
import { TimeFrame } from 'src/shared/interface/oee';

@Injectable()
export class AvailabilityService {
  constructor(private readonly machineInfoService: MachineInfoService) {}

  async getAvailabilityArray(timeframe: TimeFrame): Promise<any[]> {
    const mapResult = await this.calculate(timeframe);
    return this.processAvailabilityData(mapResult);
  }

  async calculate(timeframe: TimeFrame): Promise<Map<string, number>> {
    try {
      // รับผลลัพธ์จาก service
      const statusResponse =
        await this.machineInfoService.getMachineStatusByPeriod(
          timeframe.start_time,
          timeframe.end_time,
          60,
          timeframe.machine_numbers,
        );

      // แก้ไข: เข้าถึง data field ของ ResponseFormat
      const machineData = Array.isArray(statusResponse)
        ? statusResponse
        : statusResponse?.data || [];

      const results = new Map<string, number>();

      // ตรวจสอบว่าเป็น array ก่อน forEach
      if (Array.isArray(machineData)) {
        machineData.forEach((machine: any) => {
          const availability = this.calculateMachineAvailability(machine);
          results.set(machine.machine_number, availability);
        });
      }

      return results;
    } catch (error) {
      console.error('Error calculating availability:', error);

      // Fallback: return 0 for all machines
      const fallbackResults = new Map<string, number>();
      (timeframe.machine_numbers || []).forEach((machine) => {
        fallbackResults.set(machine, 0);
      });
      return fallbackResults;
    }
  }

  private calculateMachineAvailability(machineData: any): number {
    if (!machineData.intervals || machineData.intervals.length === 0) {
      console.log('No intervals data');
      return 0;
    }

    let totalOnTime = 0;
    let totalTime = 0;

    machineData.intervals.forEach((interval: any, index: number) => {
      const onTime = interval.ON || 0;
      const offTime = interval.OFF || 0;
      const alarmTime = interval.ALARM || 0;

      totalOnTime += onTime;
      totalTime += onTime + offTime + alarmTime;
    });

    const availability = totalTime > 0 ? (totalOnTime / totalTime) * 100 : 0;

    return Math.round(availability * 100) / 100;
  }

  // Single machine version
  async calculateSingle(
    machineNumber: string,
    timeframe: TimeFrame,
  ): Promise<number> {
    const modifiedTimeframe = {
      ...timeframe,
      machine_numbers: [machineNumber],
    };

    const results = await this.calculate(modifiedTimeframe);
    return results.get(machineNumber) || 0;
  }

  // Get detailed breakdown
  async getAvailabilityDetails(timeframe: TimeFrame): Promise<any> {
    try {
      const statusResponse =
        await this.machineInfoService.getMachineStatusByPeriod(
          timeframe.start_time,
          timeframe.end_time,
          60,
          timeframe.machine_numbers.length < 1
            ? null
            : timeframe.machine_numbers,
        );

      // แก้ไข: เข้าถึง data field
      const machineData = Array.isArray(statusResponse)
        ? statusResponse
        : statusResponse?.data || [];

      const results = [];

      // ตรวจสอบว่าเป็น array ก่อน forEach
      if (Array.isArray(machineData)) {
        machineData.forEach((machine: any) => {
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

          results.push({
            machineNumber: machine.machine_number,
            availability: Math.round(availability * 100) / 100,
            totalOnTime,
            totalOffTime,
            totalAlarmTime,
            totalTime,
            intervals: machine.intervals || [],
          });
        });
      }

      return results;
    } catch (error) {
      console.error('Error getting availability details:', error);
      return [];
    }
  }

  private processAvailabilityData(availabilityMap: Map<string, number>): any[] {
    return Array.from(availabilityMap.entries()).map(
      ([machineNumber, availability]) => ({
        machineNumber,
        availability: Math.round(availability * 100) / 100, // ปรับทศนิยม 2 ตำแหน่ง
      }),
    );
  }

  private calculateFactoryAvailability(availabilityArray: any[]): any {
    // ต้องดึงข้อมูล detailed breakdown เพื่อคำนวณ factory total
    const factoryTotals = availabilityArray.reduce(
      (acc, machine) => {
        // หาก availabilityArray มีเฉพาะ availability % ต้องใช้ getAvailabilityDetails แทน
        acc.totalOnTime += machine.totalOnTime || 0;
        acc.totalOffTime += machine.totalOffTime || 0;
        acc.totalAlarmTime += machine.totalAlarmTime || 0;
        acc.activeMachines += 1;
        return acc;
      },
      {
        totalOnTime: 0,
        totalOffTime: 0,
        totalAlarmTime: 0,
        activeMachines: 0,
      },
    );

    const totalTime =
      factoryTotals.totalOnTime +
      factoryTotals.totalOffTime +
      factoryTotals.totalAlarmTime;

    // คำนวณ Factory Availability จากเวลารวม
    const factoryAvailability =
      totalTime > 0
        ? Math.round((factoryTotals.totalOnTime / totalTime) * 100 * 100) / 100
        : 0;

    return {
      machineNumber: 'ALL',
      availability: factoryAvailability,
      totalOnTime: factoryTotals.totalOnTime,
      totalOffTime: factoryTotals.totalOffTime,
      totalAlarmTime: factoryTotals.totalAlarmTime,
      totalTime: totalTime,
      activeMachines: factoryTotals.activeMachines,
    };
  }
}
