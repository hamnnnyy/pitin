import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCard } from "@/lib/card";
import { hoursMinutes, pct } from "@/lib/race";

export async function generateMetadata({ params }: PageProps<"/r/[id]">): Promise<Metadata> {
  const { id } = await params;
  const card = await loadCard(id);
  if (!card) return {};
  const title = `${card.name} · ${card.title} ${card.place}`;
  const description = `집중 비율 ${pct(card.ratio)}% · 순공 ${hoursMinutes(card.focus)}. PITIN에서 같이 달려요.`;
  const images = [{ url: `/r/${id}/card`, width: 1200, height: 630 }];
  return { title, description, openGraph: { title, description, images }, twitter: { card: "summary_large_image", images } };
}

/** Public landing for a shared result: the card, then a way in. */
export default async function SharedResult({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const card = await loadCard(id);
  if (!card) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- already a sized PNG from our own route */}
      <img
        src={`/r/${id}/card`}
        width={1200}
        height={630}
        alt={`${card.name}의 ${card.title} 결과: ${card.place}, 집중 비율 ${pct(card.ratio)}%`}
        className="w-full rounded-xl border border-row-me"
      />
      <div>
        <h1 className="text-2xl font-bold">
          {card.name}님이 {card.title}에서 {card.retired ? "리타이어했어요" : card.gp ? `${card.place}로 들어왔어요` : "완주했어요"}.
        </h1>
        <p className="mt-2 text-muted">
          PITIN은 순공 시간으로 순위를 매기는 공부 레이스예요. 30분마다 그랑프리가 열려요.
        </p>
      </div>
      <Link href="/home" className="grid h-14 place-items-center rounded-full bg-brand text-lg font-semibold">
        나도 레이스 참가하기
      </Link>
    </main>
  );
}
