// Runs every minute (pg_cron). Pushes check-in questions to players mid-race, grand prix reminders 5 min before each start
// and "a friend took a grid spot", and writes the final classification of grand prix slots that are over.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import webpush from "npm:web-push@3.6.7";
import { CLASSIFY_AFTER, classify, type Division, gridOf, type Race, SLOT } from "../../../src/lib/race.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

type Message = { title: string; body: string; url: string; tag: string };

let failed = 0;

async function send(userIds: string[], msg: Message) {
  if (!userIds.length) return 0;
  const { data: subs } = await db.from("push_subscriptions").select("*").in("user_id", userIds);
  const gone: string[] = [];
  await Promise.all(
    (subs ?? []).map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 300 })
        .catch((e: { statusCode?: number; body?: string }) => {
          failed++;
          console.error("push failed", e.statusCode, e.body);
          if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint); // browser dropped the subscription
        }),
    ),
  );
  if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);
  return subs?.length ?? 0;
}

type EntryRow = {
  id: number;
  race_at: number;
  user_id: string;
  division: Division;
  started_at: number;
  duration: number;
  off_since: number | null;
  off_reason: "pit" | "away" | "seat" | null;
  off_total: number;
  ended_at: number | null;
  retired: boolean;
};

/** Final results for every grid whose slot is over: unfinished races are closed, positions and LP rewritten. */
async function classifyFinished(now: number) {
  const { data } = await db
    .from("entries")
    .select("id,race_at,user_id,division,started_at,duration,off_since,off_reason,off_total,ended_at,retired")
    .eq("kind", "gp")
    .eq("classified", false)
    .lt("race_at", now - CLASSIFY_AFTER)
    .limit(1000);
  const grids = new Map<string, EntryRow[]>();
  for (const e of (data ?? []) as EntryRow[]) {
    const k = `${e.race_at}:${e.division}`;
    grids.set(k, [...(grids.get(k) ?? []), e]);
  }
  for (const rows of grids.values()) {
    const people = rows.map((e) => {
      const n = (v: unknown) => (v === null ? null : Number(v));
      const race: Race = {
        kind: "gp",
        raceAt: Number(e.race_at),
        startedAt: Number(e.started_at),
        duration: e.duration,
        off: e.off_since !== null && e.off_reason ? { since: n(e.off_since)!, reason: e.off_reason } : null,
        offTotal: Number(e.off_total),
        endedAt: n(e.ended_at) ?? undefined,
        retired: e.retired,
      };
      return { id: String(e.id), race };
    });
    const results = classify(Number(rows[0].race_at), people, gridOf(rows[0].division));
    await Promise.all(
      results.map((x) =>
        db
          .from("entries")
          .update({
            classified: true,
            final_pos: x.pos,
            final_ratio: x.ratio,
            focus_sec: x.focus,
            lp: x.lp,
            ended_at: x.race.endedAt,
            off_since: null,
            off_reason: null,
            off_total: x.race.offTotal,
          })
          .eq("id", Number(x.id)),
      ),
    );
  }
  return grids.size;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const now = Date.now();
  failed = 0;

  const { data: due, error } = await db.rpc("due_checkins", { now_ms: now });
  if (error) return new Response(error.message, { status: 500 });
  const asked = await send(
    (due ?? []).map((d: { user_id: string }) => d.user_id),
    { title: "아직 공부 중이에요?", body: "누르면 계속 달려요. 5분 안에 답하지 않으면 피트인으로 처리돼요.", url: "/race?checkin=1", tag: "checkin" },
  );

  let reminded = 0;
  if (Math.floor((now % SLOT) / 60_000) === 25) {
    const slot = Math.ceil(now / SLOT) * SLOT; // both the :00 and the :30 grand prix of a chosen hour
    const { data } = await db.rpc("due_reminders", { slot });
    reminded = await send(
      (data ?? []).map((d: { user_id: string }) => d.user_id),
      { title: "5분 뒤 그랑프리 출발", body: "지금 그리드에 서면 정각에 같이 출발해요.", url: "/race", tag: `gp-${slot}` },
    );
  }

  const { data: friends } = await db.rpc("due_friend_alerts", { now_ms: now });
  let friended = 0;
  for (const a of (friends ?? []) as { user_id: string; race_at: number; friend_id: string; friend: string }[]) {
    const at = Number(a.race_at);
    const time = new Date(at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
    friended += await send([a.user_id], {
      title: `${a.friend} 선수가 그리드에 섰어요`,
      body: `${time} 그랑프리. 지금 합류하면 같은 그리드에서 달려요.`,
      url: `/join/${at}?with=${a.friend_id}`, // the invite page puts me on the friend's division grid
      tag: `friend-${at}`,
    });
  }

  const classified = await classifyFinished(now);
  return Response.json({ asked, reminded, friended, failed, classified });
});
