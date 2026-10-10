import { Body, Controller, Delete, HttpCode, Param, Put } from "@nestjs/common";
import {
  expoPushTokenSchema,
  registerDeviceRequestSchema,
  type RegisterDeviceRequest,
} from "@foodscanner/shared";
import type { RequestUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { DevicesService } from "./devices.service";

@Controller("devices")
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** Idempotent — the app calls it on every open. */
  @Put()
  @HttpCode(204)
  async register(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(registerDeviceRequestSchema))
    body: RegisterDeviceRequest
  ): Promise<void> {
    await this.devices.register(user.userId, body);
  }

  /** On logout. The token goes URL-encoded in the path. */
  @Delete(":token")
  @HttpCode(204)
  async unregister(
    @CurrentUser() user: RequestUser,
    @Param("token", new ZodValidationPipe(expoPushTokenSchema)) token: string
  ): Promise<void> {
    await this.devices.unregister(user.userId, token);
  }
}
