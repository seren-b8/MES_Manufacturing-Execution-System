import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QualityService } from './quality.service';
import { AvailabilityService } from './availability.service';
import { PerformanceService } from './performance.service';
import { OEEHourly } from 'src/schema/oee-hourly.schema';
// import { OEEDaily } from '../schemas/oee-daily.schema';
import { TimeFrame } from 'src/shared/interface/oee';
import { OEEResponseDto } from '../dto/timeframe.dto';
import { ResponseFormat } from 'src/shared/interface';

@Injectable()
export class OEEService {
  constructor(
    @InjectModel(OEEHourly.name) private oeeHourlyModel: Model<OEEHourly>,
    // @InjectModel(OEEDaily.name) private oeeDailyModel: Model<OEEDaily>,
    private qualityService: QualityService,
    private availabilityService: AvailabilityService,
    private performanceService: PerformanceService,
  ) {}

  async calculateRealTimeOEE(
    machineNumber: string,
  ): Promise<ResponseFormat<OEEResponseDto>> {
    try {
      // TODO: Get current shift timeframe
      // TODO: Calculate OEE using individual services
      // TODO: Return formatted response

      return {
        status: 'success',
        message: 'Real-time OEE calculated successfully',
        data: [],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to calculate real-time OEE',
        data: [],
      };
    }
  }

  async calculateOEE(
    machineNumber: string,
    timeframe: TimeFrame,
  ): Promise<ResponseFormat<OEEResponseDto>> {
    try {
      // TODO: Calculate using parallel processing
      const [quality, availability, performance] = await Promise.all([
        this.qualityService.calculate(machineNumber, timeframe),
        this.availabilityService.calculate(machineNumber, timeframe),
        this.performanceService.calculate(machineNumber, timeframe),
      ]);

      // TODO: Calculate final OEE
      // TODO: Return formatted response

      return {
        status: 'success',
        message: 'OEE calculated successfully',
        data: [],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to calculate OEE',
        data: [],
      };
    }
  }

  async getHourlyOEE(
    machineNumber: string,
    date: Date,
  ): Promise<ResponseFormat<OEEHourly>> {
    try {
      // TODO: Query hourly OEE data
      return {
        status: 'success',
        message: 'Hourly OEE retrieved successfully',
        data: [],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to retrieve hourly OEE',
        data: [],
      };
    }
  }

  //   async getDailyOEE(
  //     machineNumber: string,
  //     date: Date,
  //   ): Promise<ResponseFormat<OEEDaily>> {
  //     try {
  //       // TODO: Query daily OEE data
  //       return {
  //         status: 'success',
  //         message: 'Daily OEE retrieved successfully',
  //         data: [],
  //       };
  //     } catch (error) {
  //       return {
  //         status: 'error',
  //         message: 'Failed to retrieve daily OEE',
  //         data: [],
  //       };
  //     }
  //   }

  async saveHourlyOEE(): Promise<void> {
    // TODO: Scheduled job to save hourly OEE
  }

  async saveDailyOEE(): Promise<void> {
    // TODO: Scheduled job to save daily OEE
  }

  private getCurrentShiftTimeframe(machineNumber: string): TimeFrame {
    // TODO: Calculate current shift timeframe using moment-timezone
    return {
      machine_number: machineNumber,
      start_time: new Date(),
      end_time: new Date(),
      shift_type: 'day',
    };
  }
}
