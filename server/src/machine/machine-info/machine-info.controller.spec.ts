import { Test, TestingModule } from '@nestjs/testing';
import { MachineInfoController } from './machine-info.controller';

describe('MachineInfoController', () => {
  let controller: MachineInfoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MachineInfoController],
    }).compile();

    controller = module.get<MachineInfoController>(MachineInfoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
