import { useSyncExternalStore } from "react";

const subs = new Map<number, (cb: () => void) => () => void>();

/** Current time quantised to `tick` ms so the snapshot is stable between renders; 0 on the server. */
export function useNow(tick = 250) {
  if (!subs.has(tick))
    subs.set(tick, (cb) => {
      const id = setInterval(cb, tick);
      return () => clearInterval(id);
    });
  return useSyncExternalStore(subs.get(tick)!, () => Math.floor(Date.now() / tick) * tick, () => 0);
}
