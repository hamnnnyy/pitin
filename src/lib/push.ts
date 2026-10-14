"use client";

import { ensureUserId } from "./data";
import { supabase } from "./supabase";

/** iOS only allows web push once the app is added to the home screen. */
export function pushStatus(): "on" | "off" | "denied" | "install" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  const standalone = matchMedia("(display-mode: standalone)").matches;
  if (!("PushManager" in window) || !("serviceWorker" in navigator))
    return /iPhone|iPad/.test(navigator.userAgent) && !standalone ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && localStorage.getItem("pitin:push") === "on" ? "on" : "off";
}

function key(base64url: string) {
  const s = atob(base64url.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Asks for permission and saves this browser's push subscription. Call from a tap. */
export async function enablePush() {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  if ((await Notification.requestPermission()) !== "granted") throw new Error("permission denied");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) }));
  const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await ensureUserId();
  const { error } = await supabase.from("push_subscriptions").upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
  if (error) throw error;
  localStorage.setItem("pitin:push", "on");
}

export async function disablePush() {
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  localStorage.removeItem("pitin:push");
}
