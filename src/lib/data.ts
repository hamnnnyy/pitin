"use client";

import { useCallback, useEffect, useState } from "react";
import type { Action, Division, Off, Race } from "./race";
import { supabase } from "./supabase";

export type Profile = {
  id: string;
  name: string;
  goals: string[];
  avatar_url: string | null;
  remind_hours: number[];
  division: Division;
  daily_goal: number; // minutes
  friend_alerts: boolean; // push when someone I follow takes a grid spot
  created_at: string;
};

export type Entry = {
  id: number;
  kind: "gp" | "practice";
  division: Division;
  classified: boolean;
  race_at: number;
  user_id: string;
  name: string;
  started_at: number;
  duration: number;
  off_since: number | null;
  off_reason: Off["reason"] | null;
  off_total: number;
  offs: NonNullable<Race["offs"]>;
  ended_at: number | null;
  checked_at: number | null;
  retired: boolean;
  final_pos: number | null;
  final_ratio: number | null;
  focus_sec: number | null;
  lp: number;
};

export type Standing = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  division: Division;
  lp: number;
  races: number;
  focus_sec: number;
};

export type SeasonResult = { season: string; user_id: string; division: Division; lp: number; rank: number; next_division: Division };

// bigint columns arrive as strings or numbers depending on size; normalise once here
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
function toEntry(e: Record<string, unknown>): Entry {
  return {
    ...(e as Entry),
    race_at: Number(e.race_at),
    started_at: Number(e.started_at),
    off_since: num(e.off_since),
    off_total: Number(e.off_total),
    ended_at: num(e.ended_at),
    checked_at: num(e.checked_at),
  };
}

export function entryToRace(e: Entry): Race {
  return {
    kind: e.kind,
    raceAt: e.race_at,
    startedAt: e.started_at,
    duration: e.duration,
    off: e.off_since && e.off_reason ? { since: e.off_since, reason: e.off_reason } : null,
    offTotal: e.off_total,
    endedAt: e.ended_at ?? undefined,
    retired: e.retired,
    checkedAt: e.checked_at ?? undefined,
    offs: e.offs,
    division: e.division,
  };
}

/** Same rule as the profiles.name check constraint. */
export const USERNAME = /^[a-z0-9._]{2,20}$/;

// ---- session ---------------------------------------------------------------------------------

let sessionPromise: Promise<string> | null = null;

/** Signs in anonymously on first use; one account per browser. */
export function ensureUserId(): Promise<string> {
  sessionPromise ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) throw error ?? new Error("anonymous sign-in failed");
    return anon.user.id;
  })().catch((e) => {
    sessionPromise = null; // let the next call retry
    throw e;
  });
  return sessionPromise;
}

// ---- tiny query hook: cached value shown at once, refetched on mount and on refresh() ---------

const cache = new Map<string, unknown>();
const fetchers = new Map<string, () => Promise<unknown>>();

function useQuery<T>(key: string | null, fn: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(() => (key ? (cache.get(key) as T | undefined) : undefined));
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(() => {
    if (!key) return;
    fetchers.set(key, fn);
    fn().then(
      (v) => {
        cache.set(key, v);
        setData(v);
        setError(null);
      },
      (e: Error) => setError(e),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key identifies the query
  }, [key]);
  useEffect(run, [run]);
  return { data, error, refresh: run };
}

/** Refetches cached queries into the cache. The old value stays until then, so pages never see a gap. */
export const invalidate = (prefix: string) =>
  Promise.all(
    [...fetchers]
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, fn]) => fn().then((v) => cache.set(k, v), () => cache.delete(k))),
  );

// ---- profiles --------------------------------------------------------------------------------

export function useMyProfile() {
  return useQuery("me", async () => {
    const id = await ensureUserId();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  });
}

export async function nameTaken(name: string) {
  await ensureUserId();
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("name", name);
  return (count ?? 0) > 0;
}

async function uploadAvatar(id: string, file: File) {
  const path = `${id}.${file.type.split("/")[1] || "jpg"}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

export async function updateAvatar(file: File) {
  const id = await ensureUserId();
  const avatar_url = await uploadAvatar(id, file);
  const { error } = await supabase.from("profiles").update({ avatar_url }).eq("id", id);
  if (error) throw error;
  await Promise.all([invalidate("me"), invalidate("season")]);
}

export async function updateProfile(patch: Partial<Pick<Profile, "remind_hours" | "daily_goal" | "friend_alerts">>) {
  const id = await ensureUserId();
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
  await invalidate("me");
}

export async function createProfile(name: string, goals: string[], daily_goal: number, avatar: File | null) {
  const id = await ensureUserId();
  // a failed photo upload should not block signing up
  const avatar_url = avatar ? await uploadAvatar(id, avatar).catch(() => null) : null;
  const { error } = await supabase.from("profiles").insert({ id, name, goals, daily_goal, avatar_url });
  if (error) throw error;
  await invalidate("me");
}

// ---- entries ---------------------------------------------------------------------------------

export function usePlayer(id: string) {
  return useQuery(`player:${id}`, async () => {
    await ensureUserId();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  });
}

/** Everyone on my division's grid for a slot, kept live with Realtime. */
export function useGrid(raceAt: number | null, division: Division) {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    if (!raceAt) return;
    let alive = true;
    const load = () =>
      supabase
        .from("entries")
        .select("*")
        .eq("race_at", raceAt)
        .eq("kind", "gp")
        .eq("division", division)
        .then(({ data }) => alive && setEntries((data ?? []).map(toEntry)));
    load();
    const ch = supabase
      .channel(`grid-${raceAt}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `race_at=eq.${raceAt}` }, (p) => {
        if (p.eventType === "DELETE") return load();
        const e = toEntry(p.new);
        if (e.kind !== "gp" || e.division !== division) return;
        setEntries((xs) => [...xs.filter((x) => x.id !== e.id), e]);
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [raceAt, division]);
  return entries;
}

/** Puts me on the grid of `raceAt`, or starts a practice run. The server picks the start time. */
export async function joinRace(kind: Race["kind"], raceAt: number, duration: number, withFriend?: string) {
  await ensureUserId();
  const { data, error } = await supabase.rpc("join_race", {
    p_race_at: raceAt,
    p_kind: kind,
    p_duration: duration,
    p_with: withFriend ?? null,
  });
  if (error) throw error;
  return toEntry(data);
}

// one request at a time, so answers come back in the order the player acted
let queue: Promise<unknown> = Promise.resolve();

/** Asks the server to apply an action to my race with its own clock; resolves with the race as the server sees it. */
export function raceAction(raceAt: number, action: Action, since?: number) {
  const run = queue.then(async () => {
    const { data, error } = await supabase.rpc("race_action", { p_race_at: raceAt, p_action: action, p_since: since ?? null });
    if (error) throw error;
    const e = toEntry(data);
    if (e.ended_at) await Promise.all([invalidate("races"), invalidate("season")]);
    return e;
  });
  queue = run.catch(() => {});
  return run;
}

/** Every finished race and practice run of a player, newest first. */
export function useRaces(userId: string) {
  return useQuery(`races:${userId}`, async () => {
    await ensureUserId();
    // ponytail: one query for the whole log; page it once someone has thousands of races
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .eq("user_id", userId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(3000);
    if (error) throw error;
    return (data ?? []).map(toEntry);
  });
}

/** Races still running for these players (grand prix or practice). */
export function useRunning(userIds: string[], now: number) {
  const since = Math.floor(now / 600_000) * 600_000 - 3 * 3_600_000; // stable for 10 min, so the key does not churn
  return useQuery(userIds.length ? `running:${userIds.join(",")}:${since}` : null, async () => {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .in("user_id", userIds)
      .is("ended_at", null)
      .gte("started_at", since);
    if (error) throw error;
    return (data ?? []).map(toEntry).filter((e) => e.started_at + e.duration * 1000 > Date.now());
  });
}

// ---- follows ---------------------------------------------------------------------------------

export function useFollowing() {
  return useQuery("following", async () => {
    const id = await ensureUserId();
    const { data, error } = await supabase.from("follows").select("followee").eq("follower", id);
    if (error) throw error;
    return (data ?? []).map((f) => f.followee as string);
  });
}

export function useFollowerCount(id: string) {
  return useQuery(`followers:${id}`, async () => {
    const { count, error } = await supabase.from("follows").select("follower", { count: "exact", head: true }).eq("followee", id);
    if (error) throw error;
    return count ?? 0;
  });
}

/** Players whose name starts with `q`, for finding friends. */
export async function searchPlayers(q: string) {
  const id = await ensureUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,avatar_url,division")
    .ilike("name", `${q.replace(/[\\%_]/g, "\\$&")}%`)
    .neq("id", id)
    .order("name")
    .limit(8);
  if (error) throw error;
  return data as Pick<Profile, "id" | "name" | "avatar_url" | "division">[];
}

export async function setFollow(followee: string, on: boolean) {
  const id = await ensureUserId();
  const { error } = on
    ? await supabase.from("follows").insert({ followee })
    : await supabase.from("follows").delete().eq("follower", id).eq("followee", followee);
  if (error) throw error;
  await Promise.all([invalidate("following"), invalidate(`followers:${followee}`)]);
}

// ---- seasons ---------------------------------------------------------------------------------

/** My most recent closed season, if any. */
export function useLastSeason() {
  return useQuery("last-season", async () => {
    const id = await ensureUserId();
    const { data, error } = await supabase
      .from("season_results")
      .select("*")
      .eq("user_id", id)
      .order("season", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as SeasonResult | null;
  });
}

export function useSeason() {
  return useQuery("season", async () => {
    await ensureUserId();
    const { data, error } = await supabase
      .from("season_standings")
      .select("*")
      .order("lp", { ascending: false })
      .order("focus_sec", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as Standing[];
  });
}
