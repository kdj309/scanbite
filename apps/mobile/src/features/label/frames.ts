import { SaveFormat, ImageManipulator } from "expo-image-manipulator";
import { createVideoPlayer } from "expo-video";
import { Platform } from "react-native";

/** Frames sent from a label video; the API takes up to 5 images. */
const FRAME_COUNT = 5;

/** How long the video prompts hold each side; the front comes first. */
export const SIDE_SECONDS = 2;

/** Labels stay readable at this width; smaller files upload faster. */
const MAX_WIDTH = 1280;

/**
 * One frame from the middle of the front (the first side the prompts ask
 * for, so the name can be read), the rest spread evenly over the other
 * sides, away from the very end (the pack is usually moving out of view).
 */
export function frameTimes(durationSeconds: number, count = FRAME_COUNT) {
  const rest = durationSeconds - SIDE_SECONDS;
  return [
    SIDE_SECONDS / 2,
    ...Array.from(
      { length: count - 1 },
      (_, i) => SIDE_SECONDS + (rest * (i + 1)) / count
    ),
  ];
}

/**
 * Takes frames from a recorded label video and saves them as JPEGs.
 * `durationSeconds` is how long we recorded, so the video needn't load.
 */
export async function videoFrames(
  videoUri: string,
  durationSeconds: number
): Promise<string[]> {
  const player = createVideoPlayer({ uri: frameSourceUri(videoUri) });
  try {
    const thumbnails = await player.generateThumbnailsAsync(
      frameTimes(durationSeconds),
      { maxWidth: MAX_WIDTH }
    );
    return await inTurn(thumbnails, (frame) => saveJpeg(frame));
  } finally {
    player.release();
  }
}

/**
 * expo-video on Android drops "file://" and reads the rest as a path
 * without decoding it, so a folder like Expo Go's "%40anonymous%2F…"
 * (encoded as %2540…) isn't found. Decoded once, it's the real path.
 */
function frameSourceUri(uri: string): string {
  return Platform.OS === "android" ? decodeURIComponent(uri) : uri;
}

/** A photo, made smaller so the upload is quick. */
export function shrinkPhoto(uri: string): Promise<string> {
  return saveJpeg(uri);
}

async function saveJpeg(
  source: Parameters<typeof ImageManipulator.manipulate>[0]
): Promise<string> {
  // Kept in a variable and released when done: a context nothing refers to
  // can be cleaned up mid-render, which cancels it ("X was cancelled").
  const context = ImageManipulator.manipulate(source);
  try {
    const image = await context.resize({ width: MAX_WIDTH }).renderAsync();
    try {
      const { uri } = await image.saveAsync({
        compress: 0.75,
        format: SaveFormat.JPEG,
      });
      return uri;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** One image at a time: several renders at once is what got cancelled. */
export async function inTurn<T, R>(
  items: readonly T[],
  each: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await each(item));
  }
  return results;
}
