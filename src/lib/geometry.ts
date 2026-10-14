export const svgPath = (pts: [number, number][]) => `M${pts.map((p) => p.join(" ")).join(" ")}Z`;

/** Point at fraction `f` (0..1) of a closed polyline's length. */
export function pointAt(pts: [number, number][], f: number): [number, number] {
  const segs = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  let d = (((f % 1) + 1) % 1) * segs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pts.length; i++) {
    if (d <= segs[i]) {
      const [p, q] = [pts[i], pts[(i + 1) % pts.length]];
      const t = segs[i] ? d / segs[i] : 0;
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    }
    d -= segs[i];
  }
  return pts[0];
}
