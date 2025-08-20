import { Injectable } from '@nestjs/common';
import { TimeFrame } from 'src/shared/interface/oee';

@Injectable()
export class QualityService {
  async calculate(
    machineNumber: string,
    timeframe: TimeFrame,
  ): Promise<number> {
    // TODO: Implement quality calculation logic
    return 0;
  }
}
