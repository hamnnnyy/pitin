"use client";

import { clock } from "@/lib/race";
import { useNow } from "@/lib/useNow";

/** Live countdown to `at` (epoch ms). */
export function Countdown({ at }: { at: number }) {
  const now = useNow(1000);
  return <span className="tabular-nums">{now ? clock((at - now) / 1000) : "--:--"}</span>;
}
