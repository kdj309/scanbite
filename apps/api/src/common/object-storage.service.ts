import { Injectable, Logger } from "@nestjs/common";

/** Stub S3 port — workers todo will swap in a real MinIO client. */
@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);

  async putLabelPhoto(key: string, _body: Buffer, contentType: string): Promise<string> {
    this.logger.debug(`stub put ${key} (${contentType}, ${_body.length} bytes)`);
    return key;
  }
}
