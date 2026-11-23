import type { Course, Gender, Hole, Player, Tee, TeeRating } from './types'

export function teeFor(course: Course, player: Player): Tee {
  return course.tees.find((t) => t.name === player.tee) ?? course.tees[0]
}

export function ratingFor(course: Course, player: Player): TeeRating | undefined {
  const tee = teeFor(course, player)
  return player.gender === 'w' ? tee.ratings.women ?? tee.ratings.men : tee.ratings.men ?? tee.ratings.women
}

export function holePar(hole: Hole, player: Player): number {
  return player.gender === 'w' ? hole.par_w : hole.par_m
}

export function holeSI(hole: Hole, player: Player): number {
  return player.gender === 'w' ? hole.si_w : hole.si_m
}

/** WHS Course Handicap = Index × Slope/113 + (CR − Par), rounded. */
export function courseHandicap(course: Course, player: Player): number {
  if (player.courseHandicapOverride != null) return player.courseHandicapOverride
  const r = ratingFor(course, player)
  if (!r) return Math.round(player.handicapIndex)
  return whsRound(player.handicapIndex * (r.slope / 113) + (r.cr - r.par))
}

/** Rounds .5 away from zero, as WHS does. */
export function whsRound(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x) + 1e-9)
}

export function playingHandicap(course: Course, player: Player, allowance: number): number {
  return whsRound(courseHandicap(course, player) * allowance)
}

/** Strokes received on a hole of stroke index `si` for playing handicap `ph`. Plus handicaps give strokes back on the easiest holes. */
export function strokesOnHole(ph: number, si: number, holes = 18): number {
  if (ph >= 0) {
    const base = Math.floor(ph / holes)
    const extra = si <= ph % holes ? 1 : 0
    return base + extra
  }
  const plus = -ph
  const base = Math.floor(plus / holes)
  const extra = si > holes - (plus % holes) ? 1 : 0
  return base + extra === 0 ? 0 : -(base + extra)
}

/** Strokes per hole (array of 18) for a player at a playing handicap. */
export function strokeMap(course: Course, player: Player, ph: number): number[] {
  return course.holes.map((h) => strokesOnHole(ph, holeSI(h, player), course.holes.length))
}

/** "Black · Par 69 · 5,902 yds" for tee pickers. */
export function teeLabel(tee: Tee, gender: Gender = 'm'): string {
  const r = gender === 'w' ? (tee.ratings.women ?? tee.ratings.men) : (tee.ratings.men ?? tee.ratings.women)
  const total = tee.total || tee.yards.reduce((a, b) => a + (b || 0), 0)
  return [tee.name, r?.par ? `Par ${r.par}` : '', total ? `${total.toLocaleString('en-GB')} yds` : ''].filter(Boolean).join(' · ')
}
