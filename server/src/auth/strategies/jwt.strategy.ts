import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schema/user.schema';

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

    console.log('JwtStrategy initialized:', {
      hasSecret: !!secret,
      secretLength: secret.length,
    });

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'], // ต้องตรงกับที่ตั้งไว้ใน JwtModule
    });
  }

  async validate(payload: any) {
    try {
      const user = await this.userModel.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.role === 'block') {
        throw new UnauthorizedException('User is blocked');
      }

      return {
        sub: payload.sub,
        employee_id: payload.employee_id,
        role: payload.role,
      };
    } catch (error) {
      throw new UnauthorizedException();
    }
  }
}
