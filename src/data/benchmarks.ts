/**
 * Typical amateur stats by handicap, from Shot Scope's tracked-round data.
 *
 * Score to par, fairways, greens, putts and scrambling: Shot Scope, "Traditional Statistics v Strokes Gained"
 * ebook (shotscope.com/ebook/Strokes_Gained.pdf). Sand saves: Shot Scope data as published by MyGolfSpy,
 * "How Good Is Your Short Game? (Performance Chart By Handicap)". Checked November 2026.
 */
export interface Benchmark {
  handicap: number
  /** Average score to par per round. */
  toPar: number
  /** Share of fairways hit on par 4s and 5s, 0..1. */
  fairways: number
  /** Share of greens hit in regulation, 0..1. */
  gir: number
  /** Par or better after missing the green, 0..1. */
  scrambling: number
  /** Up and down from a greenside bunker, 0..1. */
  sandSaves: number
  putts: number
}

export const BENCHMARKS: Benchmark[] = [
  { handicap: 0, toPar: 0.8, fairways: 0.5, gir: 0.61, scrambling: 0.47, sandSaves: 0.37, putts: 29.4 },
  { handicap: 5, toPar: 6.3, fairways: 0.48, gir: 0.44, scrambling: 0.41, sandSaves: 0.23, putts: 30.2 },
  { handicap: 10, toPar: 10.9, fairways: 0.49, gir: 0.36, scrambling: 0.31, sandSaves: 0.2, putts: 31.2 },
  { handicap: 15, toPar: 17.4, fairways: 0.48, gir: 0.24, scrambling: 0.21, sandSaves: 0.18, putts: 33.1 },
  { handicap: 20, toPar: 21.7, fairways: 0.46, gir: 0.17, scrambling: 0.2, sandSaves: 0.15, putts: 33.1 },
  { handicap: 25, toPar: 29.0, fairways: 0.46, gir: 0.1, scrambling: 0.18, sandSaves: 0.1, putts: 33.8 },
]

export const BENCHMARK_SOURCE = 'Shot Scope tracked-round data'

/** Typical stats for a handicap index, blending the two nearest bands (plus handicaps use scratch, 25+ uses 25). */
export function benchmarkFor(index: number): Benchmark {
  const h = Math.max(0, Math.min(25, index))
  const i = Math.min(BENCHMARKS.length - 2, Math.floor(h / 5))
  const a = BENCHMARKS[i]
  const b = BENCHMARKS[i + 1]
  const t = (h - a.handicap) / (b.handicap - a.handicap)
  const mix = (k: keyof Benchmark) => a[k] + (b[k] - a[k]) * t
  return {
    handicap: index,
    toPar: mix('toPar'),
    fairways: mix('fairways'),
    gir: mix('gir'),
    scrambling: mix('scrambling'),
    sandSaves: mix('sandSaves'),
    putts: mix('putts'),
  }
}

/** "6 hcp" / "+2 hcp" style label. */
export function hcpLabel(index: number) {
  const r = Math.round(index * 10) / 10
  return `${r < 0 ? `+${Math.abs(r)}` : r} hcp`
}

type PlaysLikeStat = 'toPar' | 'gir' | 'scrambling' | 'putts'

/**
 * The handicap whose typical figure matches this value, read backwards from the table: "your greens are like a 3 hcp".
 * Returns 0 when the value beats a typical scratch golfer and 25 when it is worse than a typical 25 hcp.
 * Fairways are left out because the typical figure barely moves between handicaps.
 */
export function playsLike(stat: PlaysLikeStat, value: number): number {
  const lowerIsBetter = stat === 'toPar' || stat === 'putts'
  const better = (x: number, y: number) => (lowerIsBetter ? x <= y : x >= y)
  const first = BENCHMARKS[0]
  const last = BENCHMARKS[BENCHMARKS.length - 1]
  if (better(value, first[stat])) return 0
  if (!better(value, last[stat])) return 25
  for (let i = 0; i < BENCHMARKS.length - 1; i++) {
    const a = BENCHMARKS[i]
    const b = BENCHMARKS[i + 1]
    if (better(value, b[stat])) {
      const span = b[stat] - a[stat]
      const t = span === 0 ? 0 : (value - a[stat]) / span
      return a.handicap + (b.handicap - a.handicap) * t
    }
  }
  return 25
}

/** "a 3 hcp", "a scratch golfer", "a 25+ hcp". */
export function playsLikeLabel(h: number) {
  if (h < 0.5) return 'a scratch golfer'
  if (h >= 25) return 'a 25+ hcp'
  const r = Math.round(h)
  return `${r === 8 || r === 11 || r === 18 ? 'an' : 'a'} ${r} hcp`
}
