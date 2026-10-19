/**
 * Recent scans against real Mongo: each product once (its latest scan),
 * misses left out, and paging that doesn't repeat a product.
 *
 *   pnpm --filter api build && pnpm --filter api test:integration
 */
import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import mongoose, { Types } from "mongoose";
import { connectTestDb, dropTestDb } from "../common/integration-db";
import {
  ProductVersion,
  ProductVersionSchema,
} from "../database/schemas/product-version.schema";
import { Scan, ScanSchema } from "../database/schemas/scan.schema";
import { ScansService } from "./scans.service";

describe("recent scans (integration)", () => {
  const scans = mongoose.model(Scan.name, ScanSchema);
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  // Listing needs only the two models; the rest are for creating scans.
  const service = new ScansService(
    scans as never,
    versions as never,
    null as never,
    null as never,
    null as never,
    null as never
  );

  before(() => connectTestDb("itest_scans"));
  after(() => dropTestDb());

  const user = () => ({
    userId: new Types.ObjectId().toString(),
    role: "user" as const,
    defaultMemberId: null,
  });
  let minute = 0;
  const scan = (userId: string, barcode: string, found = true) =>
    scans.create({
      user_id: new Types.ObjectId(userId),
      member_id: null,
      barcode,
      product_version_id: null,
      found,
      severity: found ? "red" : null,
      verdicts: [],
      rule_set_version: null,
      created_at: new Date(Date.UTC(2026, 9, 19, 12, minute++)),
    });

  it("lists each product once, at its latest scan, without misses", async () => {
    const me = user();
    await scan(me.userId, "3017620425035");
    await scan(me.userId, "5449000000996");
    await scan(me.userId, "20000017", false);
    const latest = await scan(me.userId, "3017620425035");

    const { items } = await service.listForHousehold(me, {});

    assert.deepEqual(
      items.map((item) => item.barcode),
      ["3017620425035", "5449000000996"]
    );
    assert.equal(items[0].id, latest.id);
  });

  it("pages without repeating a product", async () => {
    const me = user();
    await scan(me.userId, "11111111");
    await scan(me.userId, "22222222");
    await scan(me.userId, "11111111");
    await scan(me.userId, "33333333");

    const first = await service.listForHousehold(me, { limit: 2 });
    const second = await service.listForHousehold(me, {
      limit: 2,
      cursor: first.next_cursor ?? undefined,
    });

    assert.deepEqual(
      [...first.items, ...second.items].map((item) => item.barcode),
      ["33333333", "11111111", "22222222"]
    );
    assert.equal(second.next_cursor, null);
  });
});
