// src/types/mongo.types.ts
import { Types } from 'mongoose';

export type WithId<T> = T & { _id: Types.ObjectId };
export type IdType = Types.ObjectId | string;

export function ensureObjectId(id: IdType): Types.ObjectId {
  return typeof id === 'string' ? new Types.ObjectId(id) : id;
}
