import { Test, TestingModule } from '@nestjs/testing';
import { SqlOrderController } from './sql-order.controller';

describe('SqlOrderController', () => {
  let controller: SqlOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SqlOrderController],
    }).compile();

    controller = module.get<SqlOrderController>(SqlOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
