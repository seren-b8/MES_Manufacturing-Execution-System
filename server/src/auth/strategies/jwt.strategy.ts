import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schema/user.schema';
import { JwtPayload } from '../../shared/interface/auth';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    const secret = configService.get<string>('SECRET_KEY');

    // ตรวจสอบ secret
    if (!secret) {
      throw new Error('JWT SECRET_KEY is not defined in strategy');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'], // ต้องตรงกับที่ตั้งไว้ใน JwtModule
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    try {
      // ตรวจสอบว่า payload มีข้อมูลครบไหม
      if (!payload.sub || !payload.employee_id || !payload.role) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // ค้นหา user จาก MongoDB
      const user = await this.userModel
        .findById(payload.sub)
        .select('role status')
        .lean();

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // ตรวจสอบสถานะ user
      if (user.role === 'block') {
        throw new UnauthorizedException('User is blocked');
      }

      // ตรวจสอบว่า role ใน token ตรงกับใน database
      if (user.role !== payload.role) {
        throw new UnauthorizedException('Invalid user role');
      }

      return {
        sub: payload.sub,
        employee_id: payload.employee_id,
        role: payload.role,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}
