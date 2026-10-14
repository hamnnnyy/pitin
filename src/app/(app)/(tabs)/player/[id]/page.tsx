"use client";

import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PlayerStats } from "@/components/PlayerStats";
import { setFollow, useFollowerCount, useFollowing, useMyProfile, usePlayer, useRaces, useSeason } from "@/lib/data";
import { useNow } from "@/lib/useNow";

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMyProfile().data!;
  const { data: player, error } = usePlayer(id);
  const races = useRaces(id).data ?? [];
  const lp = useSeason().data?.find((s) => s.user_id === id)?.lp ?? 0;
  const following = useFollowing();
  const followers = useFollowerCount(id);
  const [busy, setBusy] = useState(false);
  const now = useNow(60_000);

  useEffect(() => {
    if (id === me.id) router.replace("/profile");
  }, [id, me.id, router]);
  if (error || player === null)
    return <p className="rounded-lg bg-row p-4 text-muted">선수를 찾지 못했어요. 리더보드에서 다시 골라 주세요.</p>;
  if (!player) return null;

  const on = following.data?.includes(id) ?? false;
  async function toggle() {
    setBusy(true);
    await setFollow(id, !on).catch(() => {});
    await Promise.all([following.refresh(), followers.refresh()]);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <button onClick={() => router.back()} className="-mb-4 flex items-center gap-1 self-start text-sm text-muted">
        <ChevronLeft size={18} /> 뒤로
      </button>
      <header className="flex items-center gap-4 md:gap-6">
        <Avatar profile={player} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">{player.name}</h1>
          <p className="mt-1 text-muted">
            <span className="font-num text-xl font-bold text-brand italic">{player.division}</span> · 이번 시즌 {lp} LP · 팔로워{" "}
            {followers.data ?? 0}
          </p>
          {player.goals.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {player.goals.map((g) => (
                <li key={g} className="rounded-full bg-row px-2.5 py-1 text-xs text-muted">
                  {g}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={toggle}
          disabled={busy || !following.data}
          aria-pressed={on}
          className={`h-10 shrink-0 rounded-full px-5 text-sm font-semibold disabled:opacity-50 ${on ? "border border-line text-muted" : "bg-brand"}`}
        >
          {on ? "팔로잉" : "팔로우"}
        </button>
      </header>

      {now > 0 && <PlayerStats races={races} now={now} />}
    </div>
  );
}
