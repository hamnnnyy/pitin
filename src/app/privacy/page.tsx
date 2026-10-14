import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보처리방침 · PITIN" };

const CONTACT = "haminni.dev@gmail.com";

const SECTIONS: [string, React.ReactNode][] = [
  [
    "모으는 정보",
    <ul key="a" className="list-disc space-y-1 pl-5">
      <li>계정: 처음 방문할 때 만들어지는 익명 계정 식별자, 아이디, 프로필 사진(올린 경우), 공부 목표와 하루 목표 시간</li>
      <li>레이스 기록: 출발·피트인·복귀·완주 시각, 순공 시간, 집중 비율, 순위, LP, 디비전</li>
      <li>팔로우한 선수 목록</li>
      <li>알림을 켠 경우: 브라우저가 발급한 푸시 수신 주소, 알림 받을 시간대</li>
      <li>구글 계정을 연결한 경우: 구글 계정 식별자와 이메일 주소</li>
    </ul>,
  ],
  [
    "카메라",
    <p key="b">
      카메라 영상은 이 기기 안에서 자리에 사람이 있는지 판별하는 데만 쓰고, 저장하거나 서버로 보내지 않아요. 서버에 남는 것은
      자리를 비운 시작 시각과 돌아온 시각뿐이에요.
    </p>,
  ],
  [
    "쓰는 곳",
    <p key="c">
      레이스 순위와 리더보드, 디비전 승강, 공부 기록, 친구 기능, 레이스 확인 질문과 그랑프리 출발 알림, 다른 기기에서의 로그인에만 써요.
      광고나 판매에는 쓰지 않아요.
    </p>,
  ],
  [
    "보관 기간",
    <p key="d">
      계정을 삭제하면 계정과 모든 기록을 바로 지워요. 프로필을 만들지 않은 익명 계정은 하루 뒤 자동으로 지워요. 아이디와 레이스 기록,
      시즌 순위는 다른 선수에게도 보여요. 레이스 결과를 공유하면 그 링크를 가진 누구나 결과 카드(아이디, 순위, 순공 시간)를
      볼 수 있어요.
    </p>,
  ],
  [
    "맡기는 곳",
    <ul key="e" className="list-disc space-y-1 pl-5">
      <li>Supabase: 계정, 데이터베이스, 프로필 사진 저장 (서울 리전)</li>
      <li>Google: 구글 계정 로그인 (연결한 경우)</li>
      <li>브라우저 푸시 서비스(Google, Apple, Mozilla): 알림 전달 (알림을 켠 경우)</li>
    </ul>,
  ],
  [
    "직접 할 수 있는 것",
    <p key="f">
      프로필에서 아이디·사진·목표를 바꾸고, 알림을 끄고, 계정을 삭제할 수 있어요. 계정 삭제는 프로필 맨 아래의 계정 삭제 버튼으로 바로
      처리돼요.
    </p>,
  ],
];

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 leading-7">
      <Link href="/" className="text-sm text-muted">
        PITIN
      </Link>
      <h1 className="mt-4 text-3xl font-bold">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-muted">시행일 2026년 10월 12일</p>
      {SECTIONS.map(([title, body]) => (
        <section key={title} className="mt-10">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="mt-2 text-muted">{body}</div>
        </section>
      ))}
      {CONTACT && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">문의</h2>
          <a href={`mailto:${CONTACT}`} className="mt-2 block text-muted underline">
            {CONTACT}
          </a>
        </section>
      )}
    </main>
  );
}
