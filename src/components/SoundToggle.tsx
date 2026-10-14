"use client";

import { Vibrate, Volume2, VolumeX } from "lucide-react";
import { type SoundMode, saveSound, useSound } from "@/lib/store";
import { unlockSound } from "@/lib/sound";

const NEXT: Record<SoundMode, SoundMode> = { on: "vibrate", vibrate: "off", off: "on" };
const LABEL: Record<SoundMode, string> = { on: "소리 켜짐", vibrate: "진동만", off: "소리 꺼짐" };

/** Cycles race sounds: on, vibrate only, off. */
export function SoundToggle() {
  const mode = useSound() ?? "on";
  const Icon = mode === "on" ? Volume2 : mode === "vibrate" ? Vibrate : VolumeX;
  return (
    <button
      onClick={() => {
        if (NEXT[mode] === "on") unlockSound();
        saveSound(NEXT[mode]);
      }}
      aria-label={`${LABEL[mode]}. 누르면 ${LABEL[NEXT[mode]]}`}
      title={LABEL[mode]}
      className="grid size-9 place-items-center rounded-full text-muted hover:text-fg"
    >
      <Icon size={20} />
    </button>
  );
}
