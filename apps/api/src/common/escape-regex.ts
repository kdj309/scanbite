/** Escapes a string for safe interpolation into a RegExp — prevents a user-supplied search term from being parsed as regex syntax. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
