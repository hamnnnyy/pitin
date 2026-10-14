import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-num text-[120px] leading-none font-bold italic">DNF</p>
      <h1 className="text-xl font-bold">이 페이지는 트랙에 없어요</h1>
      <p className="text-muted">주소가 바뀌었거나 지워진 페이지예요.</p>
      <Link href="/home" className="mt-4 grid h-12 place-items-center rounded-full bg-brand px-8 font-semibold">
        홈으로 가기
      </Link>
    </main>
  );
}
