import type { Href } from "expo-router";
import type { PushData } from "./push.types";

/**
 * Where tapping a "your label is read" notification goes (the API's
 * push-notifier sets the data): a label check opens its result, a new
 * product its verdict. "Couldn't read" opens the scanner to try again;
 * "taking a closer look" has nothing to show yet, so Home.
 */
export function routeForPush(data: PushData): Href {
  if (data.event === "failed") {
    return "/scan";
  }
  if (data.event === "ready" && data.label_check_id) {
    return {
      pathname: "/label-check/[id]",
      params: { id: data.label_check_id },
    };
  }
  if (data.event === "ready" && data.barcode) {
    return {
      pathname: "/product/[barcode]",
      params: { barcode: data.barcode },
    };
  }
  return "/";
}
