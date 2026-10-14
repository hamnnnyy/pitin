// localStorage as a tiny reactive store, used for the race running on this device. Storage can throw (private mode) or be empty, so every access falls back.
import { useMemo, useSyncExternalStore } from "react";
import type { Race } from "./race";

const EVENT = "pitin:store";

function raw(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse<T>(v: string | null, fallback: T): T {
  try {
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** `undefined` during SSR / before hydration, so pages can avoid flashing the wrong state. */
function useStored<T>(key: string, fallback: T): T | undefined {
  // the raw string is the snapshot: stable between renders, unlike a parsed object
  const v = useSyncExternalStore(subscribe, () => raw(key) ?? "", () => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fallback is a constant per call site
  return useMemo(() => (v === undefined ? undefined : parse(v || null, fallback)), [v]);
}

// races saved by older builds lack raceAt; treat them as no race instead of rendering nothing forever
const valid = (r: Race | null | undefined) => (r && typeof r.raceAt !== "number" ? null : r);

export const loadRace = () => valid(parse<Race | null>(raw("pitin:race"), null)) ?? null;
export const saveRace = (r: Race | null) => write("pitin:race", r);
export const useRace = () => valid(useStored<Race | null>("pitin:race", null));

/** A friend's invite to their grid, kept until that grand prix is over. */
export type Invite = { raceAt: number; with: string; name: string; division: NonNullable<Race["division"]> };
export const loadInvite = () => parse<Invite | null>(raw("pitin:invite"), null);
export const saveInvite = (i: Invite | null) => write("pitin:invite", i);

/** Race sounds: a library is quiet, so they can turn into a buzz or go away. */
export type SoundMode = "on" | "vibrate" | "off";
export const loadSound = () => parse<SoundMode>(raw("pitin:sound"), "on");
export const saveSound = (m: SoundMode) => write("pitin:sound", m);
export const useSound = () => useStored<SoundMode>("pitin:sound", "on");

/** The first-race walkthrough has been seen (or skipped) on this device. */
export const useCoachDone = () => useStored<boolean>("pitin:coach", false);
export const saveCoachDone = () => write("pitin:coach", true);

/** When the race screen was last on show, so coming back (unlock, new tab, reload) can say what happened meanwhile. */
type Seen = { raceAt: number; at: number };
export const loadSeen = (raceAt: number) => {
  const s = parse<Seen | null>(raw("pitin:seen"), null);
  return s?.raceAt === raceAt ? s.at : null;
};
export const saveSeen = (raceAt: number, at: number) => {
  try {
    localStorage.setItem("pitin:seen", JSON.stringify({ raceAt, at })); // no store event: nothing renders from it
  } catch {}
};
