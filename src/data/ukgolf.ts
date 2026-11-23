// Turns UK Golf API tee sets into our Course format. Kept free of server code so it can be unit tested.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type J = any

import type { Course, Hole, Tee } from '../engine/types'

const isWomen = (g: unknown) => /^(f|w|l)/i.test(String(g ?? ''))
const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0)


export function toCourse(clubName: string, location: string, c: J, sets: J[], multi: boolean): (Course & { source: string }) | null {
  const usable = sets.filter((s) => Array.isArray(s.holes) && s.holes.length === 18)
  if (!usable.length) return null
  const byHole = (s: J) => [...s.holes].sort((a: J, b: J) => num(a.hole_number) - num(b.hole_number))
  const men = usable.find((s) => !isWomen(s.gender)) ?? usable[0]
  const women = usable.find((s) => isWomen(s.gender))
  const mh = byHole(men)
  const wh = women ? byHole(women) : mh
  const holes: Hole[] = mh.map((h: J, i: number) => ({
    n: i + 1,
    par_m: num(h.par),
    si_m: num(h.stroke_index),
    par_w: num(wh[i]?.par) || num(h.par),
    si_w: num(wh[i]?.stroke_index) || num(h.stroke_index),
  }))
  const tees = new Map<string, Tee>()
  for (const s of usable) {
    const raw = String(s.colour || s.name || 'Tee')
    const name = raw.charAt(0).toUpperCase() + raw.slice(1)
    const t = tees.get(name.toLowerCase()) ?? { name, yards: [], total: 0, ratings: {} }
    const hs = byHole(s)
    if (!t.yards.length || !isWomen(s.gender)) {
      t.yards = hs.map((h: J) => num(h.yardage))
      t.total = num(s.total_yardage) || t.yards.reduce((a, b) => a + b, 0)
    }
    const rating = { par: num(s.par) || hs.reduce((a: number, h: J) => a + num(h.par), 0), cr: num(s.course_rating), slope: num(s.slope_rating) }
    if (rating.cr && rating.slope) t.ratings[isWomen(s.gender) ? 'women' : 'men'] = rating
    tees.set(name.toLowerCase(), t)
  }
  const teeList = [...tees.values()].filter((t) => t.ratings.men || t.ratings.women).sort((a, b) => b.total - a.total)
  if (!teeList.length) return null
  const courseName = c?.name && multi ? `${clubName} (${c.name})` : clubName
  return { id: `uk-${c?.id ?? clubName}`, name: courseName, location, holes, tees: teeList, source: 'UK Golf API' }
}

