import type { Entry } from "@/lib/data";
import { dailyFocus, dayKey, hoursMinutes, STREAK_MIN_SEC, streak } from "@/lib/race";

const WEEKS = 20;
const DAY = 86_400_000;
const LEVELS = ["bg-row-me", "bg-brand/25", "bg-brand/50", "bg-brand/75", "bg-brand"];

/** Minutes studied that day, bucketed for the calendar: none, <30m, <1h, <2h, 2h+. */
function level(sec: number) {
  if (sec < STREAK_MIN_SEC) return sec > 0 ? 1 : 0;
  return sec < 1800 ? 1 : sec < 3600 ? 2 : sec < 7200 ? 3 : 4;
}

function weekStart(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - ((d.getDay() + 6) % 7) * DAY; // Monday
}

/** Study calendar over the last 20 weeks, with the streak and this week against last week. */
export function StudyLog({ races, now }: { races: Entry[]; now: number }) {
  const days = dailyFocus(races);
  const sum = (from: number, to: number) => {
    let s = 0;
    for (let t = from; t < to; t += DAY) s += days.get(dayKey(t + DAY / 2)) ?? 0;
    return s;
  };
  const thisWeek = weekStart(now);
  const week = sum(thisWeek, thisWeek + 7 * DAY);
  const lastWeek = sum(thisWeek - 7 * DAY, thisWeek);
  const diff = week - lastWeek;
  const run = streak(days, now);
  const first = thisWeek - (WEEKS - 1) * 7 * DAY;
  const today = dayKey(now);

  return (
    <section>
      <h2 className="text-xl font-bold">공부 기록</h2>
      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-row-me text-sm">
        <div className="bg-bg p-3 md:p-4">
          <dt className="text-muted">연속 공부</dt>
          <dd className="font-num mt-1 text-2xl tabular-nums">{run}일</dd>
        </div>
        <div className="bg-bg p-3 md:p-4">
          <dt className="text-muted">이번 주</dt>
          <dd className="mt-1 text-lg">{hoursMinutes(week)}</dd>
        </div>
        <div className="bg-bg p-3 md:p-4">
          <dt className="text-muted">지난주보다</dt>
          <dd className={`mt-1 text-lg ${diff >= 0 ? "text-go" : "text-muted"}`}>
            {diff >= 0 ? "+" : "-"}
            {hoursMinutes(Math.abs(diff))}
          </dd>
        </div>
      </dl>

      <div
        className="mt-4 grid grid-flow-col grid-rows-7 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`최근 ${WEEKS}주 공부 기록. 연속 ${run}일`}
      >
        {Array.from({ length: WEEKS * 7 }, (_, i) => {
          const t = first + i * DAY + DAY / 2; // midday dodges DST edges
          const key = dayKey(t);
          const sec = days.get(key) ?? 0;
          const future = t > now && key !== today;
          return (
            <span
              key={i}
              title={future ? undefined : `${new Date(t).getMonth() + 1}/${new Date(t).getDate()} ${hoursMinutes(sec)}`}
              className={`aspect-square rounded-[3px] ${future ? "bg-transparent" : LEVELS[level(sec)]} ${key === today ? "ring-1 ring-fg" : ""}`}
            />
          );
        })}
      </div>
      <p className="mt-2 flex items-center justify-end gap-1 text-xs text-subtle">
        적게
        {LEVELS.map((c) => (
          <span key={c} className={`size-2.5 rounded-[2px] ${c}`} />
        ))}
        많이
      </p>
    </section>
  );
}
