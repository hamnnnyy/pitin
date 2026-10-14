"use client";

import { loadSound } from "./store";

// Race beeps. Browsers only allow sound after a tap, so unlockSound() runs on the join button.
let ctx: AudioContext | undefined;

export function unlockSound() {
  try {
    ctx ??= new AudioContext();
    ctx.resume().catch(() => {});
  } catch {}
}

/** A beep, a short buzz instead, or nothing, as the player set it. */
export function beep(freq: number, ms: number) {
  const mode = loadSound();
  if (mode === "off") return;
  if (mode === "vibrate") return void navigator.vibrate?.(Math.min(ms, 200));
  if (!ctx || ctx.state !== "running") return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + ms / 1000);
}
