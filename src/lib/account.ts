"use client";

import type { User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { disablePush } from "./push";
import { supabase } from "./supabase";

// The signed-in user, kept current across sign-in, linking and sign-out.
let current: User | null | undefined;
const subs = new Set<() => void>();
supabase.auth.onAuthStateChange((_event, session) => {
  current = session?.user ?? null;
  subs.forEach((cb) => cb());
});

/** `undefined` until the session is known. */
export function useUser() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
    () => undefined,
  );
}

export const googleEmail = (u: User) => u.identities?.find((i) => i.provider === "google")?.identity_data?.email as string | undefined;

/** Keeps this (anonymous) account and attaches a Google login to it. Leaves the page for Google. */
export async function linkGoogle() {
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: `${location.origin}/profile#account` },
  });
  if (error) throw error;
}

/** Signs in to the account a Google login is attached to (or a new one). Leaves the page for Google. */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${location.origin}/home` },
  });
  if (error) throw error;
}

function forgetDevice() {
  for (const k of ["pitin:race", "pitin:push", "pitin:cam", "pitin:invite"])
    try {
      localStorage.removeItem(k);
    } catch {}
  location.replace(location.origin); // a full load also empties every in-memory cache
}

export async function signOut() {
  await disablePush().catch(() => {}); // this browser should stop getting the old account's pushes
  await supabase.auth.signOut();
  forgetDevice();
}

/** Removes the photo, then the account and everything that belongs to it. */
export async function deleteAccount() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await disablePush().catch(() => {});
  const { data: files } = await supabase.storage.from("avatars").list("", { search: data.user.id });
  if (files?.length) await supabase.storage.from("avatars").remove(files.map((f) => f.name));
  const { error } = await supabase.rpc("delete_account");
  if (error) throw error;
  await supabase.auth.signOut({ scope: "local" });
  forgetDevice();
}

export async function renamePlayer(name: string) {
  const { error } = await supabase.rpc("rename_player", { p_name: name });
  if (error) throw error;
}

/** Google sends errors back in the URL fragment (e.g. the account is already linked elsewhere). */
export function authErrorFromUrl() {
  const q = new URLSearchParams(location.hash.slice(1) || location.search);
  return q.get("error_code") ?? q.get("error");
}
