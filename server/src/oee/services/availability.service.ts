import { Injectable } from '@nestjs/common';
import { TimeFrame } from 'src/shared/interface/oee';

@Injectable()
export class AvailabilityService {
  async calculate(
    machineNumber: string,
    timeframe: TimeFrame,
  ): Promise<number> {
    // TODO: Implement availability calculation logic
    return 0;
  }
}
