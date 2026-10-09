import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (this.flag(IS_PUBLIC_KEY, context)) {
      return true;
    }
    if (this.flag(IS_OPTIONAL_AUTH_KEY, context)) {
      const request = context
        .switchToHttp()
        .getRequest<{ headers: Record<string, string | undefined> }>();
      if (!request.headers.authorization) {
        return true;
      }
    }
    return super.canActivate(context);
  }

  private flag(key: string, context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(key, [
        context.getHandler(),
        context.getClass(),
      ])
    );
  }
}
