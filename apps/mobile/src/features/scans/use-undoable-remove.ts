import type { ListScansResponse, Scan } from "@foodscanner/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { labelCheckQueryKey } from "@/features/label/api";
import { recentScansQueryKey, refreshRecentScans, removeScan } from "./api";

/** How long "Undo" shows before the row is deleted for good. */
const UNDO_MS = 5000;

/**
 * Removing a Recent scans row with an Undo (design 1d): the row hides at
 * once, and the server deletes it only after the Undo has gone, so an
 * undo never needs the server. One removal waits at a time: removing
 * another, or leaving the screen, sends the waiting one straight away.
 */
export function useUndoableRemove() {
  const queryClient = useQueryClient();
  const [waiting, setWaiting] = useState<Scan>();
  const waitingRef = useRef<Scan | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const send = useCallback(
    (scan: Scan) => {
      // Gone from the list now, so it doesn't flash back before the refetch
      // (and no fetch already on its way can put it back).
      void queryClient.cancelQueries({ queryKey: recentScansQueryKey });
      queryClient.setQueryData<ListScansResponse>(
        recentScansQueryKey,
        (list) =>
          list && {
            ...list,
            items: list.items.filter((item) => item.id !== scan.id),
          }
      );
      if (scan.label_check_id) {
        queryClient.removeQueries({
          queryKey: labelCheckQueryKey(scan.label_check_id),
        });
      }
      // A failed delete shows the row again on the refetch.
      void removeScan(scan.id)
        .catch(() => undefined)
        .finally(() => refreshRecentScans(queryClient));
    },
    [queryClient]
  );

  const settle = useCallback(() => {
    clearTimeout(timer.current);
    waitingRef.current = undefined;
    setWaiting(undefined);
  }, []);

  const remove = useCallback(
    (scan: Scan) => {
      if (waitingRef.current) {
        send(waitingRef.current);
      }
      clearTimeout(timer.current);
      waitingRef.current = scan;
      setWaiting(scan);
      timer.current = setTimeout(() => {
        send(scan);
        settle();
      }, UNDO_MS);
    },
    [send, settle]
  );

  // Leaving the screen sends a waiting removal rather than dropping it.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (waitingRef.current) {
        send(waitingRef.current);
      }
    },
    [send]
  );

  return { waiting, remove, undo: settle };
}
