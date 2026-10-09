import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * The route works with or without an access token. With no Authorization
 * header the request goes through anonymously; a header that is present but
 * invalid or expired is still rejected (401) — never silently ignored.
 */
export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
