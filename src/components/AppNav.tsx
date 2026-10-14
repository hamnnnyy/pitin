"use client";

import { ChartColumn, Flag, House, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { label: "홈", href: "/home", Icon: House },
  { label: "레이스", href: "/race", Icon: Flag },
  { label: "리더보드", href: "/leaderboard", Icon: ChartColumn },
  { label: "프로필", href: "/profile", Icon: User },
];

export function AppNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-row bg-bg/95 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] text-sm text-subtle backdrop-blur md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:justify-start md:gap-1 md:border-t-0 md:border-r md:px-4 md:pt-8"
    >
      <Link href="/" className="mb-8 hidden items-center gap-2 px-3 font-semibold text-fg md:flex">
        <Image src="/logo.png" alt="" width={20} height={23} />
        PITIN
      </Link>
      {ITEMS.map(({ label, href, Icon }) => {
        const on = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex w-[72px] flex-col items-center gap-0.5 md:w-auto md:flex-row md:gap-3 md:rounded-lg md:px-3 md:py-2.5 md:text-base ${on ? "text-brand md:bg-row" : "hover:text-fg"}`}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
