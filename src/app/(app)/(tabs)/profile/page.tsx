"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PlayerStats } from "@/components/PlayerStats";
import { authErrorFromUrl, deleteAccount, googleEmail, linkGoogle, renamePlayer, signOut, useUser } from "@/lib/account";
import { invalidate, nameTaken, type Profile as Me, updateAvatar, USERNAME, updateProfile, useMyProfile, useRaces, useSeason } from "@/lib/data";
import { disablePush, enablePush, pushStatus } from "@/lib/push";
import { GOAL_CHOICES, hoursMinutes } from "@/lib/race";
import { useNow } from "@/lib/useNow";

export default function Profile() {
  const { data, refresh } = useMyProfile();
  const [photoError, setPhotoError] = useState(false);
  const me = data!;
  const now = useNow(60_000);
  const races = useRaces(me.id).data ?? [];
  const lp = useSeason().data?.find((s) => s.user_id === me.id)?.lp ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4 md:gap-6">
        <label className="group relative cursor-pointer" aria-label="프로필 사진 바꾸기">
          <Avatar profile={me} size={88} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
            사진 바꾸기
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await updateAvatar(f).then(refresh, () => setPhotoError(true));
            }}
          />
        </label>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold">{me.name}</h1>
          <p className="mt-1 text-muted">
            <span className="font-num text-xl font-bold text-brand italic">{me.division}</span> · 이번 시즌 {lp} LP
          </p>
          {photoError && <p className="mt-1 text-sm text-danger">사진을 올리지 못했어요. 다른 이미지로 다시 시도해 주세요.</p>}
          {me.goals.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {me.goals.map((g) => (
                <li key={g} className="rounded-full bg-row px-2.5 py-1 text-xs text-muted">
                  {g}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {now > 0 && <PlayerStats races={races} now={now} />}

      <DailyGoal me={me} />
      <Alerts me={me} />
      <Account me={me} />
    </div>
  );
}

function DailyGoal({ me }: { me: Me }) {
  const [goal, setGoal] = useState(me.daily_goal);
  return (
    <section>
      <h2 className="text-xl font-bold">하루 목표</h2>
      <p className="mt-1 text-sm text-muted">홈에서 오늘 얼마나 채웠는지 보여드려요.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6">
        {GOAL_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={goal === m}
            onClick={() => {
              setGoal(m);
              updateProfile({ daily_goal: m }).catch(() => setGoal(goal));
            }}
            className={`h-11 rounded-lg border ${goal === m ? "border-brand bg-brand/10 text-fg" : "border-line text-muted"}`}
          >
            {hoursMinutes(m * 60)}
          </button>
        ))}
      </div>
    </section>
  );
}

const STATUS_TEXT = {
  on: "이 기기로 알림이 와요. 레이스 중에는 20분마다 공부 중인지 묻는 알림이 와요.",
  off: "알림을 켜면 폰을 내려놔도 레이스 중 확인 질문과 그랑프리 출발 알림을 받을 수 있어요.",
  denied: "브라우저 설정에서 PITIN 알림이 차단돼 있어요. 설정에서 알림을 허용한 뒤 이 페이지를 다시 열어 주세요.",
  install: "iPhone은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요. Safari 공유 버튼에서 '홈 화면에 추가'를 누르고, 추가된 앱으로 열어 주세요.",
  unsupported: "이 브라우저는 푸시 알림을 지원하지 않아요.",
};

function Alerts({ me }: { me: Me }) {
  const [status, setStatus] = useState(pushStatus);
  const [hours, setHours] = useState(me.remind_hours);
  const [friends, setFriends] = useState(me.friend_alerts);
  const [problem, setProblem] = useState<string | null>(null);

  async function turnOn() {
    setProblem(null);
    try {
      await enablePush();
    } catch {
      setProblem("알림을 켜지 못했어요. 알림 권한을 허용했는지 확인하고 다시 시도해 주세요.");
    }
    setStatus(pushStatus());
  }

  function toggle(h: number) {
    const next = hours.includes(h) ? hours.filter((x) => x !== h) : [...hours, h].sort((a, b) => a - b);
    setHours(next);
    updateProfile({ remind_hours: next }).catch(() => {
      setHours(hours);
      setProblem("알림 시간을 저장하지 못했어요. 다시 시도해 주세요.");
    });
    if (status === "off" && next.length > hours.length) turnOn();
  }

  return (
    <section id="alerts">
      <h2 className="text-xl font-bold">알림</h2>
      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-row p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-muted">{STATUS_TEXT[status]}</p>
        {status === "off" && (
          <button onClick={turnOn} className="h-11 shrink-0 rounded-full bg-brand px-5 font-semibold">
            알림 켜기
          </button>
        )}
        {status === "on" && (
          <button
            onClick={() => disablePush().finally(() => setStatus(pushStatus()))}
            className="h-11 shrink-0 rounded-full border border-line px-5 text-muted"
          >
            알림 끄기
          </button>
        )}
      </div>
      {problem && <p className="mt-2 text-sm text-danger">{problem}</p>}

      <fieldset className="mt-6">
        <legend className="text-sm text-muted">출발 5분 전에 알려줄 시간대 (정각과 30분 그랑프리 모두)</legend>
        <div className="mt-2 grid grid-cols-6 gap-1.5 md:grid-cols-12">
          {Array.from({ length: 24 }, (_, h) => (
            <button
              key={h}
              type="button"
              aria-pressed={hours.includes(h)}
              onClick={() => toggle(h)}
              className={`font-num h-10 rounded-lg border tabular-nums ${hours.includes(h) ? "border-brand bg-brand/10 text-fg" : "border-line text-muted"}`}
            >
              {h}시
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-row p-4">
        <span className="text-sm leading-6">
          팔로우한 선수가 그리드에 서면 알려줘요
          <span className="block text-muted">그 그랑프리에 바로 합류할 수 있어요.</span>
        </span>
        <input
          type="checkbox"
          checked={friends}
          onChange={(e) => {
            const on = e.target.checked;
            setFriends(on);
            updateProfile({ friend_alerts: on }).catch(() => {
              setFriends(!on);
              setProblem("설정을 저장하지 못했어요. 다시 시도해 주세요.");
            });
            if (on && status === "off") turnOn();
          }}
          className="size-5 shrink-0 accent-[var(--color-brand)]"
        />
      </label>
    </section>
  );
}

function Account({ me }: { me: Me }) {
  const user = useUser();
  const [name, setName] = useState(me.name);
  const [problem, setProblem] = useState<string | null>(() =>
    authErrorFromUrl() === "identity_already_exists"
      ? "이 구글 계정은 이미 다른 PITIN 계정에 연결돼 있어요. 로그아웃한 뒤 구글로 로그인하면 그 계정으로 들어가요."
      : authErrorFromUrl()
        ? "구글 계정을 연결하지 못했어요. 다시 시도해 주세요."
        : null,
  );
  const [saved, setSaved] = useState(false);
  const [armed, setArmed] = useState<"out" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const anonymous = !!user.is_anonymous;
  const email = googleEmail(user);

  async function rename() {
    setProblem(null);
    setSaved(false);
    if (!USERNAME.test(name)) return setProblem("아이디는 영문 소문자, 숫자, 특수문자(., _)로 2–20자만 쓸 수 있어요.");
    setBusy(true);
    try {
      if (await nameTaken(name)) return setProblem("이미 누가 쓰고 있는 아이디예요. 다른 아이디를 골라 주세요.");
      await renamePlayer(name);
      await Promise.all([invalidate("me"), invalidate("season")]);
      setSaved(true);
    } catch {
      setProblem("아이디를 바꾸지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<void>, failure: string) {
    setBusy(true);
    setProblem(null);
    await fn().catch(() => setProblem(failure));
    setBusy(false);
  }

  return (
    <section id="account" className="flex flex-col gap-6">
      <h2 className="text-xl font-bold">계정</h2>

      <div className="flex flex-col gap-3 rounded-xl bg-row p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-muted">
          {anonymous
            ? "아직 이 브라우저에만 저장된 계정이에요. 구글 계정을 연결하면 기기를 바꾸거나 브라우저 데이터를 지워도 기록이 남아요."
            : `구글 계정${email ? ` ${email}` : ""}에 연결돼 있어요. 다른 기기에서는 구글로 로그인하면 이어서 달릴 수 있어요.`}
        </p>
        {anonymous && (
          <button
            onClick={() => run(linkGoogle, "구글 연결을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.")}
            disabled={busy}
            className="h-11 shrink-0 rounded-full bg-fg px-5 font-semibold text-bg disabled:opacity-50"
          >
            구글 계정 연결
          </button>
        )}
      </div>

      <label className="flex flex-col gap-2 text-sm text-muted">
        아이디
        <span className="flex gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value.trim());
              setSaved(false);
            }}
            autoCapitalize="none"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 text-base text-fg outline-none focus:border-brand"
          />
          <button
            onClick={rename}
            disabled={busy || name === me.name}
            className="h-11 shrink-0 rounded-full border border-line px-5 text-fg disabled:opacity-40"
          >
            {saved ? "바꿨어요" : "바꾸기"}
          </button>
        </span>
      </label>

      {problem && <p className="text-sm text-danger">{problem}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => (armed === "out" || !anonymous ? run(signOut, "로그아웃하지 못했어요.") : setArmed("out"))}
          onBlur={() => setArmed(null)}
          disabled={busy}
          className={`h-11 rounded-full border px-5 text-sm ${armed === "out" ? "border-danger text-danger" : "border-line text-muted"}`}
        >
          {armed === "out" ? "연결 안 된 계정은 되찾을 수 없어요. 한 번 더 누르면 로그아웃" : "로그아웃"}
        </button>
        <button
          onClick={() => (armed === "delete" ? run(deleteAccount, "계정을 삭제하지 못했어요. 다시 시도해 주세요.") : setArmed("delete"))}
          onBlur={() => setArmed(null)}
          disabled={busy}
          className={`h-11 rounded-full border px-5 text-sm ${armed === "delete" ? "border-danger text-danger" : "border-line text-muted"}`}
        >
          {armed === "delete" ? "기록이 모두 지워져요. 한 번 더 누르면 삭제" : "계정 삭제"}
        </button>
      </div>
      <Link href="/privacy" className="text-sm text-subtle underline underline-offset-4">
        개인정보처리방침
      </Link>
    </section>
  );
}
