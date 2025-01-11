import { Test, TestingModule } from '@nestjs/testing';
import { ProductionOrderController } from './production-order.controller';

describe('ProductionOrderController', () => {
  let controller: ProductionOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductionOrderController],
    }).compile();

    controller = module.get<ProductionOrderController>(ProductionOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
