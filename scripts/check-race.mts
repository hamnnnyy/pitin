import assert from "node:assert/strict";
import { pointAt } from "../src/lib/geometry.ts";
import {
  apply,
  asking,
  camActions,
  botStops,
  checkIn,
  botRows,
  classify,
  dailyFocus,
  dayKey,
  longestStint,
  catchUpSec,
  pickRival,
  asOf,
  rowOf,
  currentStint,
  nextDivision,
  SLOT,
  streak,
  finish,
  focusSec,
  hoursMinutes,
  goOff,
  HOUR,
  joinableSlot,
  lpFor,
  rank,
  ratio,
  resume,
  settle,
  type Race,
  type Row,
} from "../src/lib/race.ts";

const t0 = 10 * HOUR;
let r: Race = { kind: "gp", raceAt: t0, startedAt: t0, duration: 3600, off: null, offTotal: 0 };

// 10 min focus, 5 min pit, 5 min focus => 15/20 = 75%
r = goOff(r, t0 + 600_000, "pit");
assert.equal(focusSec(r, t0 + 900_000), 600);
r = resume(r, t0 + 900_000);
assert.equal(focusSec(r, t0 + 1_200_000), 900);
assert.equal(ratio(900, 1200), 0.75);

// off period that began before lights out only counts from the start
assert.equal(focusSec(goOff({ ...r, offTotal: 0 }, t0 - 5_000, "away"), t0 + 10_000), 0);

// time stops at the player's own end
assert.equal(focusSec(r, t0 + 99 * HOUR), 3600 - 300);

// schedule: late entry open for 15 min, then the next hour
assert.equal(joinableSlot(t0 + 14 * 60_000), t0);
assert.equal(joinableSlot(t0 + 16 * 60_000), t0 + SLOT);
assert.equal(SLOT, HOUR / 2);

// grid: bots fill to 20, deterministic per slot, sorted by ratio, me wins ties
const me = rowOf("me", "나", r, t0 + 1_200_000, true);
const bots = botRows(t0, 19, t0 + 1_200_000);
assert.deepEqual(bots.map((b) => b.name), botRows(t0, 19, t0 + 1_200_000).map((b) => b.name));
const rows = rank([...bots, me]);
assert.equal(rows.length, 20);
assert.ok(rows.every((x, i) => i === 0 || rows[i - 1].ratio >= x.ratio));
assert.equal(rank([{ ...me, ratio: 0.5 }, { ...bots[0], ratio: 0.5 }])[0].me, true);
for (let s = 0; s < 200; s++)
  for (const d of [1800, 7200]) {
    const stops = botStops(s, d);
    const pit = stops.reduce((a, [f, t]) => a + t - f, 0);
    assert.ok(stops.every(([f, t], i) => f >= (stops[i - 1]?.[1] ?? 0) && t <= d && f < t)); // in order, inside the race
    assert.ok(pit / d > 0.01 && pit / d < 0.45, `seed ${s}: ${pit / d}`); // ends between ~55% and ~99%
  }
assert.equal(botRows(t0, 19, t0).every((b) => b.ratio === 1 && !b.off), true); // everyone starts flat out

// LP: rank table, scaled for races under an hour, zero for retirements and practice
assert.equal(lpFor(r, 1), 25);
assert.equal(lpFor({ ...r, duration: 1800 }, 1), 13);
assert.equal(lpFor(finish(r, t0 + 60_000, true), 1), 0);
assert.equal(lpFor({ ...r, kind: "practice" }, 1), 0);

// check-ins: asked at 20 min, pit from the question if unanswered after 5 more
{
  const s0 = 1_000_000_000;
  const c: Race = { kind: "gp", raceAt: s0, startedAt: s0, duration: 3600, off: null, offTotal: 0 };
  assert.equal(asking(c, s0 + 19 * 60_000), false);
  assert.equal(asking(c, s0 + 20 * 60_000), true);
  assert.equal(settle(c, s0 + 24 * 60_000), c); // still in the grace window
  const missed = settle(c, s0 + 40 * 60_000);
  assert.deepEqual(missed.off, { since: s0 + 20 * 60_000, reason: "away" });
  assert.equal(focusSec(missed, s0 + 40 * 60_000), 20 * 60);
  const answered = checkIn(c, s0 + 22 * 60_000);
  assert.equal(settle(answered, s0 + 40 * 60_000), answered); // next question at 42 min
  assert.equal(resume(missed, s0 + 41 * 60_000).checkedAt, s0 + 41 * 60_000);
  // a question that comes after the chequered flag is never asked
  const short = { ...c, duration: 20 * 60 };
  assert.equal(settle(short, s0 + 30 * 60_000).off, null);
}

// camera mode: empty seat over a minute = pit from when it emptied, back in frame = back on track
{
  const s0 = 2_000_000_000;
  const c: Race = { kind: "gp", raceAt: s0, startedAt: s0, duration: 3600, off: null, offTotal: 0 };
  assert.deepEqual(camActions(c, s0 + 10_000, s0 + 50_000, false), []); // 40 s gone: still on track
  assert.deepEqual(camActions(c, s0 + 10_000, s0 + 80_000, false), [["seat", s0 + 10_000]]);
  const empty = apply(c, "seat", s0 + 80_000, s0 + 10_000);
  assert.deepEqual(empty.off, { since: s0 + 10_000, reason: "seat" });
  assert.deepEqual(camActions(empty, s0 + 10_000, s0 + 130_000, true), [["resume"]]);
  const back = apply(empty, "resume", s0 + 130_000);
  assert.equal(focusSec(back, s0 + 130_000), 10); // the 2 empty minutes are not focus
  // camera paused (app in background) for 5 min, then sees the player again
  assert.deepEqual(camActions(c, s0 + 60_000, s0 + 360_000, true), [["seat", s0 + 60_000], ["resume"]]);
  // a seat stop is never dated before the last comeback
  assert.equal(apply(back, "seat", s0 + 200_000, s0).off!.since, s0 + 130_000);
  // a pit stop the player chose is left alone; being seen keeps check-ins fresh
  assert.deepEqual(camActions(goOff(c, s0 + 1000, "pit"), s0 + 1000, s0 + 2000, true), []);
  assert.deepEqual(camActions(c, s0 + 299_000, s0 + 301_000, true), [["checkin"]]);
}

// actions after the player's end time close the race at that end time
{
  const s0 = 3_000_000_000;
  const c: Race = { kind: "gp", raceAt: s0, startedAt: s0, duration: 1800, off: { since: s0 + 1_500_000, reason: "pit" }, offTotal: 0 };
  const late = apply(c, "resume", s0 + 9_000_000);
  assert.equal(late.endedAt, s0 + 1_800_000);
  assert.equal(late.offTotal, 300_000); // only the pit time inside the race
  assert.equal(focusSec(late, s0 + 9_000_000), 1500);
  assert.equal(apply(c, "pit", s0 - 1), c); // nothing happens before lights out
}

// divisions
assert.equal(nextDivision("F3", 100), "F2");
assert.equal(nextDivision("F2", 150), "F1");
assert.equal(nextDivision("F1", 500), "F1");
assert.equal(nextDivision("F1", 19), "F2");
assert.equal(nextDivision("F3", 0), "F3");
assert.equal(nextDivision("F2", 50), "F2");

// bots differ between division grids of the same slot, and stay stable within one
assert.notDeepEqual(botRows(t0, 5, t0 + 600_000, 1).map((b) => b.ratio), botRows(t0, 5, t0 + 600_000, 2).map((b) => b.ratio));

// final classification: unfinished races are closed at the slot's end, retirements go last
{
  const full: Race = { kind: "gp", raceAt: t0, startedAt: t0, duration: 1800, off: null, offTotal: 0 }; // never ended on its device
  const quit = finish({ ...full, duration: 3600 }, t0 + 60_000, true);
  const res = classify(t0, [{ id: "a", race: full }, { id: "b", race: quit }]);
  const a = res.find((x) => x.id === "a")!;
  const b = res.find((x) => x.id === "b")!;
  assert.equal(a.pos, 1); // 100% beats every bot
  assert.equal(a.lp, 13); // 25 LP scaled for a 30 min race
  assert.equal(b.pos, 20);
  assert.equal(b.lp, 0);
  assert.equal(a.race.endedAt, t0 + 1_800_000);
}

// race report: off periods are logged, longest unbroken stint
{
  let x: Race = { kind: "gp", raceAt: t0, startedAt: t0, duration: 3600, off: null, offTotal: 0 };
  x = resume(goOff(x, t0 + 600_000, "pit"), t0 + 900_000); // focus 0-10, off 10-15
  x = resume(goOff(x, t0 + 2_700_000, "seat"), t0 + 2_760_000); // focus 15-45, off 45-46
  x = finish(x, t0 + 3_600_000);
  assert.equal(x.offs!.length, 2);
  assert.equal(longestStint(x), 1800);
}

// study log: days and streaks
{
  const day = 86_400_000;
  const noon = new Date(2026, 9, 12, 12).getTime();
  const log = dailyFocus([
    { started_at: noon, focus_sec: 1200 },
    { started_at: noon - day, focus_sec: 300 },
    { started_at: noon - day, focus_sec: 400 }, // 700 s that day: counts
    { started_at: noon - 2 * day, focus_sec: 100 }, // too short, breaks the streak
    { started_at: noon - 3 * day, focus_sec: 5000 },
  ]);
  assert.equal(log.get(dayKey(noon - day)), 700);
  assert.equal(streak(log, noon), 2);
  assert.equal(streak(log, noon + day), 2); // today not started yet: yesterday still counts
  assert.equal(streak(log, noon + 2 * day), 0);
}

// distance: one lap per 2 focused minutes

// polyline walk: square of side 10, quarter = next corner, wraps past 1
const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
assert.deepEqual(pointAt(sq, 0.25), [10, 0]);
assert.deepEqual(pointAt(sq, 0.125), [5, 0]);
assert.deepEqual(pointAt(sq, 1.5), [10, 10]);

assert.equal(hoursMinutes(7200), "2시간");
assert.equal(hoursMinutes(4500), "1시간 15분");
assert.equal(hoursMinutes(600), "10분");

{
  // 40 of 50 min focused (80%), car ahead at 90%: (2400 + t) / (3000 + t) = 0.9 at t = 3000 s
  assert.equal(Math.round(catchUpSec(2400, 3000, 0.9, 4000)!), 3000);
  assert.equal(catchUpSec(2400, 3000, 0.9, 2000), null); // flag falls first
  assert.equal(catchUpSec(2400, 3000, 1, 9999), null); // a perfect car can't be passed
  assert.equal(catchUpSec(2900, 3000, 0.9, 100), 0); // already ahead on ratio
  const r: Race = { kind: "gp", raceAt: 0, startedAt: 0, duration: 3600, off: null, offTotal: 60_000, offs: [[600_000, 660_000, "pit"]] };
  assert.equal(currentStint(r, 900_000), 240);
  assert.equal(currentStint({ ...r, off: { since: 800_000, reason: "pit" } }, 900_000), 0);
  assert.equal(currentStint({ ...r, offs: [] }, 900_000), 900);
}

{
  // Track distance follows the standings: ratio × time since lights out, frozen while in the pits.
  const M = 60_000;
  const base: Race = { kind: "gp", raceAt: 0, startedAt: 0, duration: 3600, off: null, offTotal: 0 };
  const late: Race = { ...base, startedAt: 10 * M }; // joined 10 min late, never stopped: 100%
  const pitted: Race = { ...base, off: { since: 20 * M, reason: "pit" } }; // 20 min in, still in the pits
  const now = 30 * M;
  const [a, b, c] = [rowOf("a", "", base, now), rowOf("b", "", late, now), rowOf("c", "", pitted, now)];
  assert.equal(a.laps, 30); // 30 min at 100%, a minute a lap
  assert.equal(b.laps, 30); // same ratio, same clock, same place
  assert.equal(c.laps, 20); // parked where it pulled in at 20 min
  assert.equal(rowOf("c", "", pitted, now + 10 * M).laps, 20);
  assert.ok(c.ratio < a.ratio && c.laps < a.laps);
}

{
  // Looking back: a pit from 10 to 15 min, back on track since.
  const M = 60_000;
  const r: Race = { kind: "gp", raceAt: 0, startedAt: 0, duration: 3600, off: null, offTotal: 5 * M, offs: [[10 * M, 15 * M, "pit"]] };
  assert.equal(asOf(r, 30 * M), r); // nothing after t: unchanged
  assert.equal(focusSec(asOf(r, 8 * M), 8 * M), 480); // before the pit
  assert.equal(focusSec(asOf(r, 12 * M), 12 * M), 600); // in the pit
  assert.equal(asOf(r, 12 * M).off?.since, 10 * M);
  assert.equal(focusSec(asOf(r, 20 * M), 20 * M), 900);
}

{
  const row = (id: string, ratio: number, extra: Partial<Row> = {}): Row => ({ id, name: id, ratio, focus: 0, pos: 0, laps: 0, ...extra });
  const grid = [row("me", 0.8, { me: true }), row("b1", 0.81, { bot: true }), row("b2", 0.95, { bot: true }), row("p1", 0.83)];
  assert.equal(pickRival(grid), "p1"); // a person 3%p away beats a bot 1%p away
  assert.equal(pickRival(grid.filter((r) => r.id !== "p1")), "b1");
  assert.equal(pickRival(grid.filter((r) => !r.me)), undefined);
  // a bot still flat out early on is judged on where it will finish
  assert.equal(pickRival([row("me", 0.8, { me: true }), row("fast", 1, { bot: true, pace: 0.96 }), row("slow", 1, { bot: true, pace: 0.79 })]), "slow");
}

console.log("race ok");
