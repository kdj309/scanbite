export type AliasMatch = {
  ingredientId: string;
};

export function normalizeAliasText(raw: string): string {
  return raw.trim().toLowerCase();
}
