import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { AuthTokenResponse, MeResponse } from "@foodscanner/shared";
import type { ClientSession } from "mongoose";
import { Connection, Model, Types } from "mongoose";
import { ObjectStorageService } from "../common/object-storage.service";
import { withTransactionFallback } from "../common/with-transaction";
import {
  HouseholdMember,
  HouseholdMemberDocument,
} from "../database/schemas/household-member.schema";
import { Scan, ScanDocument } from "../database/schemas/scan.schema";
import {
  Submission,
  SubmissionDocument,
} from "../database/schemas/submission.schema";
import {
  User,
  UserDocument,
  type UserRole,
} from "../database/schemas/user.schema";
import { HouseholdService } from "../household/household.service";
import { AppleCredentials } from "./apple/apple-credentials";
import { serializeUser } from "./serialize-user";
import { SessionService } from "./session.service";

export type NewAccountFields = {
  google_sub?: string;
  apple_sub?: string;
  role: UserRole;
};

/** Account lifecycle: creation (with its Self member), lookup, deletion. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    // Write path only (the transactional Self-member insert needs the raw
    // model) — reads go through HouseholdService.
    @InjectModel(HouseholdMember.name)
    private readonly members: Model<HouseholdMemberDocument>,
    @InjectModel(Scan.name) private readonly scans: Model<ScanDocument>,
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>,
    private readonly household: HouseholdService,
    private readonly storage: ObjectStorageService,
    private readonly sessions: SessionService,
    private readonly appleCredentials: AppleCredentials
  ) {}

  /** First app open: an account with no identity, so scanning and family setup work immediately. */
  async createAnonymous(): Promise<AuthTokenResponse> {
    return this.sessions.issue(await this.create({ role: "user" }));
  }

  /** Every new account gets its default "Self" household member, atomically. */
  create(fields: NewAccountFields): Promise<UserDocument> {
    return withTransactionFallback(this.connection, (session) =>
      this.insertWithSelf(fields, session)
    );
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.users.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException();
    }
    const { members } = await this.household.listForUser(userId);
    return { user: serializeUser(user), household_members: members };
  }

  /**
   * Deletes the account and everything tied to it: Apple token (revoked at
   * Apple first), submissions and their label photos, scans, sessions,
   * household, then the user. App Store 5.1.1(v) and Google Play's
   * account-deletion policy require this.
   */
  async delete(
    userId: string | Types.ObjectId,
    options: { revokeApple?: boolean } = {}
  ): Promise<void> {
    const user = await this.users.findById(userId).exec();
    if (!user) {
      return;
    }
    if (options.revokeApple !== false) {
      await this.appleCredentials.revoke(user);
    }
    await this.deleteLabelPhotos(user._id);
    await this.submissions.deleteMany({ user_id: user._id }).exec();
    await this.scans.deleteMany({ user_id: user._id }).exec();
    await this.sessions.deleteAll(user._id);
    await this.members.deleteMany({ owner_user_id: user._id }).exec();
    await this.users.deleteOne({ _id: user._id }).exec();
  }

  /**
   * After a reinstall the app first gets a fresh anonymous account, then the
   * user signs in and is switched to their real one. Delete the throwaway
   * only when nothing was saved on it — scans, uploaded label photos (real
   * contributions, possibly mid-extraction) or family data are kept.
   */
  async discardIfEmpty(user: UserDocument): Promise<void> {
    const [memberRows, scanCount, submissionCount] = await Promise.all([
      this.members.find({ owner_user_id: user._id }).lean().exec(),
      this.scans.countDocuments({ user_id: user._id }).exec(),
      this.submissions.countDocuments({ user_id: user._id }).exec(),
    ]);
    const onlyBlankSelf =
      memberRows.length <= 1 &&
      memberRows.every(
        (m) => m.conditions.length === 0 && m.allergies.length === 0
      );
    if (scanCount === 0 && submissionCount === 0 && onlyBlankSelf) {
      await this.delete(user._id, { revokeApple: false });
    }
  }

  /** Apple shares the name only once; use it for the Self member if unnamed. */
  async nameSelfIfUnnamed(
    user: UserDocument,
    givenName: string
  ): Promise<void> {
    const name = givenName.trim();
    if (!name || !user.default_member_id) {
      return;
    }
    await this.members
      .updateOne(
        { _id: user.default_member_id, name: "Self" },
        { $set: { name } }
      )
      .exec();
  }

  private async deleteLabelPhotos(userId: Types.ObjectId): Promise<void> {
    const owned = await this.submissions
      .find({ user_id: userId })
      .select({ photo_keys: 1 })
      .lean()
      .exec();
    await Promise.all(
      owned
        .flatMap((submission) => submission.photo_keys)
        .map((key) =>
          this.storage.deleteLabelPhoto(key).catch((error: unknown) => {
            this.logger.warn(
              `photo delete failed key=${key}: ${String(error)}`
            );
          })
        )
    );
  }

  private async insertWithSelf(
    fields: NewAccountFields,
    session?: ClientSession
  ): Promise<UserDocument> {
    const opts = session ? { session } : {};
    const [user] = await this.users.create([fields], opts);
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
      opts
    );
    user.default_member_id = member._id as Types.ObjectId;
    await user.save(opts);
    return user;
  }
}
