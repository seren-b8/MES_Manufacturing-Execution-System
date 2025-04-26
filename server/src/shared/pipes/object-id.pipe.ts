// src/pipes/object-id.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ObjectIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    try {
      if (!Types.ObjectId.isValid(value)) {
        throw new BadRequestException(
          `${value} is not a valid MongoDB ObjectId`,
        );
      }
      return new Types.ObjectId(value);
    } catch (error) {
      throw new BadRequestException(`Failed to convert ${value} to ObjectId`);
    }
  }
}
