"use client";

import { useLayoutEffect, useRef } from "react";
import { pct, type Row } from "@/lib/race";

/**
 * F1-broadcast style timing tower: position, driver, focus ratio, gap to the leader in %p.
 * When the order changes, rows slide to their new place (the passing car rises over the one it passed),
 * and a row that moved shows ▲/▼ with the places gained or lost.
 * `before`: positions a few seconds ago. `rival`: id of my rival this race.
 */
export function Tower({
  rows,
  gap = true,
  drs = false,
  before,
  rival,
}: {
  rows: Row[];
  gap?: boolean;
  drs?: boolean;
  before?: Map<string, number>;
  rival?: string;
}) {
  const lead = rows[0]?.ratio ?? 1;
  const moved = (r: Row) => (before?.get(r.id) ?? r.pos) - r.pos;

  // FLIP: remember where each row was, and slide it from there after the reorder.
  const list = useRef<HTMLOListElement>(null);
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const li of el.children as HTMLCollectionOf<HTMLElement>) {
      const key = li.dataset.key!;
      next.set(key, li.offsetTop);
      const was = tops.current.get(key);
      if (was === undefined || was === li.offsetTop || still) continue;
      li.style.zIndex = was > li.offsetTop ? "2" : "1"; // the car moving up goes over the one moving down
      li.animate([{ transform: `translateY(${was - li.offsetTop}px)` }, { transform: "none" }], {
        duration: 1600,
        easing: "cubic-bezier(.45,0,.2,1)",
      }).onfinish = () => (li.style.zIndex = "");
    }
    tops.current = next;
  });

  return (
    <ol ref={list} className="font-num text-lg leading-none">
      {rows.map((r) => {
        const m = moved(r);
        return (
          <li
            key={r.id}
            data-key={r.id}
            className={`relative flex h-9 items-center gap-2 border-l-4 px-3 ${r.me ? "border-brand bg-row-me" : r.id === rival ? "border-leader bg-row" : "border-transparent odd:bg-row"} ${m > 0 ? "animate-[gain_3s_ease-out]" : m < 0 ? "animate-[lose_3s_ease-out]" : ""} motion-reduce:animate-none`}
          >
            <span className="w-5 text-right font-bold tabular-nums">{r.pos}</span>
            <span className={`w-7 text-[11px] leading-none tabular-nums ${m > 0 ? "text-go" : "text-light"}`} aria-hidden={!m}>
              {m > 0 ? `▲${m}` : m < 0 ? `▼${-m}` : ""}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 font-sans text-[15px]">
              <span className="truncate">{r.name}</span>
              {r.bot && <span className="rounded bg-row-me px-1 text-[10px] leading-4 text-muted">AI</span>}
              {r.id === rival && <span className="rounded bg-leader px-1 text-[10px] leading-4 font-bold">라이벌</span>}
              {r.me && drs && <span className="rounded bg-go px-1 text-[10px] leading-4 font-bold text-black">DRS</span>}
              {r.off && !r.done && <span className="rounded bg-pit px-1 text-[10px] leading-4 text-black">PIT</span>}
              {r.done && <span className="text-[11px] text-subtle">완주</span>}
            </span>
            <span className={`w-12 text-right tabular-nums ${r.pos === 1 ? "text-leader" : ""}`}>{pct(r.ratio)}</span>
            {gap && (
              <span className="w-11 text-right text-muted tabular-nums">
                {r.pos === 1 ? "리더" : lead - r.ratio < 0.0005 ? "0.0" : `-${pct(lead - r.ratio)}`}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
