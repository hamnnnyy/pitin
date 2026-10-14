import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { circuitFor } from "./circuits";
import { classify, focusSec, gridOf, longestStint, type Division, type Off, type Race } from "./race";

// Server side: the public result behind a shared /r/[id] link.

type Row = {
  id: number;
  started_at: number;
  duration: number;
  off_since?: number | null;
  off_reason?: Off["reason"] | null;
  off_total: number;
  ended_at: number | null;
  retired: boolean;
};
type CardEntry = Row & {
  kind: "gp" | "practice";
  division: Division;
  classified: boolean;
  race_at: number;
  name: string;
  offs: NonNullable<Race["offs"]>;
  final_pos: number | null;
  final_ratio: number | null;
  focus_sec: number | null;
  lp: number;
};

const toRace = (e: Row, kind: Race["kind"], raceAt: number): Race => ({
  kind,
  raceAt,
  startedAt: e.started_at,
  duration: e.duration,
  off: e.off_since && e.off_reason ? { since: e.off_since, reason: e.off_reason } : null,
  offTotal: e.off_total,
  endedAt: e.ended_at ?? undefined,
  retired: e.retired,
});

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false },
});

/** "10/12 15:00" in Korean time, whatever the server's zone. */
function kst(ms: number) {
  const d = new Date(ms + 9 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export type Card = NonNullable<Awaited<ReturnType<typeof loadCard>>>;

/** null when no finished race is shared under that id. */
export const loadCard = cache(async (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const { data } = await db.rpc("result_card", { p_share: id });
  if (!data) return null;
  const e = data.entry as CardEntry;
  const race = { ...toRace(e, e.kind, e.race_at), offs: e.offs };
  const gp = e.kind === "gp";

  // Until the whole grid is in, project the result the same way the final classification will.
  let pos = e.final_pos;
  let lp = e.lp;
  if (gp && !e.classified) {
    const grid = (data.grid as Row[]).map((g) => ({ id: String(g.id), race: toRace(g, "gp", e.race_at) }));
    const mine = classify(e.race_at, grid, gridOf(e.division)).find((x) => x.id === String(e.id))!;
    pos = mine.pos;
    lp = mine.lp;
  }
  const end = e.ended_at!;
  const span = Math.max(1, end - e.started_at);
  const focus = e.focus_sec ?? focusSec(race, end);

  return {
    name: e.name,
    gp,
    retired: e.retired,
    provisional: gp && !e.classified,
    place: e.retired ? "DNF" : gp ? `P${pos}` : "완주",
    title: gp ? `${circuitFor(e.race_at).name} 그랑프리` : "연습 주행",
    circuit: gp ? circuitFor(e.race_at) : null,
    division: e.division,
    date: kst(e.started_at),
    ratio: e.final_ratio ?? Math.min(1, (focus * 1000) / span),
    focus,
    lp,
    stint: longestStint(race),
    // Off periods as fractions of the race, for the timeline bar.
    offs: e.offs.map(([since, until]) => [(since - e.started_at) / span, (until - since) / span] as const),
  };
});
