import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { svgPath } from "@/lib/circuits";
import { loadCard } from "@/lib/card";
import { hoursMinutes, pct } from "@/lib/race";

const C = { bg: "#090a0c", fg: "#f5f5f5", muted: "#8f8f8f", line: "#303030", brand: "#ff5a1f", go: "#00d26a", pit: "#ffd400" };
// Literal paths, so only these files are traced into the function.
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Pretendard-Medium.subset.woff")),
  readFile(join(process.cwd(), "assets/fonts/Pretendard-Bold.subset.woff")),
  readFile(join(process.cwd(), "assets/fonts/BarlowCondensed-BoldItalic.ttf")),
  readFile(join(process.cwd(), "public/logo.png")),
]);
const svg = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;
const CHECKER = svg(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="24"><defs><pattern id="c" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${C.fg}"/><rect x="12" y="12" width="12" height="12" fill="${C.fg}"/></pattern></defs><rect width="1200" height="24" fill="url(#c)"/></svg>`,
);

/** The shared result as a 1200×630 PNG: the link preview and the image handed to the share sheet. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const card = await loadCard((await params).id);
  if (!card) return new Response("Not found", { status: 404 });
  const [medium, bold, barlow, logo] = await fonts;
  const track = card.circuit
    ? svg(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${card.circuit.width} ${card.circuit.height}"><path d="${svgPath(card.circuit.points)}" fill="none" stroke="${C.brand}" stroke-width="14" stroke-linejoin="round"/></svg>`,
      )
    : null;
  const stats = [
    ["집중 비율", `${pct(card.ratio)}%`],
    ["순공", hoursMinutes(card.focus)],
    ["최장 집중", hoursMinutes(card.stint)],
    ...(card.gp && !card.retired ? [[card.provisional ? "LP 예상" : "시즌 포인트", `+${card.lp} LP`]] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.fg, fontFamily: "Pretendard" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CHECKER} width={1200} height={24} alt="" />
        <div style={{ flex: 1, display: "flex", padding: "36px 64px 0", position: "relative" }}>
          {track && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track}
              alt=""
              style={{ position: "absolute", right: 64, top: 40, height: 380, width: (380 * card.circuit!.width) / card.circuit!.height, maxWidth: 520, objectFit: "contain" }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 700 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`data:image/png;base64,${logo.toString("base64")}`} width={24} height={28} alt="" />
              PITIN
            </div>
            <div style={{ marginTop: 28, fontSize: 40, fontWeight: 700 }}>{card.title}</div>
            <div style={{ marginTop: 6, fontSize: 26, color: C.muted }}>
              {card.gp ? `${card.division} · ${card.date}` : card.date}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 4 }}>
              <div style={{ fontFamily: "Barlow", fontStyle: "italic", fontSize: card.gp || card.retired ? 190 : 130, fontWeight: 700, lineHeight: 1 }}>
                {card.place}
              </div>
              {card.provisional && !card.retired && (
                <div style={{ marginBottom: 34, padding: "6px 16px", borderRadius: 999, border: `2px solid ${C.muted}`, color: C.muted, fontSize: 24 }}>
                  잠정
                </div>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 30, fontWeight: 500 }}>{`@${card.name}`}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 64px 48px" }}>
          <div style={{ display: "flex", gap: 56 }}>
            {stats.map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 22, color: C.muted }}>{k}</div>
                <div style={{ fontFamily: "Barlow", fontStyle: "italic", fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", position: "relative", marginTop: 24, height: 16, borderRadius: 8, background: C.go, overflow: "hidden" }}>
            {card.offs.map(([left, width], i) => (
              <div
                key={i}
                style={{ position: "absolute", top: 0, bottom: 0, left: `${left * 100}%`, width: `${Math.max(0.5, width * 100)}%`, background: C.pit }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Pretendard", data: medium, weight: 500, style: "normal" },
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Barlow", data: barlow, weight: 700, style: "italic" },
      ],
      // A provisional result changes once the grid is classified; a final one never does.
      headers: { "Cache-Control": card.provisional ? "public, max-age=60" : "public, max-age=31536000, immutable" },
    },
  );
}
