"use client";

import { useEffect, useRef, useState } from "react";

// The wasm runtime matches the installed @mediapipe/tasks-vision; the person model is served from /public.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL = "/models/person.tflite";

/**
 * Front camera + on-device person detection, once a second. Frames never leave the device.
 * Keeps the screen awake, since browsers stop the camera when the screen turns off.
 */
export function SeatCam({ onFrame, onFail }: { onFrame: (present: boolean) => void; onFail: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const handlers = useRef({ onFrame, onFail });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    handlers.current = { onFrame, onFail };
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let lock: WakeLockSentinel | undefined;
    let detector: { close(): void } | undefined;
    const keepAwake = () => {
      if (document.visibilityState === "visible") navigator.wakeLock?.request("screen").then((l) => (lock = l), () => {});
    };

    (async () => {
      try {
        const [{ FilesetResolver, ObjectDetector }, s] = await Promise.all([
          import("@mediapipe/tasks-vision"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false }),
        ]);
        stream = s;
        if (stopped) return;
        const v = video.current!;
        v.srcObject = s;
        await v.play();
        const det = await ObjectDetector.createFromOptions(await FilesetResolver.forVisionTasks(WASM), {
          baseOptions: { modelAssetPath: MODEL },
          runningMode: "VIDEO",
          categoryAllowlist: ["person"],
          scoreThreshold: 0.4,
          maxResults: 1,
        });
        detector = det;
        if (stopped) return det.close();
        setReady(true);
        keepAwake();
        document.addEventListener("visibilitychange", keepAwake);
        timer = setInterval(() => {
          if (document.hidden || !v.videoWidth) return; // camera is paused in the background; the gap is handled on return
          handlers.current.onFrame(det.detectForVideo(v, performance.now()).detections.length > 0);
        }, 1000);
      } catch {
        if (!stopped) handlers.current.onFail();
      }
    })();

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", keepAwake);
      stream?.getTracks().forEach((t) => t.stop());
      lock?.release().catch(() => {});
      detector?.close();
    };
  }, []);

  return (
    <video
      ref={video}
      muted
      playsInline
      aria-label="카메라 미리보기"
      className={`h-16 w-[85px] shrink-0 -scale-x-100 rounded-md bg-black object-cover ${ready ? "" : "opacity-40"}`}
    />
  );
}
