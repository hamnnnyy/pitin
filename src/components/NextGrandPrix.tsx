"use client";

import { Countdown } from "@/components/Countdown";
import { circuitFor } from "@/lib/circuits";
import { hhmm, SLOT, slotOf } from "@/lib/race";
import { useNow } from "@/lib/useNow";

/** "다음 그랑프리 15:00 몬차까지 12:34" — computed on the client, since the page itself is static. */
export function NextGrandPrix() {
  const now = useNow(1000);
  if (!now) return <span className="invisible">--</span>;
  const at = slotOf(now) + SLOT;
  return (
    <>
      {hhmm(at)} {circuitFor(at).name} 그랑프리까지{" "}
      <span className="font-num text-lg text-fg">
        <Countdown at={at} />
      </span>
    </>
  );
}
