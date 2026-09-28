import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class NoopNotifier {
  private readonly logger = new Logger(NoopNotifier.name);

  notify(input: { userId: string; submissionId: string; event: string }): void {
    this.logger.log(
      `stub notify user=${input.userId} submission=${input.submissionId} event=${input.event}`
    );
  }
}
