"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { searchPlayers, setFollow, useFollowing } from "@/lib/data";

/** Find a player by name and follow them right from the results. */
export function FriendSearch() {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Awaited<ReturnType<typeof searchPlayers>> | null>(null);
  const following = useFollowing().data ?? [];
  const term = q.trim().toLowerCase();

  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(() => searchPlayers(term).then((r) => live && setFound(r), () => live && setFound([])), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);
  const results = term.length < 2 ? null : found;

  return (
    <section aria-label="친구 찾기">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="아이디로 친구 찾기"
        autoCapitalize="none"
        autoCorrect="off"
        className="h-11 w-full rounded-full border border-line bg-transparent px-4 placeholder:text-placeholder"
      />
      {results && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-row-me">
          {results.map((p) => {
            const on = following.includes(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 odd:bg-row">
                <Link href={`/player/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar profile={p} size={32} />
                  <span className="truncate">{p.name}</span>
                  <span className="font-num text-xs text-muted italic">{p.division}</span>
                </Link>
                <button
                  onClick={() => setFollow(p.id, !on).catch(() => {})}
                  className={`h-8 shrink-0 rounded-full px-4 text-sm ${on ? "border border-line text-muted" : "bg-brand font-semibold"}`}
                >
                  {on ? "팔로잉" : "팔로우"}
                </button>
              </li>
            );
          })}
          {results.length === 0 && <li className="p-4 text-center text-sm text-muted">&apos;{term}&apos;(으)로 시작하는 선수가 없어요.</li>}
        </ul>
      )}
    </section>
  );
}
