import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  HEALTH_CONSENT_NOTICE_VERSION,
  MAX_HOUSEHOLD_MEMBERS,
  type CreateHouseholdMemberRequest,
  type UpdateHouseholdMemberRequest,
} from "@foodscanner/shared";
import { Model, Types } from "mongoose";
import {
  HouseholdMember,
  HouseholdMemberDocument,
} from "../database/schemas/household-member.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { isDuplicateKeyError } from "../common/mongo-errors";
import type { MemberFields } from "./household.types";
import { serializeHouseholdMember } from "./serialize-member";

@Injectable()
export class HouseholdService {
  constructor(
    @InjectModel(HouseholdMember.name)
    private readonly members: Model<HouseholdMemberDocument>,
    @InjectModel(User.name)
    private readonly users: Model<UserDocument>
  ) {}

  async listForUser(userId: string) {
    const docs = await this.members
      .find({ owner_user_id: new Types.ObjectId(userId) })
      .sort({ created_at: 1, _id: 1 })
      .exec();
    return { members: docs.map(serializeHouseholdMember) };
  }

  /**
   * With a client_id, saving the same person again (a retry after a lost
   * response, maybe with edits) updates the member already made instead of
   * adding a duplicate.
   */
  async createForUser(userId: string, body: CreateHouseholdMemberRequest) {
    const owner = new Types.ObjectId(userId);
    await this.requireConsentToAdd(owner, body);
    const fields: MemberFields = {
      name: body.name,
      relationship: body.relationship,
      age_band: body.age_band,
      conditions: body.conditions ?? [],
      allergies: body.allergies ?? [],
      consent: body.consent_basis
        ? { basis: body.consent_basis, given_at: new Date() }
        : null,
    };
    if (body.client_id === undefined) {
      await this.requireRoom(owner);
      const created = await this.members.create({
        owner_user_id: owner,
        ...fields,
      });
      return serializeHouseholdMember(created);
    }
    return this.saveByClientId(owner, body.client_id, fields);
  }

  /** Create the person, or update them if this client_id saved them before. */
  private async saveByClientId(
    owner: Types.ObjectId,
    clientId: string,
    fields: MemberFields
  ) {
    // A retry of someone already saved is an update, so it's fine when full.
    const saved = await this.isSaved(owner, clientId);
    if (!saved) {
      await this.requireRoom(owner);
    }
    // Consent is recorded once, when they're first added: a retry later
    // mustn't move its time forward.
    const { consent, ...rest } = fields;
    const upsert = () =>
      this.members
        .findOneAndUpdate(
          { owner_user_id: owner, client_id: clientId },
          { $set: rest, $setOnInsert: { consent } },
          { upsert: true, new: true, runValidators: true }
        )
        .orFail()
        .exec();
    try {
      return serializeHouseholdMember(await upsert());
    } catch (error) {
      // Two retries arrived together and both tried to insert; the loser
      // now finds the winner's member and updates it.
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      return serializeHouseholdMember(await upsert());
    }
  }

  private async isSaved(owner: Types.ObjectId, clientId: string) {
    const existing = await this.members.exists({
      owner_user_id: owner,
      client_id: clientId,
    });
    return existing !== null;
  }

  /**
   * Anyone but yourself needs your consent and a reason we may hold their
   * details (design 8c: parent or guardian, or the adult agreed); your own
   * conditions or allergies need your consent.
   */
  private async requireConsentToAdd(
    owner: Types.ObjectId,
    body: CreateHouseholdMemberRequest
  ) {
    if (body.relationship === "self") {
      // Every account starts with you in it (updated, never re-created): a
      // second "self" would be someone else added without their consent.
      const exists = await this.members.exists({
        owner_user_id: owner,
        relationship: "self",
      });
      if (exists) {
        throw new BadRequestException("You're already in the family.");
      }
      if (hasHealthInfo(body)) await this.requireHealthConsent(owner);
      return;
    }
    await this.requireHealthConsent(owner);
    if (!body.consent_basis) {
      throw new BadRequestException(
        "Confirm you may add this person's details (consent_basis)."
      );
    }
  }

  /** "I agree" on the current health-info notice (design 0b). */
  private async requireHealthConsent(owner: Types.ObjectId) {
    const user = await this.users
      .findById(owner, { health_consent: 1 })
      .lean()
      .exec();
    if (
      user?.health_consent?.notice_version !== HEALTH_CONSENT_NOTICE_VERSION
    ) {
      throw new ForbiddenException({
        code: "health_consent_required",
        message: "Agree to how we use health info before adding it.",
      });
    }
  }

  private async requireRoom(owner: Types.ObjectId) {
    const count = await this.members.countDocuments({ owner_user_id: owner });
    if (count >= MAX_HOUSEHOLD_MEMBERS) {
      throw new ConflictException(
        `A family can have up to ${MAX_HOUSEHOLD_MEMBERS} people. Remove someone to add another.`
      );
    }
  }

  async updateForUser(
    userId: string,
    memberId: string,
    body: UpdateHouseholdMemberRequest
  ) {
    const member = await this.requireOwnedMember(userId, memberId);
    if (hasHealthInfo(body)) {
      await this.requireHealthConsent(member.owner_user_id);
    }
    if (body.name !== undefined) {
      member.name = body.name;
    }
    if (body.relationship !== undefined) {
      member.relationship = body.relationship;
    }
    if (body.age_band === null) {
      member.age_band = undefined;
    } else if (body.age_band !== undefined) {
      member.age_band = body.age_band;
    }
    if (body.conditions !== undefined) {
      member.conditions = body.conditions;
    }
    if (body.allergies !== undefined) {
      member.allergies = body.allergies;
    }
    await member.save();
    return serializeHouseholdMember(member);
  }

  /**
   * Consent withdrawn (design 13b): everyone's conditions and allergies go;
   * names, relationships and age bands stay, so results become general.
   */
  async clearHealthInfo(userId: string): Promise<void> {
    await this.members
      .updateMany(
        { owner_user_id: new Types.ObjectId(userId) },
        { $set: { conditions: [], allergies: [] } }
      )
      .exec();
  }

  async deleteForUser(userId: string, memberId: string): Promise<void> {
    const member = await this.requireOwnedMember(userId, memberId);
    const owner = await this.users.findById(userId).exec();
    if (
      owner?.default_member_id &&
      String(owner.default_member_id) === memberId
    ) {
      throw new ForbiddenException(
        "Cannot delete the default household member"
      );
    }
    await member.deleteOne();
  }

  async requireOwnedMember(
    userId: string,
    memberId: string
  ): Promise<HouseholdMemberDocument> {
    if (!Types.ObjectId.isValid(memberId)) {
      throw new NotFoundException("Household member not found");
    }
    const member = await this.members.findById(memberId).exec();
    if (!member || String(member.owner_user_id) !== userId) {
      throw new NotFoundException("Household member not found");
    }
    return member;
  }

  async resolveMemberId(
    userId: string,
    requestedMemberId: string | undefined,
    defaultMemberId: string | null
  ): Promise<HouseholdMemberDocument> {
    const memberId = requestedMemberId ?? defaultMemberId;
    if (!memberId) {
      throw new ForbiddenException("No household member selected");
    }
    return this.requireOwnedMember(userId, memberId);
  }
}

/** Whether a request sets any conditions or allergies (clearing them doesn't count). */
function hasHealthInfo(
  body: Pick<CreateHouseholdMemberRequest, "conditions" | "allergies">
): boolean {
  return (
    (body.conditions?.length ?? 0) > 0 || (body.allergies?.length ?? 0) > 0
  );
}
