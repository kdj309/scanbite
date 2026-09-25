import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type {
  AuthTokenResponse,
  LoginRequest,
  MeResponse,
  SignupRequest,
  VerifyOtpRequest,
} from "@foodscanner/shared";
import { compare, hash } from "bcryptjs";
import { randomInt } from "node:crypto";
import { Connection, Model, Types } from "mongoose";
import type { Env } from "../config/env";
import {
  HouseholdMember,
  HouseholdMemberDocument,
} from "../database/schemas/household-member.schema";
import {
  User,
  UserDocument,
  type AuthProvider,
  type UserRole,
} from "../database/schemas/user.schema";
import { serializeHouseholdMember } from "../household/serialize-member";
import type { JwtPayload } from "./auth.types";
import { serializeUser } from "./serialize-user";

const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(HouseholdMember.name)
    private readonly members: Model<HouseholdMemberDocument>,
  ) {}

  signAccessToken(user: { id: string; role: UserRole }): Promise<string> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return this.jwt.signAsync(payload);
  }

  async signup(body: SignupRequest): Promise<AuthTokenResponse> {
    await this.assertUniqueIdentity(body.email, body.phone);
    const authProvider: AuthProvider = body.password ? "password" : "otp";
    const passwordHash = body.password
      ? await hash(body.password, 10)
      : undefined;
    const otp = authProvider === "otp" ? this.generateOtp() : undefined;
    const role = this.resolveSignupRole(body.email);

    const user = await this.createUserWithSelfMember({
      email: body.email,
      phone: body.phone,
      auth_provider: authProvider,
      password_hash: passwordHash,
      otp_code: otp,
      otp_expires_at: otp ? new Date(Date.now() + OTP_TTL_MS) : undefined,
      role,
    });

    if (otp && body.phone) {
      this.logOtp(body.phone, otp);
    }

    return this.tokenResponse(user);
  }

  async verifyOtp(body: VerifyOtpRequest): Promise<AuthTokenResponse> {
    const user = await this.users.findOne({ phone: body.phone }).exec();
    this.assertValidOtp(user, body.otp);
    user!.otp_code = undefined;
    user!.otp_expires_at = undefined;
    await user!.save();
    return this.tokenResponse(user!);
  }

  async login(body: LoginRequest): Promise<AuthTokenResponse> {
    const user = body.email
      ? await this.users.findOne({ email: body.email.toLowerCase() }).exec()
      : await this.users.findOne({ phone: body.phone }).exec();
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (body.password) {
      if (!user.password_hash) {
        throw new UnauthorizedException("Invalid credentials");
      }
      const ok = await compare(body.password, user.password_hash);
      if (!ok) {
        throw new UnauthorizedException("Invalid credentials");
      }
      return this.tokenResponse(user);
    }

    if (body.otp) {
      const expired =
        !user.otp_expires_at || user.otp_expires_at.getTime() < Date.now();
      if (!user.otp_code || expired) {
        const otp = this.generateOtp();
        user.otp_code = otp;
        user.otp_expires_at = new Date(Date.now() + OTP_TTL_MS);
        await user.save();
        if (user.phone) {
          this.logOtp(user.phone, otp);
        }
        throw new UnauthorizedException("OTP sent");
      }
      this.assertValidOtp(user, body.otp);
      user.otp_code = undefined;
      user.otp_expires_at = undefined;
      await user.save();
      return this.tokenResponse(user);
    }

    throw new UnauthorizedException("Invalid credentials");
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.users.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException();
    }
    const members = await this.members
      .find({ owner_user_id: user._id })
      .sort({ created_at: 1 })
      .exec();
    return {
      user: serializeUser(user),
      household_members: members.map(serializeHouseholdMember),
    };
  }

  private async tokenResponse(user: UserDocument): Promise<AuthTokenResponse> {
    const access_token = await this.signAccessToken({
      id: user.id as string,
      role: user.role,
    });
    return {
      access_token,
      token_type: "Bearer",
      user: serializeUser(user),
    };
  }

  private resolveSignupRole(email?: string): UserRole {
    const adminEmail = this.config.get("ADMIN_EMAIL", { infer: true });
    if (email && adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
      return "admin";
    }
    return "user";
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private logOtp(phone: string, otp: string): void {
    const env = this.config.get("NODE_ENV", { infer: true });
    if (env !== "production") {
      this.logger.log(`OTP for ${phone}: ${otp}`);
    }
  }

  private assertValidOtp(user: UserDocument | null, otp: string): void {
    if (
      !user ||
      !user.otp_code ||
      !user.otp_expires_at ||
      user.otp_expires_at.getTime() < Date.now() ||
      user.otp_code !== otp
    ) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }
  }

  private async assertUniqueIdentity(
    email?: string,
    phone?: string,
  ): Promise<void> {
    if (email) {
      const existing = await this.users.findOne({ email: email.toLowerCase() }).exec();
      if (existing) {
        throw new ConflictException("Email already registered");
      }
    }
    if (phone) {
      const existing = await this.users.findOne({ phone }).exec();
      if (existing) {
        throw new ConflictException("Phone already registered");
      }
    }
  }

  private async createUserWithSelfMember(fields: {
    email?: string;
    phone?: string;
    auth_provider: AuthProvider;
    password_hash?: string;
    otp_code?: string;
    otp_expires_at?: Date;
    role: UserRole;
  }): Promise<UserDocument> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const user = await this.insertUserAndSelf(fields, session);
      await session.commitTransaction();
      return user;
    } catch (error) {
      await session.abortTransaction().catch(() => undefined);
      if (isTransactionUnsupported(error)) {
        return this.insertUserAndSelf(fields);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async insertUserAndSelf(
    fields: {
      email?: string;
      phone?: string;
      auth_provider: AuthProvider;
      password_hash?: string;
      otp_code?: string;
      otp_expires_at?: Date;
      role: UserRole;
    },
    session?: import("mongoose").ClientSession,
  ): Promise<UserDocument> {
    const opts = session ? { session } : {};
    const [user] = await this.users.create(
      [
        {
          email: fields.email?.toLowerCase(),
          phone: fields.phone,
          auth_provider: fields.auth_provider,
          password_hash: fields.password_hash,
          otp_code: fields.otp_code,
          otp_expires_at: fields.otp_expires_at,
          role: fields.role,
        },
      ],
      opts,
    );
    const [member] = await this.members.create(
      [
        {
          owner_user_id: user._id,
          name: "Self",
          relationship: "self",
          conditions: [],
          allergies: [],
        },
      ],
      opts,
    );
    user.default_member_id = member._id as Types.ObjectId;
    await user.save(opts);
    return user;
  }
}

function isTransactionUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Transaction numbers are only allowed") ||
    message.includes("replica set")
  );
}
