"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/Status";
import { useMyProfile } from "@/lib/data";

/** Sends players without a profile to onboarding; shows nothing until we know. */
export function RequireProfile({ children }: { children: React.ReactNode }) {
  const { data, error, refresh } = useMyProfile();
  const router = useRouter();
  useEffect(() => {
    if (data === null) router.replace("/onboarding");
  }, [data, router]);

  if (error)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p>서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.</p>
          <button onClick={refresh} className="mt-4 h-11 rounded-full border border-line px-5">
            다시 시도
          </button>
        </div>
      </div>
    );
  if (!data) return <Skeleton />;
  return children;
}
