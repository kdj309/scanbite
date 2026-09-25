import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CreateHouseholdMemberRequest,
  UpdateHouseholdMemberRequest,
} from "@foodscanner/shared";
import { Model, Types } from "mongoose";
import {
  HouseholdMember,
  HouseholdMemberDocument,
} from "../database/schemas/household-member.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import { serializeHouseholdMember } from "./serialize-member";

@Injectable()
export class HouseholdService {
  constructor(
    @InjectModel(HouseholdMember.name)
    private readonly members: Model<HouseholdMemberDocument>,
    @InjectModel(User.name)
    private readonly users: Model<UserDocument>,
  ) {}

  async listForUser(userId: string) {
    const docs = await this.members
      .find({ owner_user_id: new Types.ObjectId(userId) })
      .sort({ created_at: 1 })
      .exec();
    return { members: docs.map(serializeHouseholdMember) };
  }

  async createForUser(userId: string, body: CreateHouseholdMemberRequest) {
    const created = await this.members.create({
      owner_user_id: new Types.ObjectId(userId),
      name: body.name,
      relationship: body.relationship,
      age_band: body.age_band,
      conditions: body.conditions ?? [],
      allergies: body.allergies ?? [],
    });
    return serializeHouseholdMember(created);
  }

  async updateForUser(
    userId: string,
    memberId: string,
    body: UpdateHouseholdMemberRequest,
  ) {
    const member = await this.requireOwnedMember(userId, memberId);
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

  async deleteForUser(userId: string, memberId: string): Promise<void> {
    const member = await this.requireOwnedMember(userId, memberId);
    const owner = await this.users.findById(userId).exec();
    if (owner?.default_member_id && String(owner.default_member_id) === memberId) {
      throw new ForbiddenException("Cannot delete the default household member");
    }
    await member.deleteOne();
  }

  async requireOwnedMember(
    userId: string,
    memberId: string,
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
    defaultMemberId: string | null,
  ): Promise<HouseholdMemberDocument> {
    const memberId = requestedMemberId ?? defaultMemberId;
    if (!memberId) {
      throw new ForbiddenException("No household member selected");
    }
    return this.requireOwnedMember(userId, memberId);
  }
}
