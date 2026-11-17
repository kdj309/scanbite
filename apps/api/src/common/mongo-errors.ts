import type { MongoCodedError } from "./mongo-errors.types";

/** True for a MongoDB duplicate-key error (E11000), e.g. a unique-index race. */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as MongoCodedError).code === 11000
  );
}
