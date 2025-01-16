import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SECRET_KEY'), // เปลี่ยนจาก 'jwt.secret' เป็น 'JWT_SECRET'
    });
  }

  async validate(payload: any) {
    return {
      employee_id: payload.employee_id,
      role: payload.role, // Important: Include the role
    };
  }
}
