import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { PassportStrategy } from "@nestjs/passport";
import { Model } from "mongoose";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Env } from "../config/env";
import { User, UserDocument } from "../database/schemas/user.schema";
import type { JwtPayload, RequestUser } from "./auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_SECRET", { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.users.findById(payload.sub).exec();
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id as string,
      role: user.role,
      defaultMemberId: user.default_member_id
        ? String(user.default_member_id)
        : null,
    };
  }
}
