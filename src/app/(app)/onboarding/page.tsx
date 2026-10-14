"use client";

import { BookOpen, CircleX, CodeXml, Ellipsis, GraduationCap } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signInWithGoogle } from "@/lib/account";
import { createProfile, nameTaken, USERNAME, useMyProfile } from "@/lib/data";
import { loadInvite } from "@/lib/store";
import { GOAL_CHOICES, hoursMinutes, PROMOTE_LP } from "@/lib/race";

const SUBTITLES = [
  "레이스에서 사용할 이름을 설정해주세요.",
  "레이스에서 사용할 프로필을 설정해주세요.",
  "무엇을 위해 달리시나요? (1개 이상)",
  "하루에 얼마나 공부할까요?",
  "이렇게 달려요.",
];

const RULES = [
  ["순공 비율로 순위", "각자 달린 시간 중 실제로 공부한 시간의 비율로 순위가 정해져요."],
  ["30분마다 그랑프리", "정각과 30분에 출발해요. 달릴 시간은 30분부터 2시간까지 직접 골라요."],
  ["카메라로 자리 확인", "카메라를 켜 두면 자리에 있는 동안만 차가 달려요. 영상은 기기 밖으로 나가지 않아요."],
  ["LP와 디비전", `순위만큼 LP를 받아요. 한 달 동안 ${PROMOTE_LP} LP를 모으면 F3에서 F2, F1로 올라가요.`],
];

const GOALS = [
  { label: "시험 공부", Icon: GraduationCap },
  { label: "개발 / 코딩", Icon: CodeXml },
  { label: "독서", Icon: BookOpen },
  { label: "기타", Icon: Ellipsis },
];


export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [daily, setDaily] = useState(180);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const existing = useMyProfile().data;

  useEffect(() => {
    if (existing) router.replace("/home");
  }, [existing, router]);

  const formatError = name !== "" && !USERNAME.test(name);
  const nameError = formatError ? "*아이디는 영문 소문자, 숫자, 특수문자(., _)로 2–20자만 쓸 수 있어요." : problem;
  const last = SUBTITLES.length - 1;
  const canNext = !busy && [name !== "" && !formatError, true, goals.length > 0, true, true][step];

  async function next() {
    setBusy(true);
    setProblem(null);
    try {
      if (step === 0) {
        if (await nameTaken(name)) return setProblem("*이미 누가 쓰고 있는 아이디예요. 다른 아이디를 골라 주세요.");
        return setStep(1);
      }
      if (step < last) return setStep(step + 1);
      await createProfile(name, goals, daily, avatar);
      router.replace(loadInvite() ? "/race" : "/home"); // came from a friend's invite: straight to their grid
    } catch (e) {
      const taken = (e as { code?: string }).code === "23505";
      if (taken) setStep(0);
      setProblem(taken ? "*방금 다른 사람이 이 아이디를 가져갔어요. 다른 아이디를 골라 주세요." : "*저장하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-[78px] pb-6">
      <div className="flex justify-center gap-2" aria-label={`${step + 1} / ${SUBTITLES.length} 단계`}>
        {SUBTITLES.map((_, i) => (
          <span key={i} className={`h-2 rounded-full ${i === step ? "w-6 bg-[#d9d9d9]" : "w-2 bg-muted"}`} />
        ))}
      </div>

      <header className="mt-6 text-center">
        <h1 className="text-xl leading-7 font-medium">PITIN에 오신 것을 환영합니다.</h1>
        <p className="text-muted">{SUBTITLES[step]}</p>
      </header>

      <section className="flex flex-1 flex-col justify-center">
        {step === 0 && (
          <label className="flex flex-col gap-1 text-sm leading-5">
            아이디
            <span
              className={`flex h-[42px] items-center gap-2 rounded-lg border px-2 ${nameError ? "border-danger" : "border-line"}`}
            >
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value.trim());
                  setProblem(null);
                }}
                placeholder="user_1234"
                autoFocus
                autoCapitalize="none"
                autoComplete="username"
                aria-invalid={!!nameError}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-placeholder"
              />
              {name && (
                <button type="button" onClick={() => setName("")} aria-label="지우기">
                  <CircleX size={20} />
                </button>
              )}
            </span>
            {nameError && <span className="text-danger">{nameError}</span>}
          </label>
        )}

        {step === 1 && (
          <label className="relative mx-auto grid size-[120px] cursor-pointer place-items-center overflow-hidden rounded-full border border-line">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={preview} alt="프로필" className="size-full object-cover" />
            ) : (
              <Image src="/logo.png" alt="기본 프로필" width={68} height={76} />
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setAvatar(f);
                  setPreview(URL.createObjectURL(f));
                }
              }}
            />
          </label>
        )}

        {step === 2 && (
          <div className="mx-auto grid grid-cols-2 gap-x-[45px] gap-y-[39px]">
            {GOALS.map(({ label, Icon }) => {
              const on = goals.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGoals(on ? goals.filter((g) => g !== label) : [...goals, label])}
                  className={`flex h-[98px] w-[120px] flex-col items-center justify-center gap-0 rounded-lg border ${on ? "border-brand text-brand" : "border-line"}`}
                >
                  <Icon size={28} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-3 gap-2">
            {GOAL_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={daily === m}
                onClick={() => setDaily(m)}
                className={`h-14 rounded-lg border ${daily === m ? "border-brand text-brand" : "border-line"}`}
              >
                {hoursMinutes(m * 60)}
              </button>
            ))}
            <p className="col-span-3 mt-2 text-center text-sm text-muted">홈에서 오늘 얼마나 채웠는지 보여드려요. 나중에 바꿀 수 있어요.</p>
          </div>
        )}

        {step === 4 && (
          <ol className="flex flex-col gap-5">
            {RULES.map(([title, body]) => (
              <li key={title}>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {step > 0 && problem && <p className="mb-3 text-center text-sm text-danger">{problem}</p>}
      {step === 0 && (
        <button
          type="button"
          onClick={() => signInWithGoogle().catch(() => setProblem("*구글 로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요."))}
          className="mb-3 text-sm text-muted underline underline-offset-4"
        >
          이미 계정이 있어요. 구글로 로그인
        </button>
      )}
      <button
        onClick={next}
        disabled={!canNext}
        className="h-12 w-full rounded-full bg-brand font-semibold disabled:bg-subtle"
      >
        {busy ? "확인 중..." : step === last ? "시작하기" : "계속"}
      </button>
    </main>
  );
}
