// Race model: rank = focus time / race time elapsed. Pure functions, timestamps in epoch ms.

/** pit: the player pressed pit; away: a check-in went unanswered; seat: the camera saw an empty seat. */
export type Off = { since: number; reason: "pit" | "away" | "seat" };

export type Race = {
  kind: "gp" | "practice";
  raceAt: number; // grand prix hour slot; for practice, the moment it was created
  startedAt: number;
  duration: number; // seconds, chosen by each player
  off: Off | null; // currently not focusing
  offTotal: number; // ms of finished off periods
  endedAt?: number; // set on finish or retire
  retired?: boolean;
  checkedAt?: number; // last time the player confirmed they were studying; startedAt until then
  offs?: [since: number, until: number, reason: Off["reason"]][]; // finished off periods, for the race report
  division?: "F1" | "F2" | "F3"; // the grid raced on (an invite can put a player on a friend's grid)
};

export const HOUR = 3_600_000;
/** A grand prix starts every half hour. */
export const SLOT = 30 * 60_000;
/** Grid stays open this long after lights out; late starters race from when they join. */
export const LATE_JOIN_MS = 15 * 60_000;
export const GRID_SIZE = 20;
/** A full-focus car laps every minute, whatever the circuit: quick enough to see the cars move. */
export const LAP_SEC = 60;
export const DURATIONS = [30, 60, 90, 120]; // minutes offered on the grid
/** Everyone who could have joined has reached the chequered flag by then; the result becomes final. */
export const CLASSIFY_AFTER = LATE_JOIN_MS + Math.max(...DURATIONS) * 60_000;
export const LP_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const slotOf = (now: number) => Math.floor(now / SLOT) * SLOT;

/** The grand prix you can enter right now: the running one while late entry is open, else the next. */
export function joinableSlot(now: number) {
  const cur = slotOf(now);
  return now - cur < LATE_JOIN_MS ? cur : cur + SLOT;
}

export function raceEnd(r: Pick<Race, "startedAt" | "duration" | "endedAt">) {
  return Math.min(r.endedAt ?? Infinity, r.startedAt + r.duration * 1000);
}

export function elapsedSec(r: Race, now: number) {
  return Math.max(0, Math.min(now, raceEnd(r)) - r.startedAt) / 1000;
}

export function focusSec(r: Race, now: number) {
  const end = Math.min(now, raceEnd(r));
  const current = r.off ? Math.max(0, end - Math.max(r.off.since, r.startedAt)) : 0;
  return Math.max(0, end - r.startedAt - r.offTotal - current) / 1000;
}

/** Everyone starts at 100%; under 1s there is nothing to divide yet. */
export function ratio(focus: number, elapsed: number) {
  return elapsed < 1 ? 1 : Math.min(1, focus / elapsed);
}

/** Ends the current off period (pit or away) and folds it into offTotal. Coming back counts as a check-in. */
export function resume(r: Race, now: number): Race {
  if (!r.off) return r;
  const since = Math.max(r.off.since, r.startedAt);
  return {
    ...r,
    off: null,
    offTotal: r.offTotal + Math.max(0, now - since),
    checkedAt: now,
    offs: [...(r.offs ?? []), [since, now, r.off.reason]],
  };
}

export function goOff(r: Race, now: number, reason: Off["reason"]): Race {
  return r.off ? r : { ...r, off: { since: now, reason } };
}

// ---- Check-ins: a phone face down still counts as focus, as long as the player answers now and then ----

export const CHECK_SEC = 20 * 60;
/** Time to answer before the car goes to the pit, counted from when the question was asked. */
export const GRACE_SEC = 5 * 60;

export const checkDue = (r: Race) => (r.checkedAt ?? r.startedAt) + CHECK_SEC * 1000;
export const checkIn = (r: Race, now: number): Race => ({ ...r, checkedAt: now });
export const asking = (r: Race, now: number) => !r.off && !r.endedAt && now >= checkDue(r);

/** An unanswered check puts the car in the pit from the moment the question was asked. */
export function settle(r: Race, now: number): Race {
  const due = checkDue(r);
  return asking(r, now) && now >= due + GRACE_SEC * 1000 && due < raceEnd(r) ? goOff(r, due, "away") : r;
}

// ---- Camera mode: an empty seat for over a minute is a pit stop from the moment it emptied ----

export const SEAT_GRACE_MS = 60_000;
const CAM_CHECKIN_MS = 5 * 60_000; // being seen counts as a check-in, refreshed this often

/** What one camera frame asks the server to do. `lastSeen` is the last frame the player was in. */
export function camActions(r: Race, lastSeen: number, now: number, present: boolean): [Action, number?][] {
  if (r.endedAt) return [];
  const gone = !r.off && now - lastSeen > SEAT_GRACE_MS;
  if (!present) return gone ? [["seat", lastSeen]] : [];
  if (gone) return [["seat", lastSeen], ["resume"]]; // the camera was paused (app in background) for a while
  if (r.off && r.off.reason !== "pit") return [["resume"]]; // a pit stop the player chose ends with the player
  if (!r.off && now - (r.checkedAt ?? r.startedAt) > CAM_CHECKIN_MS) return [["checkin"]];
  return [];
}

// ---- Actions: the server applies the same rules with its own clock (race_action in the database) ----

export type Action = "pit" | "seat" | "resume" | "checkin" | "finish" | "retire";

export function apply(r: Race, action: Action, now: number, since?: number): Race {
  if (r.endedAt || now < r.startedAt) return r;
  const s = settle(r, now);
  const a = now >= s.startedAt + s.duration * 1000 && action !== "retire" ? "finish" : action;
  switch (a) {
    case "pit":
    case "seat": // may be dated back (camera gap, offline), never before the last check-in or comeback
      return goOff(s, Math.min(now, Math.max(since ?? now, s.checkedAt ?? s.startedAt)), a);
    case "resume":
      return resume(s, now);
    case "checkin":
      return s.off ? s : checkIn(s, now);
    case "finish":
    case "retire":
      return finish(s, now, a === "retire");
  }
}

/** Closes the race at `now`, or at the player's end time if that came first. */
export function finish(r: Race, now: number, retired = false): Race {
  const at = Math.min(now, r.startedAt + r.duration * 1000);
  return { ...resume(r, at), endedAt: at, retired };
}

export const lapsOf = (r: Pick<Race, "duration">) => Math.round(r.duration / LAP_SEC);
/** Laps covered. A car only moves while its driver focuses. */

/** One car on the grid at a given moment. */
export type Row = {
  id: string;
  name: string;
  ratio: number;
  focus: number;
  pos: number;
  me?: boolean;
  bot?: boolean;
  off?: boolean;
  done?: boolean;
  laps: number; // distance on track; ordered like the standings (see rowOf)
  pace?: number; // bots: the ratio they will finish on, known from their pit plan
};

export function rowOf(id: string, name: string, r: Race, now: number, me = false): Omit<Row, "pos"> {
  const focus = focusSec(r, now);
  const q = ratio(focus, elapsedSec(r, now));
  // Distance = ratio × time since lights out, the same clock for every car, so the order on track is the
  // order in the standings. A car in the pits stays where it pulled in.
  const at = Math.min(r.off ? Math.max(r.off.since, r.startedAt) : now, raceEnd(r));
  const laps = (ratio(focusSec(r, at), elapsedSec(r, at)) * Math.max(0, at - r.raceAt)) / 1000 / LAP_SEC;
  return { id, name, me, focus, ratio: q, off: !!r.off, done: now >= raceEnd(r), laps };
}

// ---- AI drivers fill the grid when fewer than 20 people show up -------------------------------

const BOT_NAMES = [
  "새벽세시반", "오답노트장인", "coffee.only", "합격하고잘거야", "deep_work", "도서관지박령",
  "pomodoro_kim", "한문제만더", "leetcode.daily", "독서실1열", "수능D100", "slow.steady",
  "형광펜러버", "집중력3분", "morning.owl", "폰압수당함", "hi_seouluniv.", "눈감고도서울대", "znveowr_",
];

/** Small deterministic PRNG so every client sees the same bots for a slot. */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A bot's pit stops, [from, to] in seconds after lights out. Its pace comes only from these: each bot has a
 * level between 70% and 97% and spends the rest of its race in one to four stops spread over the race,
 * so bots pit, drop back and come again like people do.
 */
export function botStops(seed: number, duration: number): [number, number][] {
  const pit = (0.03 + rand(seed) * 0.27) * duration;
  const n = Math.min(4, Math.max(1, Math.round(pit / 300)));
  return Array.from({ length: n }, (_, i) => {
    const part = duration / n; // one stop somewhere in each part of the race, so stops never overlap
    const len = (pit / n) * (0.6 + rand(seed + 20 + i) * 0.8);
    const from = part * i + rand(seed + 10 + i) * (part - len);
    return [from, from + len];
  });
}

/** `grid` tells apart the bots of the division grids that share a slot. */
export function botRows(raceAt: number, count: number, now: number, grid = 0): Omit<Row, "pos">[] {
  const slot = Math.floor(raceAt / SLOT) + grid * 7919;
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const seed = slot * 31 + i;
    const duration = DURATIONS[Math.floor(rand(seed + 2) * DURATIONS.length)] * 60;
    const t = Math.max(0, Math.min((now - raceAt) / 1000, duration));
    const stops = botStops(seed, duration);
    const focus = t - stops.reduce((a, [from, to]) => a + Math.max(0, Math.min(t, to) - from), 0);
    return {
      id: `bot-${i}`,
      name: BOT_NAMES[(slot + i * 7) % BOT_NAMES.length],
      bot: true,
      ratio: ratio(focus, t),
      focus,
      off: t < duration && stops.some(([from, to]) => t >= from && t < to),
      done: t >= duration,
      laps: focus / LAP_SEC, // bots start at lights out, so this is ratio × race time as for people
      pace: 1 - stops.reduce((a, [from, to]) => a + to - from, 0) / duration,
    };
  });
}

/** Sort by focus ratio. Ties go to people over bots, and to me over others. */
export function rank(rows: Omit<Row, "pos">[]): Row[] {
  const w = (r: Omit<Row, "pos">) => (r.me ? 2 : r.bot ? 0 : 1);
  return [...rows].sort((a, b) => b.ratio - a.ratio || w(b) - w(a)).map((r, i) => ({ ...r, pos: i + 1 }));
}

/** LP for a finish. Full points for a race of an hour or longer, scaled down for shorter ones. */
export function lpFor(r: Race, pos: number) {
  if (r.kind !== "gp" || r.retired) return 0;
  return Math.round((LP_TABLE[pos - 1] ?? 0) * Math.min(1, r.duration / 3600));
}

/** Final classification once the slot is over: people's finished races against that grid's bots. */
export function classify(raceAt: number, people: { id: string; race: Race }[], grid = 0) {
  const end = raceAt + CLASSIFY_AFTER;
  const done = people.map((p) => ({ id: p.id, race: p.race.endedAt ? p.race : finish(p.race, raceAt + CLASSIFY_AFTER) }));
  const rows = rank([
    ...done.map((p) => {
      const row = rowOf(p.id, "", p.race, end);
      return p.race.retired ? { ...row, ratio: -1 } : row; // retirements are classified last
    }),
    ...botRows(raceAt, GRID_SIZE - people.length, end, grid),
  ]);
  return done.map((p) => {
    const { pos, focus } = rows.find((x) => x.id === p.id)!;
    return { id: p.id, race: p.race, pos, ratio: rowOf(p.id, "", p.race, end).ratio, focus, lp: lpFor(p.race, pos) };
  });
}

// ---- Divisions: kept across seasons, promotion and relegation when a month closes -------------

export const DIVISIONS = ["F1", "F2", "F3"] as const;
export type Division = (typeof DIVISIONS)[number];
export const PROMOTE_LP = 100;
export const RELEGATE_LP = 20;
export const gridOf = (d: Division) => DIVISIONS.indexOf(d) + 1; // bot seed per division grid

/** Where a season's LP sends a player next month. Mirrors close_season() in the database. */
export function nextDivision(d: Division, lp: number): Division {
  const i = DIVISIONS.indexOf(d);
  if (lp >= PROMOTE_LP && i > 0) return DIVISIONS[i - 1];
  if (lp < RELEGATE_LP && i < DIVISIONS.length - 1) return DIVISIONS[i + 1];
  return d;
}

// ---- Study log: day totals, streaks -----------------------------------------------------------

/** Local calendar day as yyyy-mm-dd. */
export function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dailyFocus(races: { started_at: number; focus_sec: number | null }[]) {
  const days = new Map<string, number>();
  for (const r of races) days.set(dayKey(r.started_at), (days.get(dayKey(r.started_at)) ?? 0) + (r.focus_sec ?? 0));
  return days;
}

export const STREAK_MIN_SEC = 10 * 60;
export const GOAL_CHOICES = [60, 120, 180, 240, 360, 480]; // daily goal, minutes

/** Days in a row with at least 10 focused minutes, ending today (or yesterday, if today has not started yet). */
export function streak(days: Map<string, number>, now: number) {
  let n = 0;
  let t = now;
  if ((days.get(dayKey(t)) ?? 0) < STREAK_MIN_SEC) t -= 86_400_000;
  while ((days.get(dayKey(t)) ?? 0) >= STREAK_MIN_SEC) {
    n++;
    t -= 86_400_000;
  }
  return n;
}

/** Longest stretch of unbroken focus in a finished race, in seconds. */
export function longestStint(r: Race) {
  const end = raceEnd(r);
  let best = 0;
  let from = r.startedAt;
  for (const [since, until] of [...(r.offs ?? [])].sort((a, b) => a[0] - b[0])) {
    best = Math.max(best, since - from);
    from = Math.max(from, until);
  }
  return Math.max(best, end - from) / 1000;
}

/**
 * The race as it stood at time t, rebuilt from the off log, for looking back (race control, gains).
 * Returns r itself when nothing in it happened after t.
 */
export function asOf(r: Race, t: number): Race {
  const offs = r.offs ?? [];
  const later = offs.some((o) => o[1] > t) || (r.off && r.off.since > t) || (r.endedAt && r.endedAt > t);
  if (!later) return r;
  const closed = offs.filter((o) => o[1] <= t);
  const open = offs.find((o) => o[0] <= t && o[1] > t);
  return {
    ...r,
    offs: closed,
    offTotal: closed.reduce((a, [since, until]) => a + until - since, 0),
    off: open ? { since: open[0], reason: open[2] } : r.off && r.off.since <= t ? r.off : null,
    endedAt: r.endedAt && r.endedAt <= t ? r.endedAt : undefined,
    retired: r.endedAt && r.endedAt <= t ? r.retired : false,
  };
}

/** Seconds of the focus stretch going on now; 0 while off track. */
export function currentStint(r: Race, now: number) {
  if (r.off || r.endedAt) return 0;
  const from = Math.max(r.startedAt, ...(r.offs ?? []).map((o) => o[1]));
  return Math.max(0, now - from) / 1000;
}

// ---- DRS: the car ahead is within reach ---------------------------------------------------------

/** Show DRS when unbroken focus would pass the car ahead within this many seconds. */
export const DRS_SEC = 600;
/** A focus stretch this long leaves a trail behind my car on the map. */
export const SLIPSTREAM_SEC = 25 * 60;

/**
 * Seconds of unbroken focus I need before my ratio passes `target`, the ratio of the car ahead,
 * assuming that car holds its ratio. null when it can't happen before my chequered flag.
 * (focus + t) / (elapsed + t) > target  ⇔  t > (target·elapsed − focus) / (1 − target)
 */
export function catchUpSec(focus: number, elapsed: number, target: number, left: number) {
  if (target >= 1) return null;
  const t = Math.max(0, (target * elapsed - focus) / (1 - target));
  return t <= left ? t : null;
}

// ---- Rival: one car to beat this race ----------------------------------------------------------

/** The rival is picked this long after my start, once the pace has spread out, and kept for the race. */
export const RIVAL_AFTER_MS = 10 * 60_000;

/**
 * From the grid at pick time: the car closest to my pace. A bot is judged on the ratio it will finish on,
 * since early on most bots haven't stopped yet. People get a 2%p head start over bots.
 */
export function pickRival(snapshot: Row[]) {
  const mine = snapshot.find((r) => r.me);
  if (!mine) return undefined;
  const score = (r: Row) => Math.abs((r.pace ?? r.ratio) - mine.ratio) - (r.bot ? 0 : 0.02);
  return snapshot.filter((r) => !r.me).sort((a, b) => score(a) - score(b))[0]?.id;
}

// ---- Formatting --------------------------------------------------------------------------------

export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const pct = (x: number) => (x * 100).toFixed(1);

export function hoursMinutes(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  return m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m / 60}시간`;
}

export const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
