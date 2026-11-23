// Builds the mod's sky.js from the downloaded catalog and the hand-written star names and figures.
// Usage: node build-sky.mjs <catalog.json> <current sky.js> <output sky.js>
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [, , catalogPath, currentPath, outPath] = process.argv
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const { STARS, FIGURES } = await import(pathToFileURL(currentPath).href)

const SOUTH_LIMIT = -30
const FAINT_LIMIT = 5.6
const rad = Math.PI / 180

const all = catalog.features.map(f => {
  const [lon, lat] = f.geometry.coordinates
  const bv = Number(f.properties.bv)

  return { ra: (lon < 0 ? lon + 360 : lon) / 15, dec: lat, mag: Number(f.properties.mag), bv: Number.isFinite(bv) ? bv : 0.5, used: false }
}).filter(s => Number.isFinite(s.ra) && Number.isFinite(s.dec) && Number.isFinite(s.mag))

function separation(a, b) {
  const d1 = a.dec * rad
  const d2 = b.dec * rad
  const dra = (a.ra - b.ra) * 15 * rad
  const c = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(dra)

  return Math.acos(Math.max(-1, Math.min(1, c))) / rad
}

const tintOf = bv => (bv >= 1.0 ? 'warm' : bv <= -0.03 ? 'cool' : undefined)
const named = {}
const report = []

for (const [name, [ra, dec, mag]] of Object.entries(STARS)) {
  let best
  let bestScore = Infinity

  for (const s of all) {
    if (s.used || Math.abs(s.dec - dec) > 2.5) continue
    const d = separation({ ra, dec }, s)

    if (d > 2.5) continue
    const score = d + 0.5 * Math.abs(s.mag - mag)

    if (score < bestScore) {
      bestScore = score
      best = { s, d }
    }
  }

  if (best === undefined) {
    report.push(`${name}: no catalog star within 2.5 degrees, kept the hand value`)
    named[name] = [ra, dec, mag]
    continue
  }
  best.s.used = true
  named[name] = [Number(best.s.ra.toFixed(4)), Number(best.s.dec.toFixed(3)), best.s.mag, tintOf(best.s.bv)]

  if (best.d > 0.5 || Math.abs(best.s.mag - mag) > 0.7) {
    report.push(`${name}: hand ${ra}h ${dec} m${mag} -> catalog ${best.s.ra.toFixed(3)}h ${best.s.dec.toFixed(2)} m${best.s.mag} (${best.d.toFixed(2)} deg apart)`)
  }
}

const rest = all.filter(s => !s.used && s.dec >= SOUTH_LIMIT && s.mag <= FAINT_LIMIT)
const bright = rest.filter(s => s.mag < 3.5)
const faint = rest.filter(s => s.mag >= 3.5)

const starLine = ([ra, dec, mag, tint]) => `[${ra}, ${dec}, ${mag}${tint ? `, '${tint}'` : ''}]`
const lines = []

lines.push('// Real stars and constellation figures.')
lines.push('//')
lines.push('// Positions, magnitudes and colors come from the stars.6.json catalog of the d3-celestial')
lines.push('// project (Copyright (c) 2015, Olaf Frohn, BSD 3-Clause license), which is drawn from the')
lines.push('// Hipparcos and Yale Bright Star catalogs. The star names and the figures that join them are')
lines.push('// written by hand, and each named star is matched to its catalog entry by build-sky.mjs.')
lines.push('//')
lines.push('// Each star: right ascension in hours, declination in degrees, visual magnitude, and for')
lines.push("// those with an obvious color, 'warm' (orange) or 'cool' (blue-white).")
lines.push('export const STARS = {')
for (const [name, star] of Object.entries(named)) lines.push(`  ${name}: ${starLine(star)},`)
lines.push('}')
lines.push('')
lines.push('// Stars brighter than magnitude 3.5 that no figure uses, in the same form.')
lines.push('export const BRIGHT = [')
for (const s of bright) lines.push(`  ${starLine([Number(s.ra.toFixed(4)), Number(s.dec.toFixed(3)), s.mag, tintOf(s.bv)])},`)
lines.push(']')
lines.push('')
lines.push(`// The fainter stars, magnitude 3.5 to ${FAINT_LIMIT}, north of ${-SOUTH_LIMIT} degrees south: right ascension in`)
lines.push('// hundredths of an hour, declination in tenths of a degree, magnitude in tenths, one after another.')
lines.push('export const FAINT = [')
const flat = faint.flatMap(s => [Math.round(s.ra * 100), Math.round(s.dec * 10), Math.round(s.mag * 10)])
for (let i = 0; i < flat.length; i += 30) lines.push(`  ${flat.slice(i, i + 30).join(',')},`)
lines.push(']')
lines.push('')
lines.push('// Constellation figures: each is a chain of stars joined in order.')
lines.push('export const FIGURES = [')
for (const figure of FIGURES) lines.push(`  [${figure.map(n => `'${n}'`).join(', ')}],`)
lines.push(']')
lines.push('')
writeFileSync(outPath, lines.join('\n'))

console.log(`catalog ${all.length} stars; named ${Object.keys(named).length}; extra bright ${bright.length}; faint ${faint.length}`)
console.log(report.length ? report.join('\n') : 'every named star matched within 0.5 degrees and 0.7 magnitudes')
