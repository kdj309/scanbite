import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CreateScanRequest,
  CreateScanResponse,
  ListScansQuery,
  ListScansResponse,
  ProductFoundResponse,
} from "@foodscanner/shared";
import { FilterQuery, Model, PipelineStage, Types } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { Scan, ScanDocument } from "../database/schemas/scan.schema";
import { HouseholdService } from "../household/household.service";
import type { Severity } from "../database/schemas/scoring-record.schema";
import { HouseholdVerdictService } from "../personalization/household-verdict.service";
import type {
  LabelFacts,
  SubmissionDocument,
} from "../database/schemas/submission.schema";
import { ProductsService } from "../products/products.service";
import { ProductSummaryService } from "../product-versions/product-summary";
import { LabelChecksService } from "../submissions/label-checks.service";
import { serializeScan } from "./serialize-scan";
import type { ScanRecordInput } from "./scans.types";

@Injectable()
export class ScansService {
  constructor(
    @InjectModel(Scan.name) private readonly scans: Model<ScanDocument>,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly household: HouseholdService,
    private readonly householdVerdicts: HouseholdVerdictService,
    private readonly products: ProductsService,
    private readonly summaries: ProductSummaryService,
    private readonly labelChecks: LabelChecksService
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

    const scan = await this.record({
      userId: user.userId,
      forMemberId: forMember?.id as string | undefined,
      barcode: body.barcode,
      labelCheckId: null,
      productVersionId: version?._id ?? null,
      verdict,
    });
    return {
      scan_id: scan.id as string,
      result: verdict?.response ?? { found: false },
    };
  }

  /**
   * A label check's Recent scans entry, made by the worker once its label
   * is read — so it's there even if the app was closed meanwhile (there's
   * no barcode to scan again).
   */
  async recordLabelCheck(
    check: SubmissionDocument & { label_facts: LabelFacts }
  ): Promise<void> {
    const userId = String(check.user_id);
    const verdict = await this.householdVerdicts.forLabelCheck(
      check.id as string,
      check.label_facts,
      userId
    );
    await this.record({
      userId,
      forMemberId: check.for_member_id
        ? String(check.for_member_id)
        : undefined,
      barcode: null,
      labelCheckId: check._id as Types.ObjectId,
      productVersionId: null,
      verdict,
    });
  }

  private record(input: ScanRecordInput): Promise<ScanDocument> {
    const { verdict } = input;
    return this.scans.create({
      user_id: new Types.ObjectId(input.userId),
      member_id: input.forMemberId
        ? new Types.ObjectId(input.forMemberId)
        : null,
      barcode: input.barcode,
      label_check_id: input.labelCheckId,
      product_version_id: input.productVersionId,
      found: Boolean(verdict),
      severity: verdict
        ? severityFor(verdict.response, input.forMemberId)
        : null,
      verdicts:
        verdict?.response.members.map((member) => ({
          member_id: new Types.ObjectId(member.member_id),
          severity: member.verdict.severity,
        })) ?? [],
      rule_set_version: verdict?.ruleSetVersion ?? null,
    });
  }

  /**
   * Removes a Recent scans row for good. A product row takes all of this
   * user's scans of it (or an older one would show again); the product
   * stays in the catalog. A label check is this user's alone, so it goes
   * whole: photos, what was read, and its scans.
   */
  async remove(user: RequestUser, scanId: string): Promise<void> {
    const scan = Types.ObjectId.isValid(scanId)
      ? await this.scans.findOne({ _id: scanId, user_id: user.userId }).exec()
      : null;
    if (!scan) {
      throw new NotFoundException("Scan not found");
    }
    if (scan.label_check_id) {
      await this.labelChecks.delete(scan.label_check_id, user.userId);
      return;
    }
    await this.scans
      .deleteMany({ user_id: user.userId, barcode: scan.barcode })
      .exec();
  }

  /** Household recents (Home), newest first. */
  listForHousehold(
    user: RequestUser,
    query: ListScansQuery
  ): Promise<ListScansResponse> {
    return this.page(user, { user_id: new Types.ObjectId(user.userId) }, query);
  }

  /** Scans made for one member. */
  async listForMember(
    user: RequestUser,
    memberId: string,
    query: ListScansQuery
  ): Promise<ListScansResponse> {
    await this.household.requireOwnedMember(user.userId, memberId);
    return this.page(user, { member_id: new Types.ObjectId(memberId) }, query);
  }

  /**
   * Recent scans: each product once, at its latest scan, and only products
   * we found (a miss has no result to open). The full log stays stored.
   */
  private async page(
    user: RequestUser,
    filter: FilterQuery<ScanDocument>,
    query: ListScansQuery
  ): Promise<ListScansResponse> {
    const limit = query.limit ?? 20;
    const match: FilterQuery<ScanDocument> = { ...filter, found: true };
    if (query.from || query.to) {
      match.created_at = {};
      if (query.from) {
        match.created_at.$gte = new Date(query.from);
      }
      if (query.to) {
        match.created_at.$lte = new Date(query.to);
      }
    }
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: { created_at: -1, _id: -1 } },
      {
        $group: {
          _id: { $ifNull: ["$barcode", "$label_check_id"] },
          latest: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$latest" } },
    ];
    // After grouping, so an older scan of a product already listed can't
    // bring it back on the next page.
    if (query.cursor && Types.ObjectId.isValid(query.cursor)) {
      const cursor = await this.scans.findById(query.cursor).exec();
      if (cursor) {
        pipeline.push({
          $match: {
            $or: [
              { created_at: { $lt: cursor.created_at } },
              { created_at: cursor.created_at, _id: { $lt: cursor._id } },
            ],
          },
        });
      }
    }
    pipeline.push(
      { $sort: { created_at: -1, _id: -1 } },
      { $limit: limit + 1 }
    );

    const items = (await this.scans.aggregate<Scan>(pipeline).exec()).map(
      (raw) => this.scans.hydrate(raw)
    );
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    // One query for the whole page's products, not one per row.
    const versionIds = page
      .map((scan) => scan.product_version_id)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const versions = versionIds.length
      ? await this.versions.find({ _id: { $in: versionIds } }).exec()
      : [];
    const checks = await this.labelChecks.summaries(
      page
        .map((scan) => scan.label_check_id)
        .filter((id): id is Types.ObjectId => Boolean(id)),
      user.userId
    );
    const productById = new Map([
      ...versions.map(
        (version) =>
          [String(version._id), this.summaries.summarize(version)] as const
      ),
      ...checks,
    ]);

    return {
      items: page.map((scan) =>
        serializeScan(
          scan,
          productById.get(
            String(scan.product_version_id ?? scan.label_check_id)
          ) ?? null
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
