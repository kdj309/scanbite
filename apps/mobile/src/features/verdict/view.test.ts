import type {
  HouseholdMember,
  MemberVerdict,
  ProductFoundResponse,
  Severity,
  VerdictReason,
} from "@foodscanner/shared";
import { ALL, defaultSelection, personOptions, verdictView } from "./view";

const YOU = "6ab7d04ffb5027914b128aed";
const AMMA = "6ab7d04ffb5027914b128aee";
const PAPA = "6ab7d04ffb5027914b128aef";

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

const you = member(YOU, {});
const amma = member(AMMA, {
  name: "Amma",
  relationship: "parent",
  conditions: ["hypertensive"],
});
const papa = member(PAPA, {
  name: "Papa",
  relationship: "parent",
  conditions: ["diabetic", "hypertensive"],
});

const flag = (
  rule: string,
  label: string,
  severity: Severity
): VerdictReason => ({
  kind: "flag",
  severity,
  label,
  text: `${label} text`,
  rule_id: rule,
});
const sugar = flag("diabetic_sugar", "Too sweet for diabetes", "red");
const nova = flag("nova4", "Ultra-processed", "yellow");
const palm = flag("palm_oil", "Palm oil", "yellow");

function verdict(
  m: HouseholdMember,
  severity: Severity,
  reasons: VerdictReason[],
  hasProfile = true
): MemberVerdict {
  return {
    member_id: m.id,
    name: m.name,
    has_health_profile: hasProfile,
    verdict: {
      severity,
      reasons,
      checked: [{ label: "Salt", for: [] }],
    },
  };
}

function result(
  overall: ProductFoundResponse["overall"],
  members: MemberVerdict[]
): ProductFoundResponse {
  return {
    found: true,
    product: {
      name: "Chocolate malt drink",
      brand: "Brand",
      product_version_id: "6ab7d04ffb5027914b128af1",
      source: "catalog",
      verifying: false,
      has_ingredients: true,
      image_url: null,
      quantity: "200 g",
      veg: "veg",
      buy_links: [],
    },
    overall,
    members,
    confidence: "full",
    unresolved_ingredients: [],
  };
}

const family = [you, amma, papa];
const flagged = result({ severity: "red", member_id: PAPA }, [
  verdict(you, "yellow", [nova], false),
  verdict(amma, "yellow", [nova, palm]),
  verdict(papa, "red", [sugar, nova, palm]),
]);

describe("defaultSelection", () => {
  it("opens on whoever it was scanned for, else the person it's worst for", () => {
    expect(defaultSelection(flagged, AMMA)).toBe(AMMA);
    expect(defaultSelection(flagged, undefined)).toBe(PAPA);
  });

  it("opens on everyone when it's fine for all", () => {
    const safe = result({ severity: "green", member_id: AMMA }, []);
    expect(defaultSelection(safe, undefined)).toBe(ALL);
  });
});

describe("personOptions", () => {
  it("lists All, then each person, with 'none' for anyone not checked", () => {
    expect(personOptions(flagged, family)).toEqual([
      { id: ALL, name: "All", severity: "red" },
      { id: YOU, name: "You", severity: "none" },
      { id: AMMA, name: "Amma", severity: "yellow" },
      { id: PAPA, name: "Papa", severity: "red" },
    ]);
  });
});

describe("verdictView", () => {
  it("lists at most two of someone's conditions, then a count", () => {
    const mother = member(AMMA, {
      name: "Mother",
      relationship: "parent",
      conditions: ["diabetic", "hypertensive", "dyslipidemia", "obesity"],
    });
    const view = verdictView(flagged, [you, mother, papa], AMMA);
    expect(view.checkedFor).toBe("Checked for Mother · Sugar, BP +2");
  });

  it("shows one person's main reason and their other flags", () => {
    const view = verdictView(flagged, family, PAPA);
    expect(view).toMatchObject({
      severity: "red",
      badge: "Avoid for Papa",
      checkedFor: "Checked for Papa · Sugar, BP",
      reasonLabel: "Main reason",
      title: "Too sweet for diabetes",
      whyRuleId: "diabetic_sugar",
      flagged: true,
    });
    expect(view.more.items.map((item) => item.title)).toEqual([
      "Ultra-processed",
      "Palm oil",
    ]);
  });

  it("sums up everyone, with each other flag once and who it's for", () => {
    const view = verdictView(flagged, family, ALL);
    expect(view).toMatchObject({
      badge: "Avoid for Papa",
      checkedFor: "Checked for Amma & Papa",
      reasonLabel: "Biggest concern",
      title: "Too sweet for diabetes",
    });
    expect(view.more.items).toEqual([
      {
        title: "Ultra-processed",
        detail: "Caution for Amma & Papa",
        tone: "yellow",
      },
      { title: "Palm oil", detail: "Caution for Amma & Papa", tone: "yellow" },
    ]);
  });

  it("counts who the worst verdict is for, and says everyone only for the whole family", () => {
    const allAvoid = result({ severity: "red", member_id: AMMA }, [
      verdict(you, "yellow", [nova], false),
      verdict(amma, "red", [sugar]),
      verdict(papa, "red", [sugar]),
    ]);
    expect(verdictView(allAvoid, family, ALL).badge).toBe("Avoid for 2 people");
    const twoOfTwo = result({ severity: "red", member_id: AMMA }, [
      verdict(amma, "red", [sugar]),
      verdict(papa, "red", [sugar]),
    ]);
    expect(verdictView(twoOfTwo, [amma, papa], ALL).badge).toBe(
      "Avoid for everyone"
    );
  });

  it("asks for your conditions when nothing personal was checked", () => {
    const view = verdictView(flagged, family, YOU);
    expect(view).toMatchObject({
      severity: "none",
      badge: "Analyze for you",
      title: "No conditions added yet",
      addConditionsFor: you,
    });
    expect(view.more.title).toBe("General check");
  });

  it("lists what was checked when nothing is flagged", () => {
    const safe = result({ severity: "green", member_id: AMMA }, [
      verdict(amma, "green", []),
    ]);
    const view = verdictView(safe, family, AMMA);
    expect(view).toMatchObject({
      badge: "Safe for Amma",
      title: "Nothing flagged",
      line: "Nothing here conflicts with Amma’s BP.",
      flagged: false,
    });
    expect(view.more).toEqual({
      title: "What we checked",
      items: [{ title: "Salt", detail: "Within limits", tone: "ok" }],
    });
  });

  it("lists a label once when two rules share it", () => {
    const unchecked = (rule: string): VerdictReason => ({
      kind: "unchecked",
      label: "Sugar not checked",
      text: "Couldn’t check sugar",
      rule_id: rule,
    });
    const safe = result({ severity: "green", member_id: AMMA }, [
      verdict(amma, "green", [unchecked("sugar_a"), unchecked("sugar_b")]),
    ]);
    expect(
      verdictView(safe, family, AMMA).more.items.map((item) => item.title)
    ).toEqual(["Salt", "Sugar not checked"]);
  });

  it("says what couldn't be checked when a Caution has no flag", () => {
    const gap = (label: string): VerdictReason => ({
      kind: "unchecked",
      label: `${label} not checked`,
      text: `Couldn’t check ${label.toLowerCase()}`,
      rule_id: label,
    });
    const unchecked = result({ severity: "yellow", member_id: AMMA }, [
      verdict(amma, "yellow", [gap("Sugar"), gap("Salt")]),
      verdict(papa, "yellow", [gap("Sugar")]),
    ]);
    const view = verdictView(unchecked, family, AMMA);
    expect(view).toMatchObject({
      title: "Couldn’t check everything",
      line: "Sugar and salt weren’t on the label, so I couldn’t check them.",
    });
    // Nothing was flagged, so there's no "Why does this matter?".
    expect(view.whyRuleId).toBeUndefined();
    expect(verdictView(unchecked, family, ALL).line).toBe(
      "Sugar and salt weren’t on the label, so I couldn’t check them. Nothing else was flagged."
    );
  });

  it("shows someone's flag when the overall person ties with only gaps", () => {
    const gapOnly: VerdictReason = {
      kind: "unchecked",
      label: "Sugar not checked",
      text: "Couldn’t check sugar",
      rule_id: "sugar",
    };
    const tie = result({ severity: "yellow", member_id: AMMA }, [
      verdict(amma, "yellow", [gapOnly]),
      verdict(papa, "yellow", [nova]),
    ]);
    expect(verdictView(tie, family, ALL)).toMatchObject({
      reasonLabel: "Biggest concern",
      title: "Ultra-processed",
    });
  });

  it("gives the general verdict while nobody has conditions", () => {
    const general = result({ severity: "yellow", member_id: null }, [
      verdict(you, "yellow", [nova], false),
    ]);
    expect(verdictView(general, [you], ALL)).toMatchObject({
      badge: "Caution in general",
      reasonLabel: "General check",
      title: "Ultra-processed",
      addConditionsFor: you,
    });
  });
});
