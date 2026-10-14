"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Countdown } from "@/components/Countdown";
import { TrackMap } from "@/components/TrackMap";
import { circuitFor } from "@/lib/circuits";
import { type SeasonResult, useFollowing, useGrid, useLastSeason, useMyProfile, useRaces, useRunning, useSeason } from "@/lib/data";
import { useUser } from "@/lib/account";
import { pushStatus } from "@/lib/push";
import {
  dayKey,
  focusSec,
  hhmm,
  hoursMinutes,
  joinableSlot,
  LATE_JOIN_MS,
  pct,
  PROMOTE_LP,
  RELEGATE_LP,
  SLOT,
} from "@/lib/race";
import { useRace } from "@/lib/store";
import { useNow } from "@/lib/useNow";

const n = (x: number) => x.toLocaleString("en-US");

function seasonLeft(now: number) {
  const d = new Date(now);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { month: d.getMonth() + 1, days: Math.ceil((end.getTime() - now) / 86_400_000) };
}

export default function Home() {
  const now = useNow(1000);
  const profile = useMyProfile().data!;
  const season = useSeason().data;
  const races = useRaces(profile.id).data;
  const history = races?.filter((e) => e.kind === "gp" && (e.classified || e.retired)).slice(0, 5);
  const race = useRace();
  const slot = now ? joinableSlot(now) : null;
  const entries = useGrid(slot, profile.division);
  const [push] = useState(pushStatus);
  const anonymous = useUser()?.is_anonymous;
  if (!now || !slot) return null;

  const table = season?.filter((s) => s.division === profile.division);
  const mineIdx = table?.findIndex((s) => s.user_id === profile.id) ?? -1;
  const lp = table?.[mineIdx]?.lp ?? 0;
  const div = profile.division;
  const progress = (lp / PROMOTE_LP) * 100;
  const today = dayKey(now);
  const todaySec =
    (races ?? []).filter((e) => dayKey(e.started_at) === today).reduce((a, e) => a + (e.focus_sec ?? 0), 0) +
    (race && !race.endedAt && dayKey(race.startedAt) === today ? focusSec(race, now) : 0);
  const running = now >= slot;
  const circuit = circuitFor(slot);
  const left = seasonLeft(now);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between md:hidden">
        <span className="font-semibold">PITIN</span>
        <Link href="/profile" aria-label="프로필">
          <Avatar profile={profile} size={32} />
        </Link>
      </header>
      <h1 className="hidden text-3xl font-bold md:block">안녕하세요, {profile.name}</h1>

      {anonymous && !!races?.length ? (
        <Link href="/profile#account" className="flex items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">
          <span>기록이 이 브라우저에만 있어요. 구글 계정을 연결하면 기기를 바꿔도 이어서 달려요.</span>
          <span className="shrink-0 font-semibold text-brand">연결하기</span>
        </Link>
      ) : (push === "off" || push === "install") && (
        <Link href="/profile#alerts" className="flex items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">
          <span>
            {push === "install"
              ? "홈 화면에 추가하면 폰을 내려놔도 레이스 알림을 받을 수 있어요."
              : "알림을 켜면 폰을 내려놓고 공부해도 레이스가 이어져요."}
          </span>
          <span className="shrink-0 font-semibold text-brand">{push === "install" ? "방법 보기" : "알림 켜기"}</span>
        </Link>
      )}

      <SeasonClosed />

      <TodayGoal sec={todaySec} goal={profile.daily_goal} />

      <FriendsRacing now={now} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card flex flex-col gap-4 p-4 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted">내 디비전</p>
              <p className="font-num text-[96px] leading-[0.85] font-bold text-brand italic">{div}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">{left.month}월 시즌</p>
              <p className="font-num text-3xl font-bold">D-{left.days}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 text-sm text-muted">
            <div>
              <dt>시즌 포인트</dt>
              <dd className="font-num text-3xl text-fg tabular-nums">
                {n(lp)} <span className="text-lg text-brand">LP</span>
              </dd>
            </div>
            <div className="border-l border-row-me pl-4">
              <dt>시즌 순위</dt>
              <dd className="font-num text-3xl text-fg tabular-nums">
                {mineIdx >= 0 ? mineIdx + 1 : "-"} <span className="text-lg text-muted">/ {table ? n(table.length) : "-"}</span>
              </dd>
            </div>
          </dl>

          <div className="mt-auto text-xs text-muted">
            <div className="h-1 rounded-full bg-row-me">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            <p className="mt-2">
              {div === "F1"
                ? lp < RELEGATE_LP
                  ? `F1에 남으려면 이번 시즌 ${RELEGATE_LP - lp} LP가 더 필요해요.`
                  : "최상위 디비전이에요. 다음 시즌에도 F1에 남아요."
                : lp >= PROMOTE_LP
                  ? `승격권이에요. 다음 달 ${div === "F3" ? "F2" : "F1"}로 올라가요.`
                  : `승격까지 ${PROMOTE_LP - lp} LP${div === "F2" && lp < RELEGATE_LP ? `. ${RELEGATE_LP} LP 미만이면 F3로 내려가요.` : ""}`}
            </p>
          </div>
        </section>

        <section className="card flex flex-col overflow-hidden pb-4 md:row-span-2">
          <TrackMap circuit={circuit} className="max-h-56 md:max-h-80" />
          <div className="mt-3 flex flex-1 flex-col gap-4 px-4 md:px-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-muted">{running ? "진행 중인 그랑프리" : "다음 그랑프리"}</h2>
              <span className="text-sm text-muted">
                {div} 그리드 {entries.length}명
              </span>
            </div>
            <div>
              <p className="text-2xl font-medium">{circuit.name} 그랑프리</p>
              <p className="mt-1 text-sm text-muted">
                {hhmm(slot)} 출발, 종료 시간은 그리드에서 직접 정해요
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">{running ? "합류 마감까지" : "출발까지"}</p>
              <p className="font-num text-5xl leading-none font-bold">
                <Countdown at={running ? slot + LATE_JOIN_MS : slot} />
              </p>
            </div>
            <Link href="/race" className="mt-auto grid h-12 place-items-center rounded-full bg-brand font-semibold">
              {running ? "지금 합류하기" : "그리드로 이동"}
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-muted">최근 레이스</h2>
            <Link href="/profile" className="text-sm text-subtle hover:text-fg">
              전체 기록
            </Link>
          </div>
          {history?.length ? (
            <ol className="grid grid-cols-5 gap-1">
              {history.map((e) => (
                <li key={e.id} className="flex flex-col items-center rounded-lg bg-row py-2">
                  <span
                    className={`font-num text-2xl leading-none font-bold italic ${e.retired ? "text-muted" : e.final_pos === 1 ? "text-gold" : e.final_pos === 2 ? "text-fg" : e.final_pos === 3 ? "text-bronze" : "text-muted"}`}
                  >
                    {e.retired ? "DNF" : `P${e.final_pos}`}
                  </span>
                  <span className="font-num text-sm text-muted tabular-nums">{pct(e.final_ratio ?? 0)}%</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg bg-row p-4 text-sm leading-6 text-muted">
              아직 완주한 레이스가 없어요. 그랑프리는 30분마다 열려요.
            </p>
          )}

          <h2 className="mt-3 text-muted">이후 일정</h2>
          <ol className="divide-y divide-row-me rounded-lg bg-row text-sm">
            {[1, 2, 3].map((k) => {
              const at = slot + k * SLOT;
              const c = circuitFor(at);
              return (
                <li key={at} className="flex items-center justify-between px-4 py-3">
                  <span className="font-num text-lg tabular-nums">{hhmm(at)}</span>
                  <span className="text-muted">
                    {c.name}, {c.city}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}

/** Today's focus against the player's daily goal. */
function TodayGoal({ sec, goal }: { sec: number; goal: number }) {
  const done = sec >= goal * 60;
  return (
    <section className="card flex items-center gap-4 p-4 md:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">오늘 순공</p>
        <p className="mt-1 text-xl font-medium">
          {hoursMinutes(sec)} <span className="text-base text-muted">/ {hoursMinutes(goal * 60)}</span>
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-row-me">
          <div className={`h-full rounded-full ${done ? "bg-go" : "bg-brand"}`} style={{ width: `${Math.min(100, (sec / (goal * 60)) * 100)}%` }} />
        </div>
      </div>
      <p className={`shrink-0 text-right text-sm ${done ? "text-go" : "text-muted"}`}>
        {done ? "오늘 목표 달성" : `${hoursMinutes(goal * 60 - sec)} 남음`}
      </p>
    </section>
  );
}

/** Players I follow who are on track right now. */
function FriendsRacing({ now }: { now: number }) {
  const following = useFollowing().data ?? [];
  const running = useRunning(following, now).data ?? [];
  if (!running.length) return null;
  return (
    <section className="card p-4 md:px-6">
      <h2 className="text-sm text-muted">지금 달리는 친구</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {running.map((e) => (
          <li key={e.id}>
            <Link href={`/player/${e.user_id}`} className="flex items-center gap-2 rounded-full bg-row py-1.5 pr-3 pl-2 text-sm">
              <span className={`size-2 rounded-full ${e.off_since ? "bg-pit" : "bg-go"}`} />
              {e.name}
              <span className="text-xs text-muted">{e.kind === "gp" ? `${hhmm(e.race_at)} 그랑프리` : "연습 주행"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const lastMonthKey = () => {
  const d = new Date();
  d.setDate(0); // last day of the previous month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Once per closed season: where the player finished and where they race next. */
function SeasonClosed() {
  const result = useLastSeason().data;
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem("pitin:season-seen");
    } catch {
      return null;
    }
  });
  if (!result || result.season !== lastMonthKey() || seen === result.season) return null;
  const dismiss = () => {
    try {
      localStorage.setItem("pitin:season-seen", result.season);
    } catch {}
    setSeen(result.season);
  };
  return (
    <section className="card relative overflow-hidden p-4 md:p-6">
      <p className="text-sm text-muted">{Number(result.season.slice(5))}월 시즌이 끝났어요</p>
      <p className="mt-1 text-2xl font-bold">
        {result.division} {result.rank}위 · {result.lp} LP
      </p>
      <p className={`mt-1 ${moved(result) === "up" ? "text-go" : moved(result) === "down" ? "text-light" : "text-muted"}`}>
        {moved(result) === "up"
          ? `${result.next_division}로 승격했어요. 이번 시즌은 더 빠른 그리드에서 달려요.`
          : moved(result) === "down"
            ? `${result.next_division}로 내려갔어요. 이번 시즌에 ${PROMOTE_LP} LP를 모으면 다시 올라가요.`
            : `이번 시즌도 ${result.next_division}에서 달려요.`}
      </p>
      <button onClick={dismiss} className="mt-4 h-10 rounded-full border border-line px-5 text-sm">
        확인
      </button>
    </section>
  );
}

const moved = (r: SeasonResult) => (r.next_division < r.division ? "up" : r.next_division > r.division ? "down" : "same");
