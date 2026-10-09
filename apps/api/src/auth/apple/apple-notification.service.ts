import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../../database/schemas/user.schema";
import { AccountService } from "../account.service";
import { IdTokenVerifier } from "../id-token-verifier";
import { SessionService } from "../session.service";
import { AppleCredentials } from "./apple-credentials";
import {
  parseAppleNotificationEvent,
  requiresAccountDeletion,
} from "./apple-notifications";

/**
 * Apple server-to-server notifications. `consent-revoked` / `account-delete`:
 * if Apple was the account's only way in, delete the account; if it also has
 * Google, just detach Apple and end its sessions. Apple has already revoked
 * its tokens, so we don't call Apple.
 */
@Injectable()
export class AppleNotificationService {
  constructor(
    private readonly idTokens: IdTokenVerifier,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly accounts: AccountService,
    private readonly sessions: SessionService,
    private readonly appleCredentials: AppleCredentials
  ) {}

  async handle(signedPayload: string): Promise<void> {
    const event = parseAppleNotificationEvent(
      await this.idTokens.verifyAppleNotification(signedPayload)
    );
    if (!requiresAccountDeletion(event)) {
      return;
    }
    const user = await this.users.findOne({ apple_sub: event.sub }).exec();
    if (!user) {
      return;
    }
    if (!user.google_sub) {
      await this.accounts.delete(user._id, { revokeApple: false });
      return;
    }
    this.appleCredentials.detach(user);
    await user.save();
    await this.sessions.revokeAll(user._id);
  }
}
