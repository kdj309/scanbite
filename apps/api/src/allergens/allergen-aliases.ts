import type { AllergenCode } from "@foodscanner/shared";
import { aliasList, type AliasList } from "../common/alias-match";

/**
 * How each allergen shows up in Indian ingredient lists, in English and
 * common Hindi/regional names. Reviewed 2026-10-12. Safety-critical: a
 * missed name is a missed allergen, so add names from real labels.
 *
 * `include`: any match means the allergen is present.
 * `exclude`: phrases removed BEFORE matching, for look-alikes that aren't
 * the allergen ("coconut milk" isn't dairy, "cocoa butter" isn't butter).
 * Matching is case-insensitive on one ingredient at a time.
 */
export const ALLERGEN_ALIASES: Record<AllergenCode, AliasList> = {
  peanuts: aliasList({
    include: [
      /\bpea ?nuts?\b/,
      /\bground ?nuts?\b/, // the usual Indian name, incl. groundnut oil
      /\barachis\b/,
      /\bmoong ?phali\b/,
      /\bmung ?fali\b/,
    ],
  }),
  tree_nuts: aliasList({
    include: [
      /\balmonds?\b/,
      /\bbadam\b/,
      /\bcashews?\b/,
      /\bkaju\b/,
      /\bpistachios?\b/,
      /\bpista\b/,
      /\bwalnuts?\b/,
      /\bakhrot\b/,
      /\bhazel ?nuts?\b/,
      /\bpecans?\b/,
      /\bmacadamias?\b/,
      /\bbrazil ?nuts?\b/,
      /\bpine ?nuts?\b/,
      /\bchilgoza\b/,
      /\bnuts?\b/, // "mixed nuts", "nut pieces" — after the excludes below
    ],
    exclude: [
      /\bpea ?nuts?\b/,
      /\bground ?nuts?\b/,
      /\bcoco ?nuts?\b/,
      /\bareca ?nuts?\b/,
      /\bbetel ?nuts?\b/,
    ],
  }),
  milk: aliasList({
    include: [
      /\bmilk\b/,
      /\bbutter ?milk\b/,
      /\bwhey\b/,
      /\bcasein(ates?)?\b/,
      /\blactose\b/,
      /\bghee\b/,
      /\bbutter\b/,
      /\bcream\b/,
      /\bcheese\b/,
      /\bpaneer\b/,
      /\bchh?e(n|nn)a\b/,
      /\bkho(y)?a\b/,
      /\bmawa\b/,
      /\bmalai\b/,
      /\bcurd\b/,
      /\bdahi\b/,
      /\byogh?urt\b/,
      /\bdairy\b/,
    ],
    exclude: [
      /\b(coconut|soya?|almond|oat|rice|cashew|peanut) ?milk\b/,
      /\b(cocoa|cacao|peanut|shea|nut|almond|cashew|kokum|mango) ?butter\b/,
      /\bcream of tartar\b/,
      /\bnon[- ]?dairy\b/,
      /\b(milk|dairy|lactose)[- ]?free\b/,
    ],
  }),
  gluten: aliasList({
    include: [
      /\bwheat\b/,
      /\bmaida\b/,
      /\batta\b/,
      /\bsu(j|oj|o)i\b/,
      /\bra(v|w)a\b/,
      /\bsemolina\b/,
      /\bdal(i)?ya\b/,
      /\bbarley\b/,
      /\brye\b/,
      /\boats?\b/, // FSSAI lists oats with the gluten cereals
      /\bspelt\b/,
      /\bmalt\b/, // barley malt; maltodextrin/maltose don't match
      /\bgluten\b/,
      /\bseitan\b/,
    ],
    exclude: [/\bbuckwheat\b/, /\bgluten[- ]?free\b/],
  }),
  egg: aliasList({
    include: [/\beggs?\b/, /\balbumen\b/, /\bovalbumin\b/, /\bmayonnaise\b/],
    exclude: [/\begg ?plant\b/, /\begg[- ]?free\b/],
  }),
  fish: aliasList({
    include: [
      /\bfish\b/,
      /\banchov(y|ies)\b/,
      /\btuna\b/,
      /\bsardines?\b/,
      /\bmackerel\b/,
      /\bsalmon\b/,
      /\bcod\b/,
      /\bbombil\b/,
      /\bsurimi\b/,
    ],
    exclude: [/\bshell ?fish\b/],
  }),
  shellfish: aliasList({
    include: [
      /\bcrustaceans?\b/, // FSSAI's and Codex's own word on "Contains" lines
      /\bprawns?\b/,
      /\bshrimps?\b/,
      /\bcrabs?\b/,
      /\blobsters?\b/,
      /\bcrayfish\b/,
      /\bshell ?fish\b/,
      /\bmussels?\b/,
      /\boysters?\b/,
      /\bclams?\b/,
      /\bsquid\b/,
    ],
  }),
  soy: aliasList({
    include: [/\bsoy(a|abeans?|beans?)?\b/, /\btofu\b/, /\bedamame\b/],
  }),
  sesame: aliasList({
    include: [/\bsesame\b/, /\btil\b/, /\bgingelly\b/, /\btahini\b/],
  }),
  mustard: aliasList({
    include: [/\bmustard\b/, /\brai\b/, /\bsarson\b/],
  }),
  sulphites: aliasList({
    include: [
      /\bsul(ph|f)ites?\b/,
      /\bmetabisul(ph|f)ites?\b/,
      /\bsul(ph|f)ur dioxide\b/,
      /\b(ins|e) ?22[0-8]\b/, // INS 220–228
      /\(\s*22[0-8]\s*\)/, // "Preservative (223)"
    ],
  }),
};
