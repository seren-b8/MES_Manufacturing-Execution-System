import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schema/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findAllUsers() {
    const users = await this.userModel.find();
    return { state: true, data: users };
  }

  async createUser(createUserDto: CreateUserDto) {
    const { EMP_ID, Password, Auth } = createUserDto;

    if (!EMP_ID || !Auth) {
      throw new BadRequestException('All input is required');
    }

    const existingUser = await this.userModel.findOne({ EMP_ID });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    let userData = { ...createUserDto };
    if (Password) {
      userData.Password = await bcrypt.hash(Password, 10);
    }

    const user = await this.userModel.create(userData);
    return { state: true, data: user };
  }

  async updateUser(id: string, updateData: Partial<CreateUserDto>) {
    const user = await this.userModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    return { state: true, data: user };
  }

  async deleteUser(id: string) {
    const result = await this.userModel.deleteOne({ _id: id });
    return { state: true, data: result };
  }
}
