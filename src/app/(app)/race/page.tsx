"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RequireProfile } from "@/components/RequireProfile";
import { SeatCam } from "@/components/SeatCam";
import { SoundToggle } from "@/components/SoundToggle";
import { Tower } from "@/components/Tower";
import { TrackMap, toCars } from "@/components/TrackMap";
import { type Circuit, circuitFor } from "@/lib/circuits";
import { type Entry, entryToRace, joinRace, type Profile, raceAction, useGrid, useMyProfile, useRaces } from "@/lib/data";
import {
  asking,
  botRows,
  checkDue,
  CLASSIFY_AFTER,
  clock,
  DURATIONS,
  elapsedSec,
  focusSec,
  GRACE_SEC,
  GRID_SIZE,
  gridOf,
  hhmm,
  hoursMinutes,
  joinableSlot,
  LATE_JOIN_MS,
  lapsOf,
  longestStint,
  lpFor,
  pct,
  type Race,
  rank,
  rowOf,
  type Action,
  type Division,
  apply,
  asOf,
  camActions,
  catchUpSec,
  pickRival,
  RIVAL_AFTER_MS,
  type Row,
  currentStint,
  DRS_SEC,
  settle,
  SLIPSTREAM_SEC,
  SLOT,
} from "@/lib/race";
import { enablePush, pushStatus } from "@/lib/push";
import { share } from "@/lib/share";
import { beep, unlockSound } from "@/lib/sound";
import { supabase } from "@/lib/supabase";
import {
  type Invite,
  loadInvite,
  loadRace,
  loadSeen,
  saveCoachDone,
  saveInvite,
  saveRace,
  saveSeen,
  useCoachDone,
  useRace,
} from "@/lib/store";
import { useNow } from "@/lib/useNow";

const LIGHTS_MS = 5000;
const PRACTICE_MIN = 25;

export default function RacePage() {
  return (
    <RequireProfile>
      <RaceScreen />
    </RequireProfile>
  );
}

/** Shows an action at once, then takes the server's answer (stamped with its clock) as the truth. */
function act(action: Action, since?: number) {
  const r = loadRace();
  if (!r) return;
  const t = Date.now();
  saveRace(apply(r, action, t, since));
  send(r.raceAt, action, since ?? t);
}

// Actions taken offline wait here and go out, in order, once the connection is back.
// The server may date a pit stop back to when it was pressed; a comeback counts from when it arrives.
const offline: [raceAt: number, action: Action, since: number][] = [];
function send(raceAt: number, action: Action, since: number) {
  raceAction(raceAt, action, since).then(
    (e) => {
      if (loadRace()?.raceAt === e.race_at) saveRace(entryToRace(e));
    },
    () => {
      if (!navigator.onLine) offline.push([raceAt, action, since]);
    },
  );
}
if (typeof window !== "undefined")
  window.addEventListener("online", () => offline.splice(0).forEach((a) => send(...a)));

/** Every car on the grid right now: real people from the server, me from this device, AI drivers in the gaps. */
function gridRows(race: Race | null, raceAt: number, entries: Entry[], me: Profile, now: number, division: Division) {
  const others = race?.kind === "practice" ? [] : entries.filter((e) => e.user_id !== me.id);
  const rows = others.map((e) => rowOf(e.user_id, e.name, asOf(entryToRace(e), now), now));
  if (race) rows.push(rowOf("me", me.name, asOf(race, now), now, true));
  const free = GRID_SIZE - rows.length - (race ? 0 : 1); // keep a seat for me while I'm still choosing
  return rank([...rows, ...botRows(raceAt, free, now, gridOf(division))]);
}

function RaceScreen() {
  const now = useNow();
  const race = useRace();
  const me = useMyProfile().data!;
  const raceAt = race ? race.raceAt : now ? joinableSlot(now) : null;
  // a friend's invite to this grand prix puts me on their division's grid
  const stored = now ? loadInvite() : null;
  const invite = !race && stored?.raceAt === raceAt ? stored : null;
  const division = race?.division ?? invite?.division ?? me.division;
  const entries = useGrid(race?.kind === "practice" ? null : raceAt, division);
  const races = useRaces(me.id).data;
  const mineOnServer = entries.find((e) => e.user_id === me.id);

  // Lost the local copy (cleared storage, other device)? Pick the race back up from the server.
  useEffect(() => {
    if (race === null && mineOnServer && !mineOnServer.ended_at) saveRace(entryToRace(mineOnServer));
  }, [race, mineOnServer]);

  // Unanswered check-in: into the pit from when we asked. Then the chequered flag at the player's own end time.
  const asked = useRef(0);
  useEffect(() => {
    if (!race || race.endedAt || now < race.startedAt) return;
    // tapping the pushed question opens /race?checkin=1, which is the answer while the question is open
    const tapped = new URLSearchParams(location.search).has("checkin");
    if (tapped) history.replaceState(null, "", "/race");
    const settled = settle(race, now); // the server settles the same way on its own
    if (settled !== race) return saveRace(settled);
    if (now >= race.startedAt + race.duration * 1000) return act("finish");
    if (asking(race, now) && tapped) return act("checkin");
    if (asking(race, now) && asked.current !== checkDue(race)) {
      asked.current = checkDue(race);
      navigator.vibrate?.([200, 100, 200]);
    }
  });

  if (race === undefined || !now || !raceAt) return <main className="flex-1" />;

  const circuit = circuitFor(raceAt);
  const rows = gridRows(race, raceAt, entries, me, now, division);

  if (!race || now < race.startedAt)
    return (
      <Grid race={race} raceAt={raceAt} now={now} circuit={circuit} entries={entries} rows={rows} me={me} division={division} invite={invite} />
    );
  if (race.endedAt)
    return (
      <Result
        race={race}
        rows={gridRows(race, raceAt, entries, me, race.endedAt, division)}
        circuit={circuit}
        final={mineOnServer?.classified ? mineOnServer : undefined}
        entryId={race.endedAt && mineOnServer?.ended_at ? mineOnServer.id : undefined}
        prev={races?.find((e) => e.kind === race.kind && e.race_at !== race.raceAt)}
      />
    );
  const rowsAt = (t: number) => gridRows(race, raceAt, entries, me, Math.max(t, race.startedAt), division);
  return <Live race={race} rows={rows} rowsAt={rowsAt} now={now} circuit={circuit} onRetire={() => act("retire")} />;
}

function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header className={`relative flex h-14 items-center justify-center ${right ? "px-28" : "px-14"}`}>
      <Link href="/home" className="absolute left-4" aria-label="홈으로">
        <ChevronLeft size={24} />
      </Link>
      <h1 className="truncate">{title}</h1>
      <span className="absolute right-2 flex items-center gap-1">
        {right}
        <SoundToggle />
      </span>
    </header>
  );
}

function Lights({ lit }: { lit: number }) {
  return (
    <div className="flex justify-center gap-3 md:gap-4" role="img" aria-label={`출발 신호 ${lit}/5`}>
      {[0, 1, 2, 3, 4].map((c) => (
        <div key={c} className="flex flex-col gap-2">
          {[0, 1].map((r) => (
            <span
              key={r}
              className={`size-9 rounded-full bg-[radial-gradient(rgb(0_0_0/0.35)_1px,transparent_1.5px)] bg-size-[5px_5px] transition-colors duration-75 md:size-10 ${c < lit ? "bg-light shadow-[0_0_24px_rgb(225_6_0/0.6)]" : "bg-row"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// 20 cars lined up behind the start/finish line, me in the last slot
const GRID_CARS = Array.from({ length: GRID_SIZE }, (_, i) => ({
  key: String(i),
  f: -i * 0.006,
  me: i === GRID_SIZE - 1,
  label: i === GRID_SIZE - 1 ? "나" : undefined,
}));

function Grid({
  race,
  raceAt,
  now,
  circuit,
  entries,
  rows,
  me,
  division,
  invite,
}: {
  race: Race | null;
  raceAt: number;
  now: number;
  circuit: Circuit;
  entries: Entry[];
  rows: ReturnType<typeof rank>;
  me: Profile;
  division: Division;
  invite: Invite | null;
}) {
  const [shared, setShared] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const started = now >= raceAt;
  const startAt = race ? race.startedAt : started ? now + LIGHTS_MS : raceAt;
  const rem = (startAt - now) / 1000;
  const lit = race && rem <= 5 ? Math.max(0, Math.min(5, 5 - Math.floor(rem))) : 0;
  // a beep for each red light
  useEffect(() => {
    if (lit > 0) beep(440, 180);
  }, [lit]);
  const people = entries.filter((e) => e.user_id !== me.id);
  // Before lights out: the starting grid with me at the back. After: the race already under way, which I can still join.
  const live = started && !race;
  const grid = [...rows.filter((r) => !r.me), { id: "me", name: me.name, me: true, bot: false }];
  const alreadyRan = !race && entries.some((e) => e.user_id === me.id && e.ended_at);
  const shown = race ? rem : started ? (raceAt + LATE_JOIN_MS - now) / 1000 : rem;

  async function join() {
    setBusy(true);
    setProblem(null);
    unlockSound();
    if (pushStatus() === "off") enablePush().catch(() => {}); // check-in questions reach a locked phone only by push
    try {
      saveRace(entryToRace(await joinRace("gp", raceAt, minutes * 60, invite?.with)));
    } catch (e) {
      setProblem(
        (e as Error).message?.includes("grid closed")
          ? "이번 그리드는 마감됐어요. 다음 그랑프리를 기다려 주세요."
          : "그리드에 서지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function practice() {
    unlockSound();
    setBusy(true);
    setProblem(null);
    try {
      saveRace(entryToRace(await joinRace("practice", 0, PRACTICE_MIN * 60)));
    } catch {
      setProblem("연습 주행을 시작하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col pb-8">
      <Header title={race?.kind === "practice" ? "연습 주행" : `${circuit.name} 그랑프리`} />

      <div className="grid flex-1 gap-8 md:grid-cols-[minmax(0,1fr)_360px] md:px-6">
        <section className="flex flex-col gap-6">
          <div className="px-4 text-center md:px-0">
            <p className="text-muted">
              {race ? "출발까지" : started ? "진행 중이에요. 합류 마감까지" : `${hhmm(raceAt)} 출발까지`}
            </p>
            <p className="font-num text-5xl leading-none font-bold tabular-nums">{clock(Math.max(0, shown))}</p>
          </div>
          <TrackMap circuit={circuit} cars={live ? toCars(rows) : GRID_CARS} className="max-h-80 md:max-h-[440px]" />
          {!live && <Lights lit={lit} />}
        </section>

        <aside className="flex flex-col gap-5 px-4 md:px-0 md:pt-4">
          {alreadyRan ? (
            <p className="rounded-lg bg-row p-4 leading-7">
              이번 그랑프리는 이미 달렸어요. 다음 그랑프리는 {hhmm(raceAt + SLOT)}에 열려요.
            </p>
          ) : race ? (
            <p className="rounded-lg bg-row p-4 leading-7">
              그리드에 섰어요. {hhmm(race.startedAt)}에 출발해서 {hoursMinutes(race.duration)} 뒤인{" "}
              {hhmm(race.startedAt + race.duration * 1000)}에 체커기를 받아요.
            </p>
          ) : (
            <>
              <fieldset>
                <legend className="text-sm text-muted">얼마나 달릴까요?</legend>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {DURATIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={minutes === m}
                      onClick={() => setMinutes(m)}
                      className={`h-11 rounded-lg border ${minutes === m ? "border-brand bg-brand/10 text-fg" : "border-line text-muted"}`}
                    >
                      {m < 60 ? `${m}분` : `${m / 60}시간`.replace(".5시간", "시간 반")}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">
                  {hhmm(startAt + minutes * 60_000)}에 끝나요. 1시간보다 짧으면 LP가 줄어들어요.
                </p>
              </fieldset>
              <button
                onClick={join}
                disabled={busy}
                className="h-12 rounded-full bg-brand font-semibold disabled:opacity-50"
              >
                {busy ? "자리 잡는 중..." : started ? "지금 합류하기" : "그리드에 서기"}
              </button>
              {problem && <p className="text-sm text-danger">{problem}</p>}
            </>
          )}

          {race?.kind !== "practice" && (
            <section>
              <h2 className="text-sm text-muted">
                {invite ? `${invite.name} 선수가 초대한 ` : ""}
                {division} 그리드 {people.length + 1}명 · 빈자리 {Math.max(0, GRID_SIZE - people.length - 1)}개는 AI 선수가 채워요
              </h2>
              {live ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-row-me">
                  <p className="bg-row px-3 py-2 text-xs text-muted">지금 레이스 순위 · 합류하면 이 그리드에 들어가요</p>
                  <Tower rows={rows} gap={false} />
                </div>
              ) : (
                // F1 starting grid: two staggered columns, P1 on the left
                <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 pb-3 text-sm">
                  {grid.map((r, i) => (
                    <li
                      key={r.id}
                      className={`flex h-9 items-center gap-2 rounded-md border-t-2 px-2 ${i % 2 ? "translate-y-3" : ""} ${r.me ? "border-brand bg-brand/10" : "border-line bg-row"}`}
                    >
                      <span className="font-num w-5 text-right font-bold tabular-nums">{i + 1}</span>
                      <span className="truncate">{r.name}</span>
                      {r.bot && <span className="ml-auto rounded bg-row-me px-1 text-[10px] leading-4 text-muted">AI</span>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {race?.kind !== "practice" && !alreadyRan && (
            <div>
              <button
                onClick={async () => {
                  const r = await share({
                    title: "PITIN",
                    text: `${hhmm(raceAt)} ${circuit.name} 그랑프리 같이 달려요`,
                    url: `${location.origin}/join/${raceAt}?with=${me.id}`,
                  });
                  setShared(r === "copied" ? "초대 링크를 복사했어요." : r === "failed" ? "링크를 만들지 못했어요." : null);
                }}
                className="h-11 w-full rounded-full border border-line text-sm"
              >
                친구 초대하기
              </button>
              {shared && <p className="mt-2 text-center text-sm text-muted">{shared}</p>}
            </div>
          )}

          <p className="text-sm leading-6 text-subtle">
            순위는 각자 달린 시간 중 순공 시간의 비율로 정해져요. 레이스 중 카메라를 켜 두면 자리에 있는 동안 순공이 쌓이고, 1분
            넘게 자리를 비우면 피트인으로 쳐요. 카메라 없이 폰을 내려놓고 달리면 20분마다 공부 중인지 물어봐요.
          </p>

          {!race && (
            <button onClick={practice} className="mt-auto h-12 rounded-full border border-line text-muted">
              혼자 연습 주행 ({PRACTICE_MIN}분, LP 없음)
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}

type Rows = ReturnType<typeof rank>;

// What the AI drivers say on the radio. Picked by a hash of driver and moment, so every screen shows the same line.
const RADIO = {
  pitIn: ["물 한 잔만", "스트레칭 좀 할게요", "화장실 다녀올게요", "커피 수혈 중", "눈 좀 감았다 뜰게요", "간식 타임", "폰 확인만… 진짜 잠깐"],
  pitOut: ["다시 달린다", "집중 모드 ON", "이제 안 쉼", "따라잡는다", "정신 차렸어요", "남은 랩 전부 푸시"],
  passedMe: ["먼저 갈게요", "따라와 보세요", "오늘은 제가 이겨요", "DRS 고마워요"],
  passedByMe: ["아 잠깐만요", "다음 랩에 봐요", "인정합니다", "방금 졸았어요"],
};
function radio(kind: keyof typeof RADIO, id: string, at: number) {
  const lines = RADIO[kind];
  let h = Math.floor(at / 1000);
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return lines[Math.abs(h) % lines.length];
}

type Event = { at: number; text: string; good?: boolean; bad?: boolean; quote?: { name: string; line: string } };

/**
 * Race control: what happened over the last few minutes, newest first. Read off snapshots of the grid
 * taken on 10-second marks, so the same events show on every tick. AI drivers add a radio line.
 */
function raceControl(rowsAt: (t: number) => Rows, now: number, since: number, rival?: string) {
  const STEP = 10_000;
  const marks: number[] = [];
  for (let t = Math.floor(now / STEP) * STEP; t > Math.max(since, now - 5 * 60_000) && marks.length < 30; t -= STEP) marks.unshift(t);
  const shots = marks.map((t) => [t, rowsAt(t)] as const);
  const who = (r: Row) => (r.id === rival ? `라이벌 ${r.name}` : r.name);
  const events: Event[] = [];
  for (let i = 1; i < shots.length; i++) {
    const [, before] = shots[i - 1];
    const [at, after] = shots[i];
    const was = new Map(before.map((r) => [r.id, r]));
    const meBefore = before.find((r) => r.me)!;
    const meAfter = after.find((r) => r.me)!;
    if (meAfter.pos < meBefore.pos) {
      const cars = after.filter((r) => !r.me && was.get(r.id)!.pos < meBefore.pos && r.pos > meAfter.pos);
      const bot = cars.find((r) => r.bot);
      events.push({
        at,
        text: `${cars.map(who).join(", ")} 추월, P${meAfter.pos}`,
        good: true,
        quote: bot && { name: bot.name, line: radio("passedByMe", bot.id, at) },
      });
    } else if (meAfter.pos > meBefore.pos) {
      const cars = after.filter((r) => !r.me && was.get(r.id)!.pos > meBefore.pos && r.pos < meAfter.pos);
      const bot = cars.find((r) => r.bot);
      events.push({
        at,
        text: `${cars.map(who).join(", ")}에게 추월당함, P${meAfter.pos}`,
        bad: true,
        quote: bot && { name: bot.name, line: radio("passedMe", bot.id, at) },
      });
    }
    if (after[0].id !== before[0].id) events.push({ at, text: `${after[0].me ? "내가" : `${who(after[0])} 선수가`} 선두로 나섰어요` });
    for (const r of after) {
      const b = was.get(r.id);
      if (!b || r.done || b.off === r.off) continue;
      events.push({
        at,
        text: r.me ? (r.off ? "피트인했어요" : "트랙으로 돌아왔어요") : `${who(r)} ${r.off ? "피트인" : "트랙 복귀"}`,
        quote: r.bot ? { name: r.name, line: radio(r.off ? "pitIn" : "pitOut", r.id, at) } : undefined,
      });
    }
  }
  return events.reverse().slice(0, 6);
}

function Live({
  race,
  rows,
  rowsAt,
  now,
  circuit,
  onRetire,
}: {
  race: Race;
  rows: Rows;
  rowsAt: (t: number) => Rows;
  now: number;
  circuit: Circuit;
  onRetire: () => void;
}) {
  const [armed, setArmed] = useState(false);
  // first race on this device: a short walkthrough pinned under each part of the screen
  const coachDone = useCoachDone();
  const [step, setStep] = useState(0);
  const coach = coachDone === false ? step : -1;
  const coachNext = () => (step >= COACH.length - 1 ? saveCoachDone() : setStep(step + 1));

  // Back after a while (phone locked, other tab, reload): a summary of what happened meanwhile.
  const [away, setAway] = useState<number | null>(() => {
    const seen = loadSeen(race.raceAt);
    return seen && now - seen > AWAY_MS ? seen : null;
  });
  useEffect(() => {
    const mark = () => document.visibilityState === "visible" && saveSeen(race.raceAt, Date.now());
    const onVisibility = () => {
      if (document.visibilityState === "hidden") return saveSeen(race.raceAt, Date.now());
      const seen = loadSeen(race.raceAt);
      if (seen && Date.now() - seen > AWAY_MS) setAway(seen);
      mark();
    };
    mark();
    const id = setInterval(mark, 5000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [race.raceAt]);
  useEffect(() => {
    if (Date.now() - race.startedAt < 3000) beep(880, 600); // lights out
  }, [race.startedAt]);
  const mine = rows.find((r) => r.me)!;
  const pastRows = rowsAt(now - 15_000);
  // my rival: the car closest to me on pace 10 minutes in, kept for the rest of the race
  const rivalAt = race.startedAt + RIVAL_AFTER_MS;
  const rivalId = now >= rivalAt ? pickRival(rowsAt(rivalAt)) : undefined;
  const rival = rows.find((r) => r.id === rivalId);
  const feed = raceControl(rowsAt, now, race.startedAt, rivalId);
  // a lap just completed: flash the count for a couple of seconds
  const lapFlash = Math.floor(mine.laps) > Math.floor(rowsAt(now - 2500).find((r) => r.me)!.laps);
  // places that changed over the last 3 s light up in the tower; a place I gained gets the big card
  const recent = rowsAt(now - 3000);
  const recentPos = new Map(recent.map((r) => [r.id, r.pos]));
  const meRecent = recentPos.get("me") ?? mine.pos;
  const overtook = rows.filter((r) => !r.me && recentPos.get(r.id)! < meRecent && r.pos > mine.pos);
  const towerBefore = new Map(rowsAt(now - 8000).map((r) => [r.id, r.pos])); // ▲/▼ stay up for 8 s
  const delta = (pastRows.find((r) => r.me)?.pos ?? mine.pos) - mine.pos; // places gained over the last 15 s
  // real people I passed, or who passed me, over the same 15 s
  const pastPos = new Map(pastRows.map((r) => [r.id, r.pos]));
  const meBefore = pastPos.get("me") ?? mine.pos;
  const people = rows.filter((r) => !r.me && !r.bot && pastPos.has(r.id));
  const passed = people.filter((r) => pastPos.get(r.id)! < meBefore && r.pos > mine.pos).map((r) => r.name);
  const passedBy = people.filter((r) => pastPos.get(r.id)! > meBefore && r.pos < mine.pos).map((r) => r.name);
  const ahead = rows[mine.pos - 2];
  const behind = rows[mine.pos];
  const el = elapsedSec(race, now);
  const laps = lapsOf(race);
  const lap = Math.min(laps, Math.floor(mine.laps) + 1);
  const off = race.off;
  const ask = asking(race, now);
  const left = (checkDue(race) + GRACE_SEC * 1000 - now) / 1000;
  const toAhead = ahead ? catchUpSec(mine.focus, el, ahead.ratio, race.duration - el) : null;
  const drs = toAhead !== null && toAhead <= DRS_SEC;
  const slipstream = currentStint(race, now) >= SLIPSTREAM_SEC;
  useEffect(() => {
    if (lapFlash) beep(660, 90);
  }, [lapFlash]);
  const lastPos = useRef(mine.pos);
  useEffect(() => {
    if (mine.pos < lastPos.current) beep(1320, 150); // gained a place
    lastPos.current = mine.pos;
  }, [mine.pos]);

  const [cam, setCam] = useState(() => {
    try {
      return localStorage.getItem("pitin:cam") === "on";
    } catch {
      return false;
    }
  });
  const [camFailed, setCamFailed] = useState(false);
  const lastSeen = useRef(0);
  function toggleCam(on: boolean) {
    try {
      localStorage.setItem("pitin:cam", on ? "on" : "off");
    } catch {}
    lastSeen.current = 0;
    setCamFailed(false);
    setCam(on);
  }
  function onFrame(present: boolean) {
    const r = loadRace();
    if (!r) return;
    const t = Date.now();
    lastSeen.current ||= t; // assume the player is there when the camera starts
    for (const [action, since] of camActions(r, lastSeen.current, t, present)) act(action, since);
    if (present || r.off) lastSeen.current = t; // time already off track must not be counted again
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-24 md:pb-6">
      <Header
        title={race.kind === "practice" ? "연습 주행" : `${circuit.name} 그랑프리`}
        right={
          <span className="font-num text-lg tabular-nums">
            LAP {lap}/{laps}
          </span>
        }
      />

      <div className="grid flex-1 md:grid-cols-[minmax(0,1fr)_400px] md:gap-6 md:px-6">
        <div className="flex flex-col">
          <section className="mt-2 flex items-end justify-between px-4 md:px-0">
            <p className="font-num text-[112px] leading-[0.8] font-bold italic md:text-[150px]" aria-label={`현재 ${mine.pos}위`}>
              P{mine.pos}
              <span className="text-3xl text-muted not-italic">/{rows.length}</span>
              {delta !== 0 && (
                <span className={`ml-2 align-top text-2xl not-italic ${delta > 0 ? "text-go" : "text-light"}`}>
                  {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                </span>
              )}
            </p>
            <dl className="text-right">
              <dt className="text-sm text-muted">집중 비율</dt>
              <dd className="font-num text-5xl leading-none font-bold tabular-nums md:text-6xl">{pct(mine.ratio)}%</dd>
            </dl>
          </section>

          <div className="relative mt-4">
            <TrackMap circuit={circuit} cars={toCars(rows, slipstream, rivalId)} className="max-h-64 md:max-h-[420px]" />
            {overtook.length > 0 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/4 flex animate-[lap_2.5s_ease-out_forwards] flex-col items-center motion-reduce:animate-none"
              >
                <p className="font-num text-7xl font-bold text-go italic [text-shadow:0_2px_16px_rgb(0_0_0/0.8)]">P{mine.pos} ▲</p>
                <p className="mt-1 rounded bg-black/70 px-2 py-0.5 text-sm">{overtook.map((r) => r.name).join(", ")} 추월</p>
              </div>
            ) : lapFlash && (
              <p
                aria-hidden
                className="font-num pointer-events-none absolute inset-x-0 top-1/3 animate-[lap_2.5s_ease-out_forwards] text-center text-6xl font-bold text-fg italic [text-shadow:0_2px_16px_rgb(0_0_0/0.8)] motion-reduce:animate-none"
              >
                LAP {lap}
              </p>
            )}
          </div>

          {coach === 0 && <CoachTip step={0} onNext={coachNext} onSkip={saveCoachDone} />}
          <dl className="mt-3 grid grid-cols-3 border-y border-row-me px-4 py-3 text-sm md:px-0">
            <div>
              <dt className="text-muted">순공</dt>
              <dd className="font-num text-2xl tabular-nums">{clock(focusSec(race, now))}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-muted">
                앞 차까지
                {drs && <span className="rounded bg-go px-1 text-[10px] leading-4 font-bold text-black">DRS</span>}
              </dt>
              <dd className="font-num text-2xl tabular-nums" title="쉬지 않고 집중하면 앞 차를 넘기까지 걸리는 시간">
                {!ahead ? "리더" : toAhead !== null ? `+${clock(toAhead).replace(/^0/, "")}` : `${pct(ahead.ratio - mine.ratio)}%p`}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-muted">남은 시간</dt>
              <dd className="font-num text-2xl tabular-nums">{clock(race.duration - el)}</dd>
            </div>
          </dl>

          {(passed.length > 0 || passedBy.length > 0) && (
            <p aria-live="polite" className={`px-4 py-2 text-sm font-semibold md:rounded-lg ${passed.length ? "bg-go text-black" : "bg-light"}`}>
              {passed.length ? `${passed.join(", ")} 선수를 추월했어요` : `${passedBy.join(", ")} 선수에게 추월당했어요`}
            </p>
          )}
          {coach === 1 && <CoachTip step={1} onNext={coachNext} onSkip={saveCoachDone} />}
          {rival ? (
            <RivalCard mine={mine} rival={rival} left={race.duration - el} />
          ) : (
            <p className="px-4 pt-3 text-xs text-subtle md:px-0">
              {hhmm(rivalAt)}에 페이스가 비슷한 선수가 이번 레이스 라이벌로 정해져요.
            </p>
          )}
          {coach === 2 && <CoachTip step={2} onNext={coachNext} onSkip={saveCoachDone} />}
          {coach === 3 && <CoachTip step={3} onNext={coachNext} onSkip={saveCoachDone} pinned />}
          {drs && (
            <p className="px-4 py-2 text-sm text-go md:px-0">
              {off
                ? `복귀해서 ${Math.max(1, Math.ceil(toAhead! / 60))}분 집중하면`
                : toAhead! < 60
                  ? "이대로 집중하면 곧"
                  : `이대로 ${Math.ceil(toAhead! / 60)}분 더 집중하면`}{" "}
              {ahead!.name} 선수를 넘어 P{mine.pos - 1}로 올라가요.
            </p>
          )}
          <p
            role="status"
            className={`flex min-h-10 items-center gap-2 px-4 py-2 text-sm md:rounded-lg ${off || ask ? "bg-pit text-black" : "text-go md:px-0"}`}
          >
            {ask && `아직 공부 중이에요? ${clock(Math.max(0, left))} 안에 답하지 않으면 ${hhmm(checkDue(race))}부터 피트인으로 처리돼요.`}
            {!off && !ask && <span className="size-2 rounded-full bg-go" />}
            {!off && !ask && "집중 중이에요. 뒷 차와 " + (behind ? `${pct(mine.ratio - behind.ratio)}%p 차이` : "차이 없음")}
            {off?.reason === "pit" && `피트인 중 ${clock((now - Math.max(off.since, race.startedAt)) / 1000)}. 순공 시간이 멈춰 있어요.`}
            {off?.reason === "away" && `공부 중인지 묻는 질문에 답이 없어서 ${hhmm(off.since)}부터 피트인으로 처리됐어요.`}
            {off?.reason === "seat" && `${hhmm(off.since)}부터 자리를 비운 것으로 처리했어요. 카메라 앞으로 돌아오면 자동으로 복귀해요.`}
          </p>

          {feed.length > 0 && (
            <section className="px-4 pt-1 pb-2 md:px-0" aria-label="레이스 컨트롤">
              <h2 className="text-xs text-subtle">레이스 컨트롤</h2>
              <ol className="mt-1.5 flex flex-col gap-1 text-sm">
                {feed.map((e) => (
                  <li key={`${e.at}${e.text}`} className="flex gap-3">
                    <span className="font-num w-16 shrink-0 text-subtle tabular-nums">
                      {new Date(e.at).toTimeString().slice(0, 8)}
                    </span>
                    <span className="min-w-0">
                      <span className={e.good ? "text-go" : e.bad ? "text-light" : "text-muted"}>{e.text}</span>
                      {e.quote && (
                        <span className="block text-xs text-subtle">
                          무전 · {e.quote.name}: “{e.quote.line}”
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="flex items-center gap-3 px-4 py-3 md:px-0">
            {cam && (
              <SeatCam
                onFrame={onFrame}
                onFail={() => {
                  setCam(false);
                  setCamFailed(true);
                }}
              />
            )}
            <p className="flex-1 text-sm leading-5 text-muted">
              {cam
                ? "자리에 있는 동안 순공이 쌓여요. 화면은 켜진 채로 두세요. 영상은 이 기기 밖으로 나가지 않아요."
                : camFailed
                  ? "카메라를 켜지 못했어요. 브라우저에서 카메라 권한을 허용했는지 확인해 주세요."
                  : "카메라를 켜면 확인 질문 없이, 자리에 있는 동안 자동으로 순공이 쌓여요."}
            </p>
            <button onClick={() => toggleCam(!cam)} className="h-9 shrink-0 rounded-full border border-line px-4 text-sm">
              {cam ? "카메라 끄기" : "카메라 켜기"}
            </button>
          </div>

          {away !== null && away >= race.startedAt && (
            <AwaySummary then={away} now={now} rowsAt={rowsAt} rows={rows} rival={rival} onClose={() => setAway(null)} />
          )}
          <footer className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-row bg-bg/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] backdrop-blur md:static md:mt-4 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
            <button
              onClick={() => (armed ? onRetire() : setArmed(true))}
              onBlur={() => setArmed(false)}
              className={`h-12 rounded-full border px-5 text-sm ${armed ? "border-danger text-danger" : "border-line text-muted"}`}
            >
              {armed ? "한 번 더 누르면 리타이어" : "리타이어"}
            </button>
            {ask ? (
              <button onClick={() => act("checkin")} className="h-12 flex-1 rounded-full bg-go font-semibold text-black">
                공부 중이에요
              </button>
            ) : (
              <button
                onClick={() => act(off ? "resume" : "pit")}
                className={`h-12 flex-1 rounded-full font-semibold ${off ? "bg-go text-black" : "bg-brand"}`}
              >
                {off ? "트랙으로 복귀" : "피트인 (휴식)"}
              </button>
            )}
          </footer>
        </div>

        <aside className="md:sticky md:top-4 md:max-h-[calc(100dvh-5rem)] md:overflow-y-auto md:rounded-xl md:border md:border-row-me">
          <Tower rows={rows} drs={drs} before={towerBefore} rival={rivalId} />
        </aside>
      </div>
    </main>
  );
}

/** Gone at least this long before coming back gets the "while you were away" summary. */
const AWAY_MS = 2 * 60_000;

/** What changed between `then` (when I last looked) and now. */
function AwaySummary({ then, now, rowsAt, rows, rival, onClose }: { then: number; now: number; rowsAt: (t: number) => Rows; rows: Rows; rival?: Row; onClose: () => void }) {
  const before = rowsAt(then);
  const was = new Map(before.map((r) => [r.id, r]));
  const meThen = before.find((r) => r.me)!;
  const meNow = rows.find((r) => r.me)!;
  const passed = rows.filter((r) => !r.me && was.has(r.id) && was.get(r.id)!.pos < meThen.pos && r.pos > meNow.pos).length;
  const passedBy = rows.filter((r) => !r.me && was.has(r.id) && was.get(r.id)!.pos > meThen.pos && r.pos < meNow.pos).length;
  const rivalThen = rival && was.get(rival.id);
  const gap = (a: Row, b: Row) => `${a.ratio >= b.ratio ? "+" : "-"}${pct(Math.abs(a.ratio - b.ratio))}%p`;
  const lines = [
    `순공 ${hoursMinutes(Math.max(0, meNow.focus - meThen.focus))} 쌓였어요`,
    passed || passedBy ? `${passed}명 추월, ${passedBy}명에게 추월당했어요` : "순위 변동 없이 달렸어요",
    rival && rivalThen ? `라이벌 ${rival.name}와 ${gap(meThen, rivalThen)} → ${gap(meNow, rival)}` : null,
  ].filter(Boolean);
  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-black/60 p-4 md:place-items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-label="자리 비운 동안"
        className="w-full max-w-sm rounded-2xl border border-row-me bg-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-muted">자리 비운 {hoursMinutes((now - then) / 1000)} 동안</p>
        <p className="font-num mt-2 text-6xl leading-none font-bold italic">
          P{meThen.pos}
          <span className="mx-3 text-3xl text-subtle not-italic">→</span>
          <span className={meNow.pos < meThen.pos ? "text-go" : meNow.pos > meThen.pos ? "text-light" : ""}>P{meNow.pos}</span>
        </p>
        <ul className="mt-4 flex flex-col gap-1.5 text-sm">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <button onClick={onClose} className="mt-5 h-11 w-full rounded-full bg-brand font-semibold">
          다시 달리기
        </button>
      </section>
    </div>
  );
}

const COACH = [
  "서킷 위 차 순서가 곧 순위예요. 순공하는 동안만 달리고, 피트인하면 그 자리에 멈춰요.",
  "'앞 차까지'는 쉬지 않고 집중하면 앞 차를 넘기까지 남은 시간이에요. 초록 DRS가 켜지면 곧 추월이에요.",
  "출발 10분 뒤 페이스가 비슷한 선수가 라이벌로 정해져요. 끝날 때까지 이 선수를 이기면 돼요.",
  "쉴 땐 아래 피트인을 누르세요. 조용한 곳이라면 오른쪽 위 스피커로 소리를 진동이나 무음으로 바꿀 수 있어요.",
];

/** One step of the first-race walkthrough, shown right under the part it explains. */
function CoachTip({ step, onNext, onSkip, pinned }: { step: number; onNext: () => void; onSkip: () => void; pinned?: boolean }) {
  return (
    <div
      role="dialog"
      aria-label={`처음 달리는 분께 ${step + 1}/${COACH.length}`}
      className={`z-20 mx-4 mt-3 rounded-lg bg-fg p-3 text-sm text-black shadow-lg md:mx-0 ${pinned ? "fixed inset-x-0 bottom-24 md:static" : "relative"}`}
    >
      {!pinned && <span aria-hidden className="absolute -top-1.5 left-6 size-3 rotate-45 bg-fg" />}
      <p className="leading-6">{COACH[step]}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-num text-xs text-black/60 tabular-nums">
          {step + 1}/{COACH.length}
        </span>
        <span className="flex gap-3">
          <button onClick={onSkip} className="text-black/60">
            건너뛰기
          </button>
          <button onClick={onNext} className="rounded-full bg-black px-3 py-1 font-semibold text-fg">
            {step === COACH.length - 1 ? "달리기" : "다음"}
          </button>
        </span>
      </div>
    </div>
  );
}

/** Head to head with my rival: who's ahead, by how much, and how long until that flips. */
function RivalCard({ mine, rival, left }: { mine: Row; rival: Row; left: number }) {
  const ahead = mine.pos < rival.pos;
  const elapsedOf = (r: Row) => (r.ratio > 0 ? r.focus / r.ratio : 0);
  // I'm behind: unbroken focus from me to pass. I'm ahead: unbroken focus from them to pass me.
  const flip = ahead
    ? catchUpSec(rival.focus, elapsedOf(rival), mine.ratio, Infinity)
    : catchUpSec(mine.focus, elapsedOf(mine), rival.ratio, left);
  // tug of war: the middle is a dead heat, 10%p apart fills the bar
  const share = Math.max(5, Math.min(95, 50 + (mine.ratio - rival.ratio) * 500));
  return (
    <section className="mx-4 mt-3 rounded-lg border border-leader/60 bg-leader/10 p-3 md:mx-0" aria-label="라이벌 맞대결">
      <div className="flex items-center justify-between text-xs">
        <span className="rounded bg-leader px-1.5 py-0.5 font-bold">라이벌</span>
        <span className={ahead ? "text-go" : "text-light"}>{ahead ? "내가 앞서요" : "라이벌이 앞서요"}</span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div>
          <p className="text-sm text-muted">나</p>
          <p className="font-num text-3xl leading-none font-bold">
            P{mine.pos} <span className="text-xl tabular-nums">{pct(mine.ratio)}%</span>
          </p>
        </div>
        <p className="font-num pb-1 text-lg text-subtle italic">VS</p>
        <div className="text-right">
          <p className="truncate text-sm text-muted">
            {rival.name}
            {rival.off && !rival.done && <span className="ml-1 rounded bg-pit px-1 text-[10px] text-black">PIT</span>}
          </p>
          <p className="font-num text-3xl leading-none font-bold">
            <span className="text-xl tabular-nums">{pct(rival.ratio)}%</span> P{rival.pos}
          </p>
        </div>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-row" role="img" aria-label={`나 ${pct(mine.ratio)}%, 라이벌 ${pct(rival.ratio)}%`}>
        <span className="bg-brand transition-[width] duration-700" style={{ width: `${share}%` }} />
        <span className="flex-1 bg-leader" />
      </div>
      <p className="mt-2 text-sm">
        {ahead
          ? flip === null
            ? "라이벌이 따라올 수 없는 차이예요."
            : `라이벌이 쉬지 않으면 ${hoursMinutes(Math.max(60, flip))} 뒤 따라잡혀요.`
          : flip === null
            ? "이번 레이스 안에는 따라잡기 어려워요. 순위를 지켜요."
            : `쉬지 않고 ${hoursMinutes(Math.max(60, flip))} 집중하면 역전해요.`}
      </p>
    </section>
  );
}

const OFF_LABEL = { pit: "피트인", seat: "자리 비움", away: "확인 놓침" } as const;

function Result({
  race,
  rows,
  circuit,
  final,
  prev,
  entryId,
}: {
  race: Race;
  rows: ReturnType<typeof rank>;
  circuit: Circuit;
  final?: Entry; // the server's classification once the whole grid is done
  prev?: Entry; // my previous race of the same kind
  entryId?: number; // set once the server has the finished race, so it has a public card
}) {
  const end = race.endedAt!;
  const mine = rows.find((r) => r.me)!;
  const pos = final?.final_pos ?? mine.pos;
  const lp = final ? final.lp : lpFor(race, mine.pos);
  const span = Math.max(1, end - race.startedAt);
  const offs = race.offs ?? [];
  const better = prev?.final_ratio != null ? mine.ratio - prev.final_ratio : null;
  const [shared, setShared] = useState<string | null>(null);
  const leave = () => {
    saveRace(null);
    saveInvite(null);
  };
  // Fetched ahead of the tap: Safari only opens the share sheet straight from the click.
  const [shareId, setShareId] = useState<string>();
  useEffect(() => {
    if (entryId)
      supabase.rpc("share_link", { p_entry: entryId }).then(({ data }) => data && setShareId(data as string));
  }, [entryId]);
  const [card, setCard] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!shareId) return;
    fetch(`/r/${shareId}/card`)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => setCard({ file: new File([b], "pitin.png", { type: "image/png" }), url: URL.createObjectURL(b) }))
      .catch(() => {});
  }, [shareId, final?.classified]);
  useEffect(() => () => card && URL.revokeObjectURL(card.url), [card]);
  async function shareResult() {
    const title = race.kind === "practice" ? "연습 주행" : `${circuit.name} 그랑프리`;
    const place = race.retired ? "리타이어" : race.kind === "practice" ? "완주" : `P${pos}`;
    const r = await share(
      {
        title: "PITIN",
        text: `${title} ${place} · 집중 비율 ${pct(mine.ratio)}% · 순공 ${hoursMinutes(focusSec(race, end))}`,
        url: shareId ? `${location.origin}/r/${shareId}` : location.origin,
      },
      card?.file,
    );
    setShared(r === "copied" ? (shareId ? "링크를 복사했어요. 붙여넣으면 카드가 보여요." : "결과를 복사했어요.") : r === "failed" ? "공유하지 못했어요." : null);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-8">
      <div
        aria-hidden
        className="h-16 bg-[repeating-conic-gradient(var(--color-fg)_0_25%,var(--color-bg)_0_50%)] bg-size-[32px_32px]"
      />
      <div className="mt-2">
        <Header title={race.kind === "practice" ? "연습 주행" : `${circuit.name} 그랑프리`} />
      </div>

      <section className="mt-6 px-4 text-center">
        <p className="text-muted">{race.retired ? "리타이어했어요. 이번 레이스는 LP를 받지 않아요." : "체커기를 받았어요."}</p>
        <p className="font-num mt-2 text-[128px] leading-[0.85] font-bold italic">{race.retired ? "DNF" : `P${pos}`}</p>
        {race.kind === "gp" && !race.retired && (
          <p className="text-sm text-muted">
            {final
              ? "같은 그리드 전원이 들어온 뒤 확정된 순위예요."
              : `잠정 순위예요. ${hhmm(race.raceAt + CLASSIFY_AFTER)}에 그리드 전원의 결과로 확정돼요.`}
          </p>
        )}
      </section>

      <dl className="mx-4 mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-row-me md:grid-cols-4">
        {[
          ["집중 비율", `${pct(mine.ratio)}%`],
          ["순공 시간", clock(focusSec(race, end))],
          ["레이스 시간", clock(elapsedSec(race, end))],
          ["시즌 포인트", race.kind === "practice" ? "연습" : final ? `+${lp} LP` : `+${lp} LP 예상`],
        ].map(([k, v]) => (
          <div key={k} className="bg-bg p-4">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="font-num text-3xl tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="mx-4 mt-8">
        <h2 className="text-sm text-muted">레이스 리포트</h2>
        <div className="relative mt-3 h-6 overflow-hidden rounded bg-go" role="img" aria-label="집중한 구간(초록)과 멈춘 구간(노랑)">
          {offs.map(([since, until], i) => (
            <span
              key={i}
              className="absolute inset-y-0 bg-pit"
              style={{ left: `${((since - race.startedAt) / span) * 100}%`, width: `${Math.max(0.5, ((until - since) / span) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-subtle">
          <span>{hhmm(race.startedAt)}</span>
          <span>{hhmm(end)}</span>
        </div>
        <ul className="mt-4 grid gap-2 text-sm md:grid-cols-3">
          <li className="rounded-lg bg-row p-3">
            가장 길게 집중한 구간 <span className="mt-1 block text-lg">{hoursMinutes(longestStint(race))}</span>
          </li>
          <li className="rounded-lg bg-row p-3">
            멈춘 횟수
            <span className="mt-1 block text-lg">
              {offs.length
                ? (Object.keys(OFF_LABEL) as (keyof typeof OFF_LABEL)[])
                    .map((k) => [OFF_LABEL[k], offs.filter((o) => o[2] === k).length] as const)
                    .filter(([, n]) => n)
                    .map(([label, n]) => `${label} ${n}회`)
                    .join(", ")
                : "한 번도 멈추지 않았어요"}
            </span>
          </li>
          <li className="rounded-lg bg-row p-3">
            지난 {race.kind === "gp" ? "그랑프리" : "연습"}보다
            <span className={`mt-1 block text-lg ${better === null ? "" : better >= 0 ? "text-go" : "text-light"}`}>
              {better === null ? "첫 기록이에요" : `집중 비율 ${better >= 0 ? "+" : ""}${pct(better)}%p`}
            </span>
          </li>
        </ul>
      </section>

      <div className="mt-6 md:mx-4 md:overflow-hidden md:rounded-lg">
        <Tower rows={rows.filter((r) => r.pos <= 3 || r.me)} gap={false} />
      </div>

      <div className="mx-4 mt-6">
        {card && (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob of our own PNG
          <img src={card.url} width={1200} height={630} alt="공유할 결과 카드" className="mb-3 w-full rounded-lg border border-row-me" />
        )}
        <div className="flex gap-2">
          <button onClick={shareResult} className="h-11 flex-1 rounded-full border border-line text-sm">
            결과 공유하기
          </button>
          {card && (
            <a href={card.url} download="pitin.png" className="grid h-11 place-items-center rounded-full border border-line px-5 text-sm">
              이미지 저장
            </a>
          )}
        </div>
        {shared && <p className="mt-2 text-center text-sm text-muted">{shared}</p>}
      </div>

      <div className="mt-auto flex gap-2 px-4 pt-8">
        <Link href="/home" onClick={leave} className="grid h-12 flex-1 place-items-center rounded-full border border-line">
          홈으로
        </Link>
        <button onClick={leave} className="h-12 flex-1 rounded-full bg-brand font-semibold">
          다음 그랑프리
        </button>
      </div>
    </main>
  );
}
