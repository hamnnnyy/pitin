"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Any page that throws ends up here instead of a blank screen. A race in progress keeps running on the server. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-num text-[120px] leading-none font-bold italic text-pit">PIT</p>
      <h1 className="text-xl font-bold">화면을 그리다 문제가 생겼어요</h1>
      <p className="leading-7 text-muted">
        달리던 레이스는 서버에서 계속 기록되고 있어요. 다시 시도해도 안 되면 홈으로 가서 레이스로 돌아와 주세요.
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={retry} className="h-12 rounded-full bg-brand px-8 font-semibold">
          다시 시도
        </button>
        <Link href="/home" className="grid h-12 place-items-center rounded-full border border-line px-6">
          홈으로
        </Link>
      </div>
    </main>
  );
}
