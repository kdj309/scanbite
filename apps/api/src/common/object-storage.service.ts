import { Injectable } from "@nestjs/common";
import { S3StorageService } from "./s3-storage.service";

const LABEL_PHOTO_URL_TTL_SECONDS = 15 * 60;

@Injectable()
export class ObjectStorageService {
  constructor(private readonly s3: S3StorageService) {}

  async putLabelPhoto(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<string> {
    await this.s3.putObject(key, body, contentType);
    return key;
  }

  getLabelPhoto(key: string): Promise<Buffer | undefined> {
    return this.s3.getObject(key);
  }

  deleteLabelPhoto(key: string): Promise<void> {
    return this.s3.deleteObject(key);
  }

  /** A temporary URL for showing a submitted label photo (e.g. to a reviewer). */
  labelPhotoUrl(key: string): Promise<string> {
    return this.s3.getPresignedUrl(key, LABEL_PHOTO_URL_TTL_SECONDS);
  }
}
