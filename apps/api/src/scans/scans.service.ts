import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CreateScanRequest,
  CreateScanResponse,
  ListScansQuery,
  ListScansResponse,
  ProductFoundResponse,
} from "@foodscanner/shared";
import { FilterQuery, Model, Types } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { Scan, ScanDocument } from "../database/schemas/scan.schema";
import { HouseholdService } from "../household/household.service";
import type { Severity } from "../database/schemas/scoring-record.schema";
import { HouseholdVerdictService } from "../personalization/household-verdict.service";
import { ProductsService } from "../products/products.service";
import { ProductSummaryService } from "../product-versions/product-summary";
import { serializeScan } from "./serialize-scan";

@Injectable()
export class ScansService {
  constructor(
    @InjectModel(Scan.name) private readonly scans: Model<ScanDocument>,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly household: HouseholdService,
    private readonly householdVerdicts: HouseholdVerdictService,
    private readonly products: ProductsService,
    private readonly summaries: ProductSummaryService
  ) {}

  /**
   * A scan: looks the product up (importing from Open Food Facts on first
   * sight), records what each member was shown at this moment — an audit
   * entry, never re-scored — and returns the verdict to display, so the
   * scanner makes one call. `member_id` omitted = scanned for everyone.
   */
  async create(
    user: RequestUser,
    body: CreateScanRequest
  ): Promise<CreateScanResponse> {
    const forMember = body.member_id
      ? await this.household.requireOwnedMember(user.userId, body.member_id)
      : null;
    const version = await this.products.resolveLive(body.barcode);
    const verdict = version
      ? await this.householdVerdicts.forVersion(version, user.userId)
      : null;

    const scan = await this.scans.create({
      user_id: new Types.ObjectId(user.userId),
      member_id: forMember?._id ?? null,
      barcode: body.barcode,
      product_version_id: version?._id ?? null,
      found: Boolean(version),
      severity: verdict ? severityFor(verdict.response, forMember?.id) : null,
      verdicts:
        verdict?.response.members.map((member) => ({
          member_id: new Types.ObjectId(member.member_id),
          severity: member.verdict.severity,
        })) ?? [],
      rule_set_version: verdict?.ruleSetVersion ?? null,
    });
    return {
      scan_id: scan.id as string,
      result: verdict?.response ?? { found: false },
    };
  }

  /** Household recents (Home), newest first. */
  listForHousehold(
    user: RequestUser,
    query: ListScansQuery
  ): Promise<ListScansResponse> {
    return this.page({ user_id: new Types.ObjectId(user.userId) }, query);
  }

  /** Scans made for one member. */
  async listForMember(
    user: RequestUser,
    memberId: string,
    query: ListScansQuery
  ): Promise<ListScansResponse> {
    await this.household.requireOwnedMember(user.userId, memberId);
    return this.page({ member_id: new Types.ObjectId(memberId) }, query);
  }

  private async page(
    filter: FilterQuery<ScanDocument>,
    query: ListScansQuery
  ): Promise<ListScansResponse> {
    const limit = query.limit ?? 20;
    if (query.from || query.to) {
      filter.created_at = {};
      if (query.from) {
        filter.created_at.$gte = new Date(query.from);
      }
      if (query.to) {
        filter.created_at.$lte = new Date(query.to);
      }
    }
    if (query.cursor && Types.ObjectId.isValid(query.cursor)) {
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

    // One query for the whole page's products, not one per row.
    const versionIds = page
      .map((scan) => scan.product_version_id)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const versions = versionIds.length
      ? await this.versions.find({ _id: { $in: versionIds } }).exec()
      : [];
    const productById = new Map(
      versions.map((version) => [
        String(version._id),
        this.summaries.summarize(version),
      ])
    );

    return {
      items: page.map((scan) =>
        serializeScan(
          scan,
          productById.get(String(scan.product_version_id)) ?? null
        )
      ),
      next_cursor: hasMore ? (page[page.length - 1].id as string) : null,
    };
  }
}

/** The verdict of whoever it was scanned for, or the overall one. */
function severityFor(
  result: ProductFoundResponse,
  memberId: string | undefined
): Severity {
  if (!memberId) {
    return result.overall.severity;
  }
  const member = result.members.find((m) => m.member_id === memberId);
  return member?.verdict.severity ?? result.overall.severity;
}
