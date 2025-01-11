import { Test, TestingModule } from '@nestjs/testing';
import { AssignLogController } from './assign-log.controller';

describe('AssignLogController', () => {
  let controller: AssignLogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignLogController],
    }).compile();

    controller = module.get<AssignLogController>(AssignLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
