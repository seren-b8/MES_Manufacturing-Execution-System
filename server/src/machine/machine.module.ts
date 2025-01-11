import { Module } from '@nestjs/common';
import { MachineInfoController } from './machine-info/machine-info.controller';
import { MachineCavityController } from './machine-cavity/machine-cavity.controller';
import { MachineService } from './machine.service';

@Module({
  controllers: [MachineInfoController, MachineCavityController],
  providers: [MachineService]
})
export class MachineModule {}
