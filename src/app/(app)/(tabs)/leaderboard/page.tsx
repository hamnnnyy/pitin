"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { FriendSearch } from "@/components/FriendSearch";
import { type Standing, useFollowing, useMyProfile, useSeason } from "@/lib/data";
import { DIVISIONS, type Division, hoursMinutes, PROMOTE_LP, RELEGATE_LP } from "@/lib/race";

const METRICS = [
  { id: "lp", label: "시즌 포인트" },
  { id: "focus", label: "순공 시간" },
] as const;

type Group = Division | "following";

export default function Leaderboard() {
  const me = useMyProfile().data!;
  const [group, setGroup] = useState<Group>(me.division);
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("lp");
  const { data, error, refresh } = useSeason();
  const following = useFollowing().data ?? [];
  const rows: Standing[] = (data ?? [])
    .filter((s) => (group === "following" ? following.includes(s.user_id) || s.user_id === me.id : s.division === group))
    .sort((a, b) => (metric === "lp" ? b.lp - a.lp || b.focus_sec - a.focus_sec : b.focus_sec - a.focus_sec));
  const month = new Date().getMonth() + 1;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold">리더보드</h1>
        <p className="mt-1 text-sm text-muted">
          {month}월 시즌. 시즌 LP {PROMOTE_LP} 이상이면 다음 달에 승격하고, F1·F2에서 {RELEGATE_LP} 미만이면 강등돼요.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="디비전" className="flex gap-1.5">
          {[...DIVISIONS, "following" as const].map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={group === g}
              onClick={() => setGroup(g)}
              className={`h-9 rounded-full border px-4 text-sm ${group === g ? "border-brand bg-brand/10 font-semibold" : "border-line text-muted"} ${g === "following" ? "" : "font-num italic"}`}
            >
              {g === "following" ? "팔로잉" : g}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="기준" className="flex rounded-full bg-row p-1 text-sm">
          {METRICS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={metric === t.id}
              onClick={() => setMetric(t.id)}
              className={`h-8 rounded-full px-4 ${metric === t.id ? "bg-fg font-semibold text-bg" : "text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {group === "following" && <FriendSearch />}

      {error && (
        <p className="text-sm text-danger">
          순위를 불러오지 못했어요.{" "}
          <button onClick={refresh} className="underline">
            다시 시도
          </button>
        </p>
      )}

      <ol className="overflow-hidden rounded-xl border border-row-me">
        {rows.map((s, i) => {
          const mine = s.user_id === me.id;
          const up = s.division !== "F1" && s.lp >= PROMOTE_LP;
          const down = s.division !== "F3" && s.lp < RELEGATE_LP;
          return (
            <li key={s.user_id} className={`border-l-4 ${mine ? "border-brand bg-row-me" : "border-transparent odd:bg-row"}`}>
              <Link href={mine ? "/profile" : `/player/${s.user_id}`} className="flex items-center gap-3 px-3 py-3 md:gap-4 md:px-5">
                <span
                  className={`font-num w-8 text-right text-2xl font-bold italic ${i === 0 ? "text-gold" : i === 1 ? "text-fg" : i === 2 ? "text-bronze" : "text-muted"}`}
                >
                  {i + 1}
                </span>
                <Avatar profile={s} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {s.name}
                    {mine && <span className="ml-1.5 text-xs text-brand">나</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {s.division} · 완주 {s.races}회
                    {metric === "lp" && up && <span className="ml-1.5 text-go">승격권</span>}
                    {metric === "lp" && down && <span className="ml-1.5 text-light">강등권</span>}
                  </p>
                </div>
                <span className="font-num text-right text-xl tabular-nums">
                  {metric === "lp" ? (
                    <>
                      {s.lp} <span className="text-sm text-brand">LP</span>
                    </>
                  ) : (
                    <span className="font-sans text-base">{hoursMinutes(s.focus_sec)}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
        {data && rows.length === 0 && (
          <li className="p-6 text-center text-muted">
            {group === "following" ? "팔로우한 선수가 없어요. 위에서 아이디로 친구를 찾아 팔로우해 보세요." : "이 디비전에는 아직 선수가 없어요."}
          </li>
        )}
      </ol>
    </div>
  );
}
