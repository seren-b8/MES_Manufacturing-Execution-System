import { Test, TestingModule } from '@nestjs/testing';
import { MachineCavityController } from './machine-cavity.controller';

describe('MachineCavityController', () => {
  let controller: MachineCavityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MachineCavityController],
    }).compile();

    controller = module.get<MachineCavityController>(MachineCavityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
