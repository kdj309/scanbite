import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Tracks by authenticated user id when the request has one (precise —
 * rate-limits a specific account regardless of which IP it calls from, so
 * one compromised/malicious account can't run up vision-LLM cost by
 * rotating IPs), falling back to IP for unauthenticated routes like
 * signup/login. Written defensively rather than assuming JwtAuthGuard has
 * already populated req.user by the time this runs — NestJS doesn't
 * guarantee ordering across multiple APP_GUARD providers from different
 * modules, so this degrades to IP-based tracking if user isn't set yet
 * rather than erroring.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { userId?: string } | undefined;
    if (user?.userId) {
      return `user:${user.userId}`;
    }
    return `ip:${req.ip as string}`;
  }
}
