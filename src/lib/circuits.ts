import { CIRCUITS, type Circuit } from "./circuits-data";
import { SLOT } from "./race";

export { CIRCUITS, type Circuit };
export { pointAt, svgPath } from "./geometry";

/** Each grand prix slot runs on the next circuit in the rotation. */
export const circuitFor = (raceAt: number) => CIRCUITS[Math.floor(raceAt / SLOT) % CIRCUITS.length];
