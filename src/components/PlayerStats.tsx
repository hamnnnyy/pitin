import { StudyLog } from "@/components/StudyLog";
import { circuitFor } from "@/lib/circuits";
import type { Entry } from "@/lib/data";
import { hhmm, hoursMinutes, pct } from "@/lib/race";

/** Career numbers, the study calendar and the race log of one player. */
export function PlayerStats({ races, now }: { races: Entry[]; now: number }) {
  const gp = races.filter((e) => e.kind === "gp");
  const done = gp.filter((e) => !e.retired);
  const focus = races.reduce((a, e) => a + (e.focus_sec ?? 0), 0);
  const avg = done.length ? done.reduce((a, e) => a + (e.final_ratio ?? 0), 0) / done.length : 0;
  const stats = [
    ["완주", `${done.length}회`],
    ["우승", `${done.filter((e) => e.final_pos === 1).length}회`],
    ["포디움", `${done.filter((e) => (e.final_pos ?? 99) <= 3).length}회`],
    ["평균 집중 비율", done.length ? `${pct(avg)}%` : "-"],
    ["누적 순공", hoursMinutes(focus)],
    ["리타이어", `${gp.length - done.length}회`],
  ];

  return (
    <>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-row-me md:grid-cols-3">
        {stats.map(([k, v]) => (
          <div key={k} className="bg-bg p-4">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="font-num mt-1 text-2xl tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <StudyLog races={races} now={now} />

      <section>
        <h2 className="text-xl font-bold">레이스 기록</h2>
        {races.length ? (
          <ol className="mt-4 overflow-hidden rounded-xl border border-row-me">
            {races.slice(0, 50).map((e) => {
              const d = new Date(e.started_at);
              const practice = e.kind === "practice";
              return (
                <li key={e.id} className="flex items-center gap-4 px-4 py-3 odd:bg-row">
                  <span className="font-num w-12 text-2xl font-bold italic">
                    {practice ? (
                      <span className="text-base text-muted not-italic">연습</span>
                    ) : e.retired ? (
                      "DNF"
                    ) : e.classified ? (
                      `P${e.final_pos}`
                    ) : (
                      <span className="text-base text-muted not-italic">집계 중</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {practice ? "연습 주행" : `${circuitFor(e.race_at).name} 그랑프리`}
                    </p>
                    <p className="text-xs text-muted">
                      {d.getMonth() + 1}/{d.getDate()} {hhmm(e.started_at)} · {e.division} · 순공 {hoursMinutes(e.focus_sec ?? 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-num text-lg tabular-nums">{pct(e.final_ratio ?? 0)}%</p>
                    {!practice && e.classified && <p className="text-xs text-brand">+{e.lp} LP</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 rounded-lg bg-row p-4 text-sm text-muted">완주한 레이스가 여기에 쌓여요.</p>
        )}
      </section>
    </>
  );
}
