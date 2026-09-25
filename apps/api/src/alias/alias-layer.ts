export type AliasMatch = {
  ingredientId: string;
  layer: 1 | 2 | 3;
};

export interface AliasLayer {
  resolve(raw: string): Promise<AliasMatch | null>;
}

export function normalizeAliasText(raw: string): string {
  return raw.trim().toLowerCase();
}
