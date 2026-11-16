import "reflect-metadata";
/**
 * Seeds the rule_explainers collection (HLD §16, educational content
 * feature) — human-reviewed content for the example rules and the
 * condition salt rules and the WHO dessert limits, grouped into 7 topics since several rule_ids are
 * the same educational
 * concept at different solid/liquid thresholds, not separate things to
 * explain. AI-drafted, human-reviewed and edited before going in here —
 * see the product-strategy conversation this came out of, not auto-
 * published from a model's first pass.
 *
 * Idempotent — upserts by each entry's first rule_id, safe to re-run after
 * content edits.
 *
 *   pnpm exec tsc -p tsconfig.json && node dist/admin/seed-rule-explainers.js
 */
import mongoose from "mongoose";
import {
  RuleExplainer,
  RuleExplainerSchema,
} from "../database/schemas/rule-explainer.schema";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";

type SeedEntry = {
  rule_ids: string[];
  title: string;
  explainer: string;
  condition_variants: Array<{ condition: string; addendum: string }>;
  citations: string;
};

const ENTRIES: SeedEntry[] = [
  {
    rule_ids: [
      "sugar_uk_fop",
      "fssai_cannot_claim_low_sugar",
      "sugar_uk_fop_liquid",
      "fssai_cannot_claim_low_sugar_liquid",
    ],
    title: "High sugar content",
    explainer:
      'Too much sugar, especially as a regular part of your diet, is linked to weight gain, type 2 diabetes, and cavities. This product is sweet enough to count as "high sugar" under UK labeling rules (over 22.5g per 100g for food, 11.25g per 100ml for drinks), or sweet enough that FSSAI wouldn\'t let it carry a "low sugar" label in India (over 5g per 100g, or 2.5g per 100ml). Neither number is a personal daily limit. What actually matters is how much of this you eat, and how often.',
    condition_variants: [
      {
        condition: "diabetic",
        addendum:
          "Sugar at this level can push your blood glucose up more than the general threshold accounts for. Worth talking to your doctor or dietitian about how it fits into your day.",
      },
    ],
    citations:
      "UK Nutrient Profiling Model (2016); FSSAI Food Safety and Standards (Advertising & Claims) Regulations, 2018.",
  },
  {
    rule_ids: [
      "fssai_cannot_claim_low_sodium",
      "fssai_cannot_claim_low_sodium_liquid",
    ],
    title: "High sodium content",
    explainer:
      "Too much salt over time raises blood pressure for a lot of people, which raises the risk of heart disease and stroke down the line. This product has enough sodium that FSSAI wouldn't let it carry a \"low sodium\" label in India (over 120mg per 100g or 100ml). That's a labeling rule, not a personal safety limit — how much sodium is fine for you depends on your health and whatever else you eat that day.",
    condition_variants: [
      {
        condition: "hypertensive",
        addendum:
          "Cutting sodium is often part of managing high blood pressure. Check this against whatever limit your doctor's given you.",
      },
      {
        condition: "chronic_kidney_disease",
        addendum:
          "Cutting sodium is often part of managing kidney disease. Check this against whatever limit your doctor's given you.",
      },
    ],
    citations:
      "FSSAI Food Safety and Standards (Advertising & Claims) Regulations, 2018.",
  },
  {
    rule_ids: [
      "hypertensive_sodium_escalation",
      "hypertensive_sodium_escalation_liquid",
      "cardiovascular_sodium_escalation",
      "cardiovascular_sodium_escalation_liquid",
      "chronic_kidney_disease_sodium_escalation",
      "chronic_kidney_disease_sodium_escalation_liquid",
      "hypertensive_sodium_escalation_frozen_dessert",
      "hypertensive_sodium_escalation_curded_dessert",
      "cardiovascular_sodium_escalation_frozen_dessert",
      "cardiovascular_sodium_escalation_curded_dessert",
      "chronic_kidney_disease_sodium_escalation_frozen_dessert",
      "chronic_kidney_disease_sodium_escalation_curded_dessert",
    ],
    title: "High salt for your condition",
    explainer:
      "This product is above the level ICMR–NIN calls high in salt for packaged food: 625mg of salt per 100g (about 250mg sodium), or 175mg per 100ml for drinks (about 70mg sodium). India's dietary guidelines link high salt to high blood pressure, heart disease and extra strain on the kidneys, which is why we're stricter about it for you than for everyone else. It's a per-100g level, not a daily limit — how much of this you eat still matters most.",
    condition_variants: [
      {
        condition: "hypertensive",
        addendum:
          "Cutting salt is one of the most direct ways to help keep blood pressure down. Check this against whatever limit your doctor's given you.",
      },
      {
        condition: "cardiovascular",
        addendum:
          "Salt raises blood pressure, which puts more load on your heart. Check this against whatever limit your doctor's given you.",
      },
      {
        condition: "chronic_kidney_disease",
        addendum:
          "Your kidneys are what clear extra sodium, so cutting salt is often part of managing kidney disease. Check this against whatever limit your doctor's given you.",
      },
    ],
    citations:
      "ICMR–NIN Dietary Guidelines for Indians, 2024 (Table 15.1, nutrients of concern threshold criteria).",
  },
  {
    rule_ids: ["palm_oil"],
    title: "Contains palm oil",
    explainer:
      "Palm oil is cheap, lasts a long time on the shelf, and gives food a certain texture, which is why it's everywhere in packaged food. It's higher in saturated fat than most other vegetable oils, and growing it has driven a lot of tropical deforestation. On its own, palm oil isn't dangerous. We flag it so you can actually see it, since it's easy to miss in small print and the saturated fat adds up over time.",
    condition_variants: [
      {
        condition: "cardiovascular",
        addendum:
          "Saturated fats like palm oil are worth keeping in check if you're managing heart disease risk.",
      },
      {
        condition: "dyslipidemia",
        addendum:
          "Saturated fats like palm oil are worth keeping in check if you're managing cholesterol.",
      },
    ],
    citations:
      "A note on sourcing: unlike sugar or sodium, there's no single regulation behind this flag. This is general, well-established nutrition knowledge, not a specific legal threshold.",
  },
  {
    rule_ids: ["additives"],
    title: "High additive count",
    explainer:
      "This product lists four or more additives — preservatives, emulsifiers, colors, flavor enhancers, that kind of thing. That's more than you'd expect in a simple food. Every additive sold in India has to pass an FSSAI safety review, so a high count isn't a safety violation by itself. We flag it because more additives usually (not always) means more processing.",
    condition_variants: [],
    citations:
      "A note on sourcing: FSSAI sets limits for individual additives, but this flag is about how many are in the mix, not whether any specific one is unsafe.",
  },
  {
    rule_ids: ["nova4"],
    title: "NOVA group 4 (ultra-processed)",
    explainer:
      "NOVA classifies food by how much it's been processed, not by its nutrition numbers. Group 4, \"ultra-processed,\" means the ingredients go beyond what you'd use cooking at home — flavor enhancers, emulsifiers, ingredients broken down and rebuilt into something else. Diets heavy in ultra-processed food show up linked to higher rates of obesity and heart disease in population studies. Scientists are still working out exactly why, so take this as a signal worth noticing, not a verdict on this one product.",
    condition_variants: [
      {
        condition: "obesity",
        addendum:
          "This is one of the patterns worth watching if you're managing your weight. It's not proof this specific product will cause you harm — it's a pattern that shows up a lot in the research.",
      },
      {
        condition: "cardiovascular",
        addendum:
          "This is one of the patterns worth watching if you're managing heart health. It's not proof this specific product will cause you harm — it's a pattern that shows up a lot in the research.",
      },
    ],
    citations: "NOVA classification system (Monteiro et al., 2016/2019).",
  },
  {
    rule_ids: [
      "who_frozen_dessert_sugar",
      "who_frozen_dessert_sodium",
      "who_curded_dessert_sugar",
      "who_curded_dessert_sodium",
    ],
    title: "Over the limit for a dessert",
    explainer:
      "Ice cream and dairy desserts are checked against the WHO's own limits for desserts in South-East Asia, not the ones for snacks or drinks. Per 100 g (or 100 ml, as the label gives it), ice cream and frozen desserts go over at 12 g sugar or 100 mg sodium; shrikhand, flavoured yoghurt and puddings at 6 g sugar or 100 mg sodium. These limits were set to decide which desserts are fine to advertise to children, so they're a fair line for an everyday treat, not a personal limit.",
    condition_variants: [
      {
        condition: "diabetic",
        addendum:
          "Over its sugar limit, a dessert can push your blood glucose up more than the general line accounts for. Worth talking to your doctor or dietitian about how often it fits in.",
      },
    ],
    citations:
      "WHO Nutrient Profile Model for the South-East Asia Region (2017), food categories 7 and 8.",
  },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  const explainers = mongoose.model(RuleExplainer.name, RuleExplainerSchema);

  let upserted = 0;
  for (const entry of ENTRIES) {
    await explainers
      .updateOne(
        { rule_ids: entry.rule_ids[0] },
        { $set: entry },
        { upsert: true }
      )
      .exec();
    console.log(
      `upserted explainer "${entry.title}" (${entry.rule_ids.join(", ")})`
    );
    upserted += 1;
  }

  console.log(`\nDone. Upserted ${upserted} explainers.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
