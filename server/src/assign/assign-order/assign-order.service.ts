import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateAssignOrderDto } from '../dto/update-assign-order-dto';
import { CreateAssignOrderDto } from '../dto/create-assign-order.dto';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ResponseFormat } from 'src/interface';

@Injectable()
export class AssignOrderService {
  constructor(
    @InjectModel(AssignOrder.name) private assignOrderModel: Model<AssignOrder>,
  ) {}
}
