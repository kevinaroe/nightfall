/** How far through the lunar cycle a moment is: 0 at new, 0.5 at full. */
export function moonPhase(nowMs: number): number

/** The common name of a phase, such as "waxing gibbous". */
export function moonPhaseName(phase: number): string

/** The whole backdrop as one SVG document, with the sky and the moon as they are at that moment. */
export function scene(nowMs: number): string
