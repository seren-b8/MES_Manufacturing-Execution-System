import { Test, TestingModule } from '@nestjs/testing';
import { AssignOrderController } from './assign-order.controller';

describe('AssignOrderController', () => {
  let controller: AssignOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignOrderController],
    }).compile();

    controller = module.get<AssignOrderController>(AssignOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
