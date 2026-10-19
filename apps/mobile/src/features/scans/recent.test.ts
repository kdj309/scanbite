import type { HouseholdMember, Scan, Severity } from "@foodscanner/shared";
import {
  checkedVerdicts,
  ringsFor,
  scanSeverity,
  scanSummary,
  timeAgo,
} from "./recent";

const YOU_ID = "6ab7d04ffb5027914b128aed";
const AMMA_ID = "6ab7d04ffb5027914b128aee";
const PAPA_ID = "6ab7d04ffb5027914b128aef";

function member(id: string, fields: Partial<HouseholdMember>): HouseholdMember {
  return {
    id,
    name: "Self",
    relationship: "self",
    conditions: [],
    allergies: [],
    created_at: "2026-10-17T00:00:00.000Z",
    updated_at: "2026-10-17T00:00:00.000Z",
    ...fields,
  };
}

const you = member(YOU_ID, {});
const amma = member(AMMA_ID, {
  name: "Amma",
  relationship: "parent",
  conditions: ["hypertensive"],
});
const papa = member(PAPA_ID, {
  name: "Papa",
  relationship: "parent",
  conditions: ["diabetic"],
});

function scan(
  verdicts: Record<string, Severity>,
  severity: Severity = "red"
): Scan {
  return {
    id: "6ab7d04ffb5027914b128af0",
    barcode: "8901234567890",
    member_id: null,
    product_version_id: "6ab7d04ffb5027914b128af1",
    product: null,
    found: true,
    severity,
    verdicts: Object.entries(verdicts).map(([member_id, s]) => ({
      member_id,
      severity: s,
    })),
    rule_set_version: "1",
    created_at: "2026-10-19T10:00:00.000Z",
  };
}

const family = [you, amma, papa];

describe("checkedVerdicts", () => {
  it("lists only people with conditions or allergies", () => {
    const checked = checkedVerdicts(
      scan({ [YOU_ID]: "red", [AMMA_ID]: "yellow", [PAPA_ID]: "red" }),
      family
    );
    expect(checked.map((v) => v.member.name)).toEqual(["Amma", "Papa"]);
  });
});

describe("scanSummary and scanSeverity", () => {
  it("names who to avoid it for, worst first, and colours by the worst", () => {
    const s = scan({ [AMMA_ID]: "yellow", [PAPA_ID]: "red" });
    const checked = checkedVerdicts(s, family);
    expect(scanSummary(s, checked)).toBe("Avoid for Papa · Caution for Amma");
    expect(scanSeverity(s, checked)).toBe("red");
  });

  it("says 'both' when it's the same for the two people checked", () => {
    const s = scan({ [AMMA_ID]: "red", [PAPA_ID]: "red" });
    expect(scanSummary(s, checkedVerdicts(s, family))).toBe("Avoid for both");
  });

  it("is safe for everyone, or for the one person checked", () => {
    const s = scan({ [AMMA_ID]: "green", [PAPA_ID]: "green" });
    expect(scanSummary(s, checkedVerdicts(s, family))).toBe(
      "Safe for everyone"
    );
    expect(scanSummary(s, checkedVerdicts(s, [you, papa]))).toBe(
      "Safe for Papa"
    );
  });

  it("falls back to the general verdict when nobody has conditions yet", () => {
    const s = scan({ [YOU_ID]: "yellow" }, "yellow");
    const checked = checkedVerdicts(s, [you]);
    expect(scanSummary(s, checked)).toBe("Caution in general");
    expect(scanSeverity(s, checked)).toBe("yellow");
  });

  it("says when the product wasn't found", () => {
    const s = { ...scan({}), found: false, severity: null };
    expect(scanSummary(s, [])).toBe("Not found");
  });
});

describe("ringsFor", () => {
  it("shows the two worst verdicts and counts the rest", () => {
    const riya = member("6ab7d04ffb5027914b128af2", {
      name: "Riya",
      relationship: "child",
      allergies: ["peanuts"],
    });
    const s = scan({
      [AMMA_ID]: "green",
      [PAPA_ID]: "yellow",
      [riya.id]: "red",
    });
    const rings = ringsFor(checkedVerdicts(s, [amma, papa, riya]));
    expect(rings.shown.map((v) => v.member.name)).toEqual(["Riya", "Papa"]);
    expect(rings.more).toBe(1);
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 9, 19, 12, 0);
  const ago = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString();

  it("counts minutes and hours today, then yesterday, then the date", () => {
    expect(timeAgo(ago(0), now)).toBe("Just now");
    expect(timeAgo(ago(5), now)).toBe("5 min ago");
    expect(timeAgo(ago(180), now)).toBe("3 hr ago");
    expect(timeAgo(new Date(2026, 9, 18, 20, 0).toISOString(), now)).toBe(
      "Yesterday"
    );
    expect(timeAgo(new Date(2026, 9, 12, 9, 0).toISOString(), now)).toBe(
      "12 Oct"
    );
  });
});
