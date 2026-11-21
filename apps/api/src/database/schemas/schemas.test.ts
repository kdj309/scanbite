import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Schema } from "mongoose";
import * as schemas from "./index";

/** Every path that references another collection, nested ones included. */
function refPaths(schema: Schema, prefix = ""): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  schema.eachPath((path, type) => {
    const name = prefix + path;
    const options = type.options as { ref?: unknown };
    if (options.ref) {
      found.push([name, type.instance]);
    }
    const nested = (type as unknown as { schema?: Schema }).schema;
    if (nested) {
      found.push(...refPaths(nested, `${name}.`));
    }
  });
  return found;
}

describe("schemas", () => {
  // `type: Types.ObjectId` (not SchemaTypes.ObjectId) compiles to an untyped
  // path: ids were then stored as strings and lookups by ObjectId missed
  // them (a label check showed as "Unknown product").
  it("stores every reference to another collection as an ObjectId", () => {
    const refs = Object.entries(schemas)
      .filter(([, value]) => value instanceof Schema)
      .flatMap(([name, schema]) =>
        refPaths(schema as Schema).map(([path, instance]) => [
          `${name}.${path}`,
          instance,
        ])
      );
    assert.ok(refs.length >= 18, `found ${refs.length} references`);
    assert.deepEqual(
      refs.filter(([, instance]) => instance !== "ObjectId"),
      []
    );
  });
});
