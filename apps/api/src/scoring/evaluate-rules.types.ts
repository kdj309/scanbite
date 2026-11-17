/** What passedRules needs to know about the product. */
export type PassedRulesProduct = {
  productForm: unknown;
  /** There's an ingredient list and every item was recognised. If not,
   *  an ingredient rule's "not found" (e.g. no palm oil) can't be
   *  confirmed, so it hasn't passed. */
  allIngredientsRecognised: boolean;
};
