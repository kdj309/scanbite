import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { ClientSession } from "mongoose";
import { Connection, Model, Types } from "mongoose";
import { withTransactionFallback } from "../common/with-transaction";
import { Product, ProductDocument } from "../database/schemas/product.schema";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { shouldAutoPromote } from "./conflict";

export type PromoteResult =
  | { promoted: true; productVersionId: string }
  | {
      promoted: false;
      productVersionId: string;
      reason: "needs_review" | "already_live" | "superseded";
    };

@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    @InjectModel(Product.name)
    private readonly products: Model<ProductDocument>
  ) {}

  async promoteIfEligible(productVersionId: string): Promise<PromoteResult> {
    const version = await this.versions.findById(productVersionId).exec();
    if (!version) {
      throw new NotFoundException("Product version not found");
    }
    if (version.status === "live") {
      return { promoted: true, productVersionId };
    }
    if (version.status === "superseded") {
      // Another submission already won the promotion race for this barcode;
      // there is a live version, just not this one — nothing for a human to review.
      return {
        promoted: false,
        productVersionId,
        reason: "superseded",
      };
    }

    const live = await this.versions
      .findOne({ barcode: version.barcode, status: "live" })
      .exec();
    // v1: this submission's vision confidence only — not corroboration count
    // or independent submitters (HLD §6c). See shouldAutoPromote.
    const eligible = shouldAutoPromote({
      hasLiveVersion: Boolean(live),
      extractionConfidence: version.extraction_confidence ?? 0,
    });
    if (!eligible) {
      this.logger.log(`Leaving version ${productVersionId} pending for review`);
      return { promoted: false, productVersionId, reason: "needs_review" };
    }

    await this.promoteVersion(version, live);
    return { promoted: true, productVersionId };
  }

  private promoteVersion(
    pending: ProductVersionDocument,
    live: ProductVersionDocument | null
  ): Promise<void> {
    return withTransactionFallback(this.connection, (session) =>
      this.applyPromotion(pending, live, session)
    );
  }

  private async applyPromotion(
    pending: ProductVersionDocument,
    live: ProductVersionDocument | null,
    session?: ClientSession
  ): Promise<void> {
    const opts = session ? { session } : {};
    if (live) {
      live.status = "superseded";
      await live.save(opts);
    }
    pending.status = "live";
    await pending.save(opts);
    await this.products
      .updateOne(
        { _id: pending.product_id },
        { $set: { current_version_id: pending._id as Types.ObjectId } },
        opts
      )
      .exec();
  }
}
