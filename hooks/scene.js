// The backdrop: the real northern sky at its angle for the moment, and a moon drawn at the
// current phase.
// Plain JavaScript so the same file can be previewed outside the app.

import { BRIGHT as BRIGHT_STARS, FAINT, FIGURES, STARS } from './sky.js'

// A fixed sequence, so the sky is the same on every load.
function sequence(start) {
  let seed = start

  return () => {
    seed = (seed * 16807) % 2147483647

    return seed / 2147483647
  }
}

// The sky is a chart centered on the north celestial pole, as when facing north: a star's
// distance from the center is its distance from the pole, and the chart reaches 30 degrees
// south of the equator at the edge of the disc that the turning sky sweeps.
const POLE_X = 800
const POLE_Y = 500
const PX_PER_DEGREE = 8
const SOUTH_LIMIT = -30

// Where a star sits on the chart when the sidereal time is 0. East is to the right.
function place([raHours, dec]) {
  const r = (90 - dec) * PX_PER_DEGREE
  const angle = (raHours / 24) * Math.PI * 2

  return [POLE_X + r * Math.sin(angle), POLE_Y - r * Math.cos(angle)]
}

function sky() {
  let lines = ''
  let dots = ''

  for (const figure of FIGURES) {
    const points = figure.map(name => place(STARS[name]).map(v => v.toFixed(1)).join(','))

    lines += `<polyline points="${points.join(' ')}"/>`
  }

  // The faint stars are drawn as dots along three paths, one for each band of brightness:
  // a dot is a stroke too short to see, with round ends, which costs a dozen characters a star.
  const bands = ['', '', '']

  for (let i = 0; i < FAINT.length; i += 3) {
    const magnitude = FAINT[i + 2] / 10
    const [x, y] = place([FAINT[i] / 100, FAINT[i + 1] / 10])
    const band = magnitude < 4.3 ? 0 : magnitude < 5 ? 1 : 2

    bands[band] += `M${x.toFixed(1)} ${y.toFixed(1)}h.01`
  }
  dots += bands.map((d, band) => `<path class="faint faint-${band}" d="${d}"/>`).join('')

  for (const star of [...Object.values(STARS), ...BRIGHT_STARS]) {
    const [, dec, magnitude, tint] = star

    if (dec < SOUTH_LIMIT) {
      continue
    }
    const [x, y] = place(star)
    // Brighter stars are larger: magnitude 0 is about 3 units across, magnitude 4 under 1.
    const r = Math.max(0.7, Math.min(3.8, 3 - magnitude * 0.55))
    const opacity = Math.max(0.5, Math.min(1, 1.05 - magnitude * 0.12))
    const cls = tint === undefined ? 'star' : `star star-${tint}`

    if (magnitude < 1.2) {
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 3.2).toFixed(1)}" fill="url(#starglow)"/>`
    }
    dots += `<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" opacity="${opacity.toFixed(2)}"/>`
  }

  return `<g class="lines">${lines}</g>${dots}`
}

// The mean length of a lunar cycle in days, and a new moon to count from (6 January 2000, 18:14 UTC).
const SYNODIC_DAYS = 29.530588853
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14)

export function moonPhase(nowMs) {
  const cycles = (nowMs - KNOWN_NEW_MOON_MS) / 86400000 / SYNODIC_DAYS

  return cycles - Math.floor(cycles)
}

export function moonPhaseName(phase) {
  const names = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent']
  // The four named points each get a window of under a day either side.
  const eighth = phase * 8
  const nearest = Math.round(eighth)

  if (nearest % 2 === 0 && Math.abs(eighth - nearest) < 0.2) {
    return names[nearest % 8]
  }

  return names[Math.floor(eighth / 2) * 2 + 1]
}

// The stars turn once per sidereal day, as the real sky does, counterclockwise as when facing
// north. The outer group holds the angle for the moment the scene was drawn. The inner one
// carries on from there in jumps of a quarter of a degree, one a minute, so the app has
// nothing to repaint between jumps and the scene never has to be redrawn to move the stars.
const SIDEREAL_DAY_MS = 86164090.5
const STEPS_PER_DAY = 1436

// Local sidereal time in degrees: which right ascension is due south, and so straight above
// the pole on this chart. Longitude is not known, so it is taken from the clock's time zone,
// 15 degrees an hour, which is right to within the width of the zone.
function siderealDegrees(nowMs) {
  const daysSinceJ2000 = nowMs / 86400000 + 2440587.5 - 2451545
  const greenwich = 280.46061837 + 360.98564736629 * daysSinceJ2000
  const longitude = -new Date(nowMs).getTimezoneOffset() / 4
  const local = (greenwich + longitude) % 360

  return local < 0 ? local + 360 : local
}

function skyAngle(nowMs) {
  return (-siderealDegrees(nowMs)).toFixed(2)
}

// Where the moon sits in a wide window: near the right edge, clear of the conversation.
const MOON_X = 1470
const MOON_Y = 200
const R = 78

// The sunlit part of a disc at the origin, as seen from the northern hemisphere: it grows
// from the right edge until full, then leaves from the right.
function litPath(phase) {
  const wrapped = phase - Math.floor(phase)
  const isWaxing = wrapped < 0.5
  const curve = Math.cos(wrapped * 2 * Math.PI)
  const rx = Math.max(0.01, Math.abs(curve) * R).toFixed(2)
  const isCrescent = curve > 0
  const outerSweep = isWaxing ? 1 : 0
  const innerSweep = isWaxing === isCrescent ? 0 : 1

  return `M0 ${-R}A${R} ${R} 0 0 ${outerSweep} 0 ${R}A${rx} ${R} 0 0 ${innerSweep} 0 ${-R}Z`
}

// The dark seas of the near side, north up: center x, center y, radius x, radius y, strength.
const SEAS = [
  [-24, -34, 34, 27, 0.8], // Imbrium
  [-6, -40, 22, 16, 0.5],
  [18, -31, 20, 19, 0.8], // Serenitatis
  [33, -9, 25, 19, 0.8], // Tranquillitatis
  [26, -20, 16, 14, 0.5],
  [56, -22, 11, 9, 0.85], // Crisium
  [48, 11, 13, 18, 0.6], // Fecunditatis
  [31, 20, 11, 11, 0.55], // Nectaris
  [-50, -8, 27, 44, 0.7], // Procellarum
  [-44, -28, 22, 20, 0.45],
  [-40, 28, 12, 12, 0.65], // Humorum
  [-14, 27, 23, 17, 0.55], // Nubium
  [-28, 12, 20, 16, 0.5],
  [-2, -60, 42, 7, 0.45], // Frigoris
  [4, -11, 13, 10, 0.45], // Vaporum
  [-30, -4, 20, 16, 0.45], // Insularum
]

// Young craters that show as bright spots: x, y, radius of the glow.
const BRIGHT = [
  [-9, 57, 9], // Tycho
  [-27, -7, 8], // Copernicus
  [-49, -9, 5], // Kepler
  [-57, -25, 5], // Aristarchus
  [38, 40, 4],
  [10, 34, 3],
]

// Small shadowed craters, scattered mostly over the southern highlands.
function craters() {
  const next = sequence(29)
  let out = ''

  for (let i = 0; i < 46; i++) {
    const angle = next() * Math.PI * 2
    const distance = Math.sqrt(next()) * (R - 4)
    const x = Math.cos(angle) * distance
    const y = Math.abs(Math.sin(angle) * distance) * (next() < 0.8 ? 1 : -1)
    const r = 0.6 + next() * 1.6

    out += `<circle class="pit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" opacity="${(0.06 + next() * 0.1).toFixed(2)}"/>`
    out += `<circle class="rim" cx="${(x + r * 0.3).toFixed(1)}" cy="${(y + r * 0.3).toFixed(1)}" r="${(r * 0.75).toFixed(1)}" opacity="0.1"/>`
  }

  return out
}

// The rays of Tycho: thin bright streaks leaving the crater.
function rays() {
  const next = sequence(5)
  let out = ''

  for (let i = 0; i < 11; i++) {
    const angle = -Math.PI * (0.08 + (i / 10) * 0.84) + (next() - 0.5) * 0.12
    const length = 34 + next() * 60
    const x = -9 + Math.cos(angle) * length
    const y = 57 + Math.sin(angle) * length

    out += `<line x1="-9" y1="57" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke-width="${(1 + next() * 1.6).toFixed(1)}" opacity="${(0.07 + next() * 0.08).toFixed(2)}"/>`
  }

  return `<g class="rays">${out}</g>`
}

function moon(nowMs) {
  const phase = moonPhase(nowMs)
  const seas = SEAS.map(([x, y, rx, ry, o]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" opacity="${o}" fill="url(#sea)"/>`).join('')
  const bright = BRIGHT.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#spot)"/>`).join('')
  // The unlit part is the lit part half a cycle on. Eight copies a little apart soften its edge.
  const shade = [-0.021, -0.015, -0.009, -0.003, 0.003, 0.009, 0.015, 0.021]
    .map(offset => `<path class="shade" d="${litPath(phase + 0.5 + offset)}"/>`)
    .join('')

  const lit = (1 - Math.cos(phase * 2 * Math.PI)) / 2

  return `<g class="moon">
<g opacity="${(0.12 + lit * 0.88).toFixed(2)}"><circle class="halo-ring" cx="${MOON_X}" cy="${MOON_Y}" r="230" fill="url(#halo)"/></g>
<g transform="translate(${MOON_X} ${MOON_Y}) rotate(-12)">
<g clip-path="url(#disc)">
<circle r="${R}" fill="url(#ground)"/>
<ellipse cx="16" cy="44" rx="40" ry="28" fill="url(#spot)" opacity="0.5"/>
${seas}
${craters()}
${rays()}
${bright}
<circle r="${R}" fill="url(#limb)"/>
${shade}
</g>
</g>
</g>`
}

export function scene(nowMs) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.sky-a { stop-color: #d4dcf0; }
.sky-b { stop-color: #e2e8f5; }
.sky-c { stop-color: #f1eee6; }
.band { stop-color: #b9c4ea; }
.halo { stop-color: #ffffff; }
.night { opacity: 0; }
.ground-a { stop-color: #ffffff; }
.ground-b { stop-color: #eef1f8; }
.sea { stop-color: #a9b6d6; }
.spot { stop-color: #ffffff; }
.limb { stop-color: #b9c4e0; }
.pit { fill: #8f9cc0; }
.rim { fill: #ffffff; }
.rays { stroke: #ffffff; stroke-linecap: round; }
.shade { fill: #d6def1; opacity: 0.3; }
@media (prefers-color-scheme: dark) {
  .sky-a { stop-color: #03050d; }
  .sky-b { stop-color: #060a1a; }
  .sky-c { stop-color: #0a0f26; }
  .band { stop-color: #3a4a9a; }
  .halo { stop-color: #dfe6ff; }
  .night { opacity: 1; }
  .ground-a { stop-color: #f3f1ea; }
  .ground-b { stop-color: #d9d6cc; }
  .sea { stop-color: #5f6477; }
  .limb { stop-color: #4b4f66; }
  .pit { fill: #4d5166; }
  .shade { fill: #050814; opacity: 0.27; }
}
.star { fill: #f2f4ff; }
.faint { fill: none; stroke: #e6eaff; stroke-linecap: round; }
.faint-0 { stroke-width: 2; opacity: 0.7; }
.faint-1 { stroke-width: 1.5; opacity: 0.55; }
.faint-2 { stroke-width: 1.1; opacity: 0.4; }
.star-warm { fill: #ffcf9e; }
.star-cool { fill: #cfe0ff; }
.starglow { stop-color: #dfe6ff; }
.lines { fill: none; stroke: #9fb0ea; stroke-width: 0.8; stroke-linejoin: round; opacity: 0.3; }
@media (prefers-color-scheme: dark) { .lines { opacity: 0.2; } }
@keyframes breathe { from { opacity: 0.4; } to { opacity: 0.7; } }
.halo-ring { opacity: 0.55; animation: breathe 16s ease-in-out infinite alternate; }
.glow-band { opacity: 0.45; }
@media (prefers-color-scheme: dark) { .glow-band { opacity: 0.22; } }
@keyframes turn { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
@keyframes arrive { from { opacity: 0; } to { opacity: 1; } }
.turning { transform-origin: 800px 500px; animation: turn ${SIDEREAL_DAY_MS / 1000}s steps(${STEPS_PER_DAY}) infinite; }
.arrive { animation: arrive 2.5s ease-out both; }
@media (max-aspect-ratio: 3/2) { .moon { transform: translate(-80px, 0px); } }
@media (max-aspect-ratio: 27/20) { .moon { transform: translate(-160px, 0px); } }
@media (max-aspect-ratio: 6/5) { .moon { transform: translate(-240px, 0px); } }
@media (max-aspect-ratio: 1/1) { .moon { transform: translate(-330px, 0px); } }
@media (max-aspect-ratio: 5/6) { .moon { transform: translate(-420px, 0px); } }
@media (max-aspect-ratio: 2/3) { .moon { transform: translate(-510px, 0px); } }
@media (max-aspect-ratio: 1/2) { .moon { transform: translate(-580px, 0px); } }
@media (min-aspect-ratio: 11/5) { .moon { transform: translate(0px, 90px); } }
@media (min-aspect-ratio: 27/10) { .moon { transform: translate(0px, 150px); } }
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop class="sky-a" offset="0"/><stop class="sky-b" offset="0.55"/><stop class="sky-c" offset="1"/>
</linearGradient>
<radialGradient id="band"><stop class="band" offset="0" stop-opacity="0.5"/><stop class="band" offset="1" stop-opacity="0"/></radialGradient>
<radialGradient id="halo"><stop class="halo" offset="0.3" stop-opacity="0.4"/><stop class="halo" offset="0.5" stop-opacity="0.12"/><stop class="halo" offset="1" stop-opacity="0"/></radialGradient>
<radialGradient id="ground" cx="0.56" cy="0.44" r="0.62"><stop class="ground-a" offset="0"/><stop class="ground-b" offset="1"/></radialGradient>
<radialGradient id="sea"><stop class="sea" offset="0" stop-opacity="0.7"/><stop class="sea" offset="0.45" stop-opacity="0.5"/><stop class="sea" offset="0.8" stop-opacity="0.15"/><stop class="sea" offset="1" stop-opacity="0"/></radialGradient>
<radialGradient id="spot"><stop class="spot" offset="0" stop-opacity="0.9"/><stop class="spot" offset="0.25" stop-opacity="0.45"/><stop class="spot" offset="1" stop-opacity="0"/></radialGradient>
<radialGradient id="limb"><stop class="limb" offset="0.72" stop-opacity="0"/><stop class="limb" offset="1" stop-opacity="0.55"/></radialGradient>
<radialGradient id="starglow"><stop class="starglow" offset="0" stop-opacity="0.5"/><stop class="starglow" offset="1" stop-opacity="0"/></radialGradient>
<clipPath id="disc"><circle r="${R}"/></clipPath>
</defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
<ellipse cx="800" cy="520" rx="1100" ry="210" class="glow-band" fill="url(#band)" transform="rotate(-24 800 520)"/>
<g class="arrive">
<g class="night"><g transform="rotate(${skyAngle(nowMs)} 800 500)"><g class="turning">
${sky()}
</g></g></g>
${moon(nowMs)}
</g>
</svg>`
}
