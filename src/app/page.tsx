import Image from "next/image";
import Link from "next/link";
import { NextGrandPrix } from "@/components/NextGrandPrix";
import { RaceDemo } from "@/components/RaceDemo";
import { CIRCUITS } from "@/lib/circuits";
import { LP_TABLE, PROMOTE_LP, RELEGATE_LP } from "@/lib/race";

const PHOTO = CIRCUITS[1].photo;

const PHASES = [
  {
    name: "그리드",
    time: "정각과 30분",
    body: "30분마다 그랑프리가 열려요. 얼마나 달릴지는 30분부터 2시간까지 각자 정해요.",
  },
  {
    name: "레이스",
    time: "내가 정한 시간",
    body: "순공하는 동안에만 차가 달려요. 순위는 달린 시간 중 순공 시간의 비율이에요.",
  },
  {
    name: "피트인",
    time: "언제든",
    body: "쉬어도 돼요. 대신 차가 멈춰요. 카메라를 켜 두면 자리에 있는 동안만 달리고, 영상은 기기 밖으로 나가지 않아요.",
  },
  {
    name: "체커기",
    time: "끝",
    body: `1위 ${LP_TABLE[0]} LP부터 10위 ${LP_TABLE[9]} LP까지 받아요. 중간에 그만두면 리타이어로 0 LP예요.`,
  },
];

const ON_TRACK = [
  { name: "DRS", body: "앞 차를 10분 안에 넘을 수 있으면 초록 불이 켜지고, 몇 분 더 집중하면 추월인지 알려줘요." },
  { name: "라이벌", body: "출발 10분 뒤 페이스가 비슷한 선수가 라이벌로 정해져요. 맞대결 판에서 역전까지 남은 시간이 보여요." },
  { name: "레이스 컨트롤", body: "추월, 피트인, 선두 교체가 실시간으로 쌓이고, AI 선수들은 무전으로 한마디씩 남겨요." },
  { name: "자리 비운 동안", body: "폰을 내려놓고 공부하다 다시 보면, 그사이 순위가 어떻게 바뀌었는지 한 장으로 보여줘요." },
];

const DIVISIONS = [
  { name: "F3", range: "모두 여기서 출발", body: `시즌 ${PROMOTE_LP} LP를 모으면 F2로 올라가요.` },
  { name: "F2", range: `승격 ${PROMOTE_LP} LP · 강등 ${RELEGATE_LP} LP 미만`, body: "꾸준히 그리드에 서는 사람들의 리그." },
  { name: "F1", range: `잔류 ${RELEGATE_LP} LP 이상`, body: "가장 오래 집중하는 사람들끼리 달려요." },
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <header className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/logo.png" alt="" width={20} height={23} />
          PITIN
        </Link>
        <Link href="/home" className="text-sm text-muted hover:text-fg">
          앱 열기
        </Link>
      </header>

      <section className="grid items-center gap-12 pt-10 pb-24 md:grid-cols-[1fr_420px] md:pt-20">
        <div>
          <h1 className="text-[56px] leading-[1.05] font-extrabold tracking-[-0.03em] md:text-[96px]">
            집중한 만큼
            <br />
            달린다.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-muted">
            PITIN은 순공 시간으로 순위를 매기는 공부 레이스예요. 30분마다 열리는 그랑프리에서 같은 디비전 선수 최대 20명이 함께 달리고,
            빈자리는 AI 선수가 채워요.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/onboarding"
              className="grid h-14 place-items-center rounded-full bg-brand px-8 text-lg font-semibold"
            >
              레이스 참가하기
            </Link>
            <p className="text-sm text-muted">
              <NextGrandPrix />
            </p>
          </div>
        </div>
        <RaceDemo />
      </section>

      <section className="border-t border-row-me py-20" aria-labelledby="how">
        <h2 id="how" className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">
          그랑프리 한 판은 이렇게 흘러가요
        </h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-row-me md:grid-cols-4">
          {PHASES.map((p) => (
            <li key={p.name} className="flex flex-col gap-3 bg-bg p-6">
              <span className="font-num text-lg text-muted">{p.time}</span>
              <h3 className="text-2xl font-bold">{p.name}</h3>
              <p className="leading-7 text-muted">{p.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-row-me py-20" aria-labelledby="track">
        <h2 id="track" className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">
          달리는 동안 심심할 틈이 없어요
        </h2>
        <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {ON_TRACK.map((f) => (
            <div key={f.name} className="border-l-2 border-brand pl-5">
              <dt className="font-num text-3xl font-bold italic">{f.name}</dt>
              <dd className="mt-2 max-w-md leading-7 text-muted">{f.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-row-me py-20" aria-labelledby="div">
        <h2 id="div" className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">
          시즌 동안 LP를 모아 올라가요
        </h2>
        <p className="mt-4 max-w-xl leading-7 text-muted">
          시즌은 한 달이에요. 시즌 동안 모은 LP로 다음 달 디비전이 정해지고, 각 디비전은 자기들끼리 같은 그리드에서 달려요.
        </p>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {DIVISIONS.map((d) => (
            <li
              key={d.name}
              className={`rounded-2xl border p-6 ${d.name === "F1" ? "border-brand" : "border-row-me"}`}
            >
              <p
                className={`font-num text-[96px] leading-[0.85] font-bold italic ${d.name === "F1" ? "text-brand" : ""}`}
              >
                {d.name}
              </p>
              <p className="font-num mt-4 text-lg text-muted">{d.range}</p>
              <p className="mt-1">{d.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="relative isolate -mx-4 overflow-hidden px-4 py-24 text-center md:-mx-8 md:rounded-3xl">
        <Image src={PHOTO.src} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-30" />
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-6 bg-[repeating-conic-gradient(var(--color-fg)_0_25%,transparent_0_50%)] bg-size-[24px_24px] opacity-80" />
        <h2 className="text-4xl leading-tight font-extrabold tracking-[-0.03em] md:text-6xl">
          다음 출발,
          <br />
          그리드에서 만나요.
        </h2>
        <Link
          href="/onboarding"
          className="mx-auto mt-10 grid h-14 w-fit place-items-center rounded-full bg-brand px-8 text-lg font-semibold"
        >
          레이스 참가하기
        </Link>
      </section>

      <footer className="flex flex-col gap-2 py-10 text-xs text-subtle md:flex-row md:justify-between">
        <span>
          © PITIN ·{" "}
          <Link href="/privacy" className="underline">
            개인정보처리방침
          </Link>
        </span>
        <span>
          서킷 데이터: bacinger/f1-circuits (MIT).{" "}
          <a href={PHOTO.href} className="underline" target="_blank" rel="noreferrer">
            {PHOTO.credit}
          </a>
        </span>
      </footer>
    </div>
  );
}
