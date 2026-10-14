"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** A strip across the top while the device has no connection. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <p role="status" className="sticky top-0 z-20 bg-pit px-4 py-2 text-center text-sm text-black">
      인터넷 연결이 끊겼어요. 그동안 누른 피트인은 연결되면 누른 시각으로 반영돼요.
    </p>
  );
}

/** Placeholder blocks shown while the first data loads. */
export function Skeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl animate-pulse flex-col gap-4 px-4 pt-6 md:px-10 md:pt-10" aria-label="불러오는 중">
      <div className="h-8 w-40 rounded-lg bg-row" />
      <div className="h-24 rounded-xl bg-row" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-xl bg-row" />
        <div className="h-64 rounded-xl bg-row" />
      </div>
    </div>
  );
}
