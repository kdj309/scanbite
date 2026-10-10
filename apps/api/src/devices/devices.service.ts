import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { RegisterDeviceRequest } from "@foodscanner/shared";
import { Model, Types } from "mongoose";
import { Device, DeviceDocument } from "../database/schemas/device.schema";

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name) private readonly devices: Model<DeviceDocument>
  ) {}

  /**
   * Called on every app open: tokens may change, and a phone that signs
   * into a different account moves its token there.
   */
  async register(userId: string, body: RegisterDeviceRequest): Promise<void> {
    await this.devices
      .updateOne(
        { expo_push_token: body.expo_push_token },
        {
          $set: {
            user_id: new Types.ObjectId(userId),
            platform: body.platform,
          },
        },
        { upsert: true }
      )
      .exec();
  }

  /** Logout: only the caller's own device. */
  async unregister(userId: string, token: string): Promise<void> {
    await this.devices
      .deleteOne({
        expo_push_token: token,
        user_id: new Types.ObjectId(userId),
      })
      .exec();
  }

  async tokensFor(userId: string): Promise<string[]> {
    const devices = await this.devices
      .find({ user_id: new Types.ObjectId(userId) }, { expo_push_token: 1 })
      .lean()
      .exec();
    return devices.map((device) => device.expo_push_token);
  }

  /** Tokens Expo says no longer reach a phone (app uninstalled). */
  async forget(tokens: string[]): Promise<void> {
    if (tokens.length) {
      await this.devices
        .deleteMany({ expo_push_token: { $in: tokens } })
        .exec();
    }
  }
}
