import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CreateScanRequest,
  CreateScanResponse,
  ListScansQuery,
  ListScansResponse,
  MemberSummaryQuery,
  MemberSummaryResponse,
} from "@foodscanner/shared";
import { FilterQuery, Model, Types } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { Scan, ScanDocument } from "../database/schemas/scan.schema";
import {
  ScoringRecord,
  ScoringRecordDocument,
} from "../database/schemas/scoring-record.schema";
import { HouseholdService } from "../household/household.service";
import { serializeScan } from "./serialize-scan";

@Injectable()
export class ScansService {
  constructor(
    @InjectModel(Scan.name) private readonly scans: Model<ScanDocument>,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    @InjectModel(ScoringRecord.name)
    private readonly scoringRecords: Model<ScoringRecordDocument>,
    private readonly household: HouseholdService,
  ) {}

  async create(
    user: RequestUser,
    body: CreateScanRequest,
  ): Promise<CreateScanResponse> {
    const member = await this.household.resolveMemberId(
      user.userId,
      body.member_id,
      user.defaultMemberId,
    );
    const live = await this.versions
      .findOne({ barcode: body.barcode, status: "live" })
      .exec();
    const created = await this.scans.create({
      user_id: new Types.ObjectId(user.userId),
      member_id: member._id,
      barcode: body.barcode,
      product_version_id: live?._id ?? null,
      found: Boolean(live),
    });
    return serializeScan(created);
  }

  async list(
    user: RequestUser,
    memberId: string,
    query: ListScansQuery,
  ): Promise<ListScansResponse> {
    await this.household.requireOwnedMember(user.userId, memberId);
    const limit = query.limit ?? 20;
    const filter: FilterQuery<ScanDocument> = {
      member_id: new Types.ObjectId(memberId),
    };
    if (query.from || query.to) {
      filter.created_at = {};
      if (query.from) {
        filter.created_at.$gte = new Date(query.from);
      }
      if (query.to) {
        filter.created_at.$lte = new Date(query.to);
      }
    }
    if (query.cursor) {
      const cursor = await this.scans.findById(query.cursor).exec();
      if (cursor) {
        filter.$or = [
          { created_at: { $lt: cursor.created_at } },
          {
            created_at: cursor.created_at,
            _id: { $lt: cursor._id },
          },
        ];
      }
    }

    const items = await this.scans
      .find(filter)
      .sort({ created_at: -1, _id: -1 })
      .limit(limit + 1)
      .exec();
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page.map(serializeScan),
      next_cursor: hasMore ? (page[page.length - 1].id as string) : null,
    };
  }

  async summary(
    user: RequestUser,
    memberId: string,
    query: MemberSummaryQuery,
  ): Promise<MemberSummaryResponse> {
    await this.household.requireOwnedMember(user.userId, memberId);
    const now = new Date();
    const from = new Date(now);
    if (query.period === "week") {
      from.setUTCDate(from.getUTCDate() - 7);
    } else {
      from.setUTCDate(from.getUTCDate() - 30);
    }

    const scans = await this.scans
      .find({
        member_id: new Types.ObjectId(memberId),
        created_at: { $gte: from, $lte: now },
      })
      .exec();

    const versionIds = scans
      .map((scan) => scan.product_version_id)
      .filter((id): id is Types.ObjectId => Boolean(id));

    const versions =
      versionIds.length === 0
        ? []
        : await this.versions.find({ _id: { $in: versionIds } }).exec();
    const versionById = new Map(
      versions.map((version) => [String(version._id), version]),
    );

    const records =
      versionIds.length === 0
        ? []
        : await this.scoringRecords
            .aggregate<{
              _id: Types.ObjectId;
              severity: "green" | "yellow" | "red";
            }>([
              { $match: { product_version_id: { $in: versionIds } } },
              { $sort: { computed_at: -1 } },
              {
                $group: {
                  _id: "$product_version_id",
                  severity: { $first: "$severity" },
                },
              },
            ])
            .exec();
    const severityByVersion = new Map(
      records.map((record) => [String(record._id), record.severity]),
    );

    let totalSugar = 0;
    const bySeverity = { green: 0, yellow: 0, red: 0 };
    for (const scan of scans) {
      if (!scan.product_version_id) {
        continue;
      }
      const version = versionById.get(String(scan.product_version_id));
      const sugar = Number(version?.nutrition?.sugar_per_100g);
      if (Number.isFinite(sugar) && sugar > 0) {
        totalSugar += sugar;
      }
      const severity = severityByVersion.get(String(scan.product_version_id));
      if (severity) {
        bySeverity[severity] += 1;
      }
    }

    return {
      period: query.period,
      scan_count: scans.length,
      total_sugar_g: totalSugar,
      by_severity: bySeverity,
    };
  }
}
