import { type Circuit, pointAt, svgPath } from "@/lib/circuits";
import type { Row } from "@/lib/race";

/** f = position on the lap, 0..1 from the start/finish line in racing direction. */
export type Car = { key: string; f: number; label?: string; me?: boolean; leader?: boolean; pit?: boolean; trail?: boolean };

/**
 * Where each driver sits on the lap. Distance follows the standings (Row.laps), so the leader is in front
 * and a car in the pits stands still while the others go by. The leader and the cars either side of me
 * carry their position, and so does my rival. `slipstream`: my unbroken focus stretch is long enough to draw a trail behind my car.
 */
export function toCars(rows: Row[], slipstream = false, rival?: string): Car[] {
  const mine = rows.find((r) => r.me)?.pos;
  return rows.map((r) => ({
    key: r.id,
    f: r.laps % 1,
    me: r.me,
    leader: r.pos === 1,
    pit: r.off && !r.done,
    trail: r.me && slipstream && !r.off,
    label: r.me
      ? "나"
      : r.id === rival
        ? `P${r.pos} 라이벌`
        : r.pos === 1 || (mine && Math.abs(r.pos - mine) === 1)
          ? `P${r.pos}`
          : undefined,
  }));
}

/**
 * Satellite photo with the circuit drawn on its real tarmac, and every car on it.
 * Coordinates are photo pixels (see circuits-data.ts), so the photo is simply the SVG background.
 */
export function TrackMap({
  circuit,
  cars = [],
  className = "max-h-72",
  caption = true,
}: {
  circuit: Circuit;
  cars?: Car[];
  className?: string;
  caption?: boolean;
}) {
  const { photo, points, width, height } = circuit;
  const d = svgPath(points);
  const u = Math.max(width, height) / 1000; // stroke and dot sizes scale with the photo
  const [s, n] = [points[0], points[1]];
  const len = Math.hypot(n[0] - s[0], n[1] - s[1]) || 1;
  const [px, py] = [(-(n[1] - s[1]) / len) * 22 * u, ((n[0] - s[0]) / len) * 22 * u];
  const ordered = [...cars].sort((a, b) => Number(!!a.me) - Number(!!b.me)); // me on top

  return (
    <figure className="flex flex-col">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`mx-auto block h-auto w-full ${className}`}
        role="img"
        aria-label={`${circuit.name} 서킷 위 선수 위치`}
      >
        <image href={photo.src} width={width} height={height} preserveAspectRatio="none" />
        <rect width={width} height={height} fill="var(--color-bg)" opacity={0.45} />
        <path d={d} fill="none" stroke="rgb(0 0 0 / 0.6)" strokeWidth={22 * u} strokeLinejoin="round" />
        <path d={d} fill="none" stroke="var(--color-fg)" strokeWidth={9 * u} strokeLinejoin="round" />
        <line x1={s[0] - px} y1={s[1] - py} x2={s[0] + px} y2={s[1] + py} stroke="var(--color-brand)" strokeWidth={8 * u} />
        {ordered.map((c) => {
          const [x, y] = pointAt(points, c.f);
          const fill = c.pit ? "var(--color-pit)" : c.me ? "var(--color-brand)" : c.leader ? "var(--color-leader)" : "#2b2b2b";
          return (
            <g key={c.key}>
              {c.trail &&
                [0.012, 0.024, 0.036].map((back, i) => {
                  const [tx, ty] = pointAt(points, c.f - back);
                  return <circle key={back} cx={tx} cy={ty} r={(16 - i * 3) * u} fill="var(--color-brand)" opacity={0.5 - i * 0.15} />;
                })}
              <g
                style={{ transform: `translate(${x}px, ${y}px)` }}
                className="transition-transform duration-300 ease-linear motion-reduce:transition-none"
              >
                <circle
                  r={(c.me ? 20 : 13) * u}
                  fill={fill}
                  stroke={c.me ? "var(--color-fg)" : "rgb(255 255 255 / 0.7)"}
                  strokeWidth={(c.me ? 6 : 3) * u}
                />
                {c.label && (
                  <text
                    x={(c.me ? 26 : 18) * u}
                    y={(c.me ? -22 : -16) * u}
                    fill={c.me ? "var(--color-fg)" : "rgb(255 255 255 / 0.8)"}
                    fontSize={(c.me ? 44 : 32) * u}
                    fontWeight={700}
                    fontStyle="italic"
                    className="font-num"
                    paintOrder="stroke"
                    stroke="rgb(0 0 0 / 0.6)"
                    strokeWidth={6 * u}
                  >
                    {c.label}
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </svg>
      {caption && (
        <figcaption className="mt-1 flex justify-between gap-2 px-4 text-[11px] leading-4 text-subtle">
          <span className="shrink-0">
            {circuit.name}, {circuit.km}km
          </span>
          <a href={photo.href} target="_blank" rel="noreferrer" className="truncate hover:underline">
            {photo.credit}
          </a>
        </figcaption>
      )}
    </figure>
  );
}
