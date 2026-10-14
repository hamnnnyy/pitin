"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { Countdown } from "@/components/Countdown";
import { TrackMap } from "@/components/TrackMap";
import { circuitFor } from "@/lib/circuits";
import { useMyProfile, usePlayer } from "@/lib/data";
import { hhmm, LATE_JOIN_MS } from "@/lib/race";
import { saveInvite } from "@/lib/store";
import { useNow } from "@/lib/useNow";

export default function JoinPage() {
  return (
    <Suspense>
      <Join />
    </Suspense>
  );
}

/** Landing for a friend's invite link: who invited, which grand prix, then onto their grid. */
function Join() {
  const slot = Number(useParams<{ slot: string }>().slot);
  const friendId = useSearchParams().get("with") ?? "";
  const router = useRouter();
  const now = useNow(1000);
  const invited = usePlayer(friendId);
  const friend = invited.error ? null : invited.data; // a broken link shows no inviter
  const me = useMyProfile();
  if (!now || friend === undefined || me.data === undefined) return <main className="flex-1" />;

  const circuit = circuitFor(slot);
  const closed = !Number.isFinite(slot) || now >= slot + LATE_JOIN_MS;

  function accept() {
    saveInvite({ raceAt: slot, with: friend!.id, name: friend!.name, division: friend!.division });
    router.push(me.data ? "/race" : "/onboarding");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-10 pb-8">
      {friend && (
        <div className="flex items-center gap-3">
          <Avatar profile={friend} size={48} />
          <p className="leading-6">
            <span className="font-semibold">{friend.name}</span> 선수가
            <br />
            같이 달리자고 초대했어요.
          </p>
        </div>
      )}
      <TrackMap circuit={circuit} className="max-h-72" />
      <div>
        <h1 className="text-2xl font-bold">
          {hhmm(slot)} {circuit.name} 그랑프리
        </h1>
        <p className="mt-1 text-muted">
          {closed ? "이 그랑프리는 합류가 끝났어요." : now >= slot ? "진행 중이에요. 합류 마감까지 " : "출발까지 "}
          {!closed && (
            <span className="font-num text-lg text-fg">
              <Countdown at={now >= slot ? slot + LATE_JOIN_MS : slot} />
            </span>
          )}
        </p>
        {friend && !closed && (
          <p className="mt-3 text-sm leading-6 text-muted">
            {friend.name} 선수의 {friend.division} 그리드에서 함께 달려요. 받은 LP는 내 시즌에 쌓여요.
          </p>
        )}
      </div>
      {closed || !friend ? (
        <Link href="/home" className="mt-auto grid h-12 place-items-center rounded-full bg-brand font-semibold">
          다음 그랑프리 보기
        </Link>
      ) : (
        <button onClick={accept} className="mt-auto h-12 rounded-full bg-brand font-semibold">
          {me.data ? "그리드로 가기" : "시작하고 같이 달리기"}
        </button>
      )}
    </main>
  );
}
