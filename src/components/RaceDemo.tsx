"use client";

import { Tower } from "@/components/Tower";
import { TrackMap, toCars } from "@/components/TrackMap";
import { CIRCUITS } from "@/lib/circuits";
import { botRows, clock, GRID_SIZE, type Race, rank, rowOf } from "@/lib/race";
import { useNow } from "@/lib/useNow";

const SPEED = 60; // a 2-hour grand prix replayed in 2 minutes
const DURATION = 7200;
const PIT = [2400, 3000]; // "you" take a 10-minute break 40 minutes in

/** Landing-page replay of a full grand prix, with a pit stop so the ranking rule is visible. */
export function RaceDemo() {
  const now = useNow(100);
  const t = ((now / 1000) * SPEED) % DURATION;
  const pit = t >= PIT[0] && t < PIT[1];
  const race: Race = {
    kind: "gp",
    raceAt: 0,
    startedAt: 0,
    duration: DURATION,
    off: pit ? { since: PIT[0] * 1000, reason: "pit" } : null,
    offTotal: t >= PIT[1] ? (PIT[1] - PIT[0]) * 1000 : 0,
  };
  const rows = rank([rowOf("me", "나", race, t * 1000, true), ...botRows(0, GRID_SIZE - 1, t * 1000)]);
  const me = rows.find((r) => r.me)!;
  const shown = rows.filter((r) => r.pos <= 4 || r.me);
  const circuit = CIRCUITS[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-row-me bg-bg">
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-light" />
          {circuit.name} 그랑프리
        </span>
        <span className="font-num text-lg text-muted tabular-nums">{clock(t)} / 2:00:00</span>
      </div>
      <TrackMap circuit={circuit} cars={toCars(rows)} className="max-h-80" />
      <p
        className={`flex h-9 items-center px-4 text-sm ${pit ? "bg-pit text-black" : "text-go"}`}
        aria-live="off"
      >
        {pit ? "피트인 중이에요. 내 차가 멈추고 순위가 내려가요." : `집중 중. 현재 P${me.pos}, 집중 비율 ${(me.ratio * 100).toFixed(1)}%`}
      </p>
      <Tower rows={shown} />
      <p className="px-4 py-3 text-xs text-subtle">2시간 레이스를 2분으로 빨리 감은 화면이에요.</p>
    </div>
  );
}
