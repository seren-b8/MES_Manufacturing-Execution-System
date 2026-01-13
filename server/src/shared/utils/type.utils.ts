import mongoose, { isValidObjectId } from 'mongoose';

export function toObjectId(
  id: string | mongoose.Types.ObjectId,
): mongoose.Types.ObjectId {
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }

  if (isValidObjectId(id)) {
    return new mongoose.Types.ObjectId(id);
  }

  throw new Error(`Invalid ObjectId: ${id}`);
}
