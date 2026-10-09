import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from "./public.decorator";

function contextFor(
  flags: Record<string, boolean>,
  headers: Record<string, string>
): { guard: JwtAuthGuard; context: ExecutionContext } {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(flags)) {
    Reflect.defineMetadata(key, value, handler);
  }
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
  return { guard: new JwtAuthGuard(new Reflector()), context };
}

describe("JwtAuthGuard", () => {
  it("lets public routes through", () => {
    const { guard, context } = contextFor({ [IS_PUBLIC_KEY]: true }, {});
    assert.equal(guard.canActivate(context), true);
  });

  it("lets optional-auth routes through when no token is sent", () => {
    const { guard, context } = contextFor({ [IS_OPTIONAL_AUTH_KEY]: true }, {});
    assert.equal(guard.canActivate(context), true);
  });

  it("still checks a token that is sent to an optional-auth route", async () => {
    const { guard, context } = contextFor(
      { [IS_OPTIONAL_AUTH_KEY]: true },
      { authorization: "Bearer not-a-real-token" }
    );
    await assert.rejects(async () => guard.canActivate(context));
  });
});
