import { ObjectStorageService } from "../../common/object-storage.service";

export type PhotoPayload = { base64: string; mediaType: string };

export async function loadPhotosAsBase64(
  storage: ObjectStorageService,
  photoKeys: string[]
): Promise<PhotoPayload[]> {
  return Promise.all(
    photoKeys.map(async (key) => {
      const buffer = await storage.getLabelPhoto(key);
      if (!buffer) {
        throw new Error(`Photo not found in object storage: ${key}`);
      }
      return {
        base64: buffer.toString("base64"),
        mediaType: mediaTypeFromKey(key),
      };
    })
  );
}

function mediaTypeFromKey(key: string): string {
  switch (key.split(".").pop()?.toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}
