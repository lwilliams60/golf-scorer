import type { RoundFacts, Summary } from './stats'
import { APPROACH_BANDS, PUTT_BANDS } from './stats'
import { benchmarkFor, hcpLabel } from '../data/benchmarks'

/** Counts behind the stats page graphics, worked out from the same rounds as the summary. */
export interface StatsView {
  tee: { fairway: number; left: number; right: number; bunker: number; penalty: number; total: number }
  approach: { green: number; short: number; long: number; left: number; right: number; bunker: number; total: number }
  scramble: { chances: number; saved: number }
  sand: { chances: number; saved: number }
  finish: { birdies: number; pars: number; bogeys: number; doubles: number; holes: number }
  byPar: { par: number; avg: number | null; holes: number }[]
  /** Full rounds, oldest first. */
  trend: { date: string; gross: number; toPar: number }[]
  best: RoundFacts | null
}

export interface Tip {
  title: string
  body: string
}

/** Rounds come newest first, as the app lists them. */
export function statsView(rounds: RoundFacts[]): StatsView {
  const holes = rounds.flatMap((r) => r.holes.filter((h) => h.score != null))
  const tee = { fairway: 0, left: 0, right: 0, bunker: 0, penalty: 0, total: 0 }
  const approach = { green: 0, short: 0, long: 0, left: 0, right: 0, bunker: 0, total: 0 }
  const finish = { birdies: 0, pars: 0, bogeys: 0, doubles: 0, holes: holes.length }
  for (const h of holes) {
    if (h.tee) {
      tee[h.tee]++
      tee.total++
    }
    if (h.approach) {
      approach[h.approach]++
      approach.total++
    }
    const d = h.score! - h.par
    if (d <= -1) finish.birdies++
    else if (d === 0) finish.pars++
    else if (d === 1) finish.bogeys++
    else finish.doubles++
  }
  const full = rounds.filter((r) => r.holesPlayed === 18)
  return {
    tee,
    approach,
    scramble: { chances: holes.filter((h) => h.scrambleChance).length, saved: holes.filter((h) => h.scrambled).length },
    sand: { chances: holes.filter((h) => h.sandChance).length, saved: holes.filter((h) => h.sandSaved).length },
    finish,
    byPar: [3, 4, 5].map((par) => {
      const hs = holes.filter((h) => h.par === par)
      return { par, holes: hs.length, avg: hs.length ? hs.reduce((a, h) => a + h.score!, 0) / hs.length : null }
    }),
    trend: [...full].reverse().map((r) => ({ date: r.date, gross: r.gross, toPar: r.toPar })),
    best: [...full].sort((a, b) => a.gross - b.gross)[0] ?? null,
  }
}

const pc = (x: number) => `${Math.round(x * 100)}%`
const bandLabel = (id: string) => APPROACH_BANDS.find((b) => b.id === id)!.label.replace(/^Under /, 'under ')

const missAdvice: Record<'short' | 'long' | 'left' | 'right' | 'bunker', [string, string]> = {
  short: ['come up short', 'Try one more club.'],
  long: ['go long', 'Try one less club.'],
  left: ['miss left', 'Aim at the right half of the green.'],
  right: ['miss right', 'Aim at the left half of the green.'],
  bunker: ['finish in bunkers', 'Aim for the fat part of the green, away from the sand.'],
}

export function teeTip(v: StatsView, s: Summary, index: number): Tip | null {
  const t = v.tee
  if (t.total < 5 || s.fairways == null) return null
  const typical = benchmarkFor(index).fairways
  if ((s.teePenaltiesPerRound ?? 0) >= 1)
    return { title: 'Penalties are the costly miss.', body: `About ${s.teePenaltiesPerRound!.toFixed(1)} a round. On tight holes, tee off with the club you hit straightest.` }
  if (t.left >= 3 && t.left >= 2 * t.right)
    return { title: 'You miss left more than twice as often as right.', body: 'Aim at the right half of the fairway on tight holes, so your usual miss still finishes in play.' }
  if (t.right >= 3 && t.right >= 2 * t.left)
    return { title: 'You miss right more than twice as often as left.', body: 'Aim at the left half of the fairway on tight holes, so your usual miss still finishes in play.' }
  if (s.fairways >= typical) return { title: 'Driving is a strength.', body: `You hit ${pc(s.fairways)} of fairways against ${pc(typical)} for a typical ${hcpLabel(index)}.` }
  return { title: `Fairways: ${pc(s.fairways)} against a typical ${pc(typical)}.`, body: 'Pick a small target on every tee shot and commit to it.' }
}

export function approachTip(v: StatsView, s: Summary, index: number): Tip | null {
  const weak = s.approachByBand
    .filter((b) => b.shots >= 3 && b.greens / b.shots < 0.5 && b.topMiss && b.topMissShare >= 0.5)
    .sort((a, b) => a.greens / a.shots - b.greens / b.shots)[0]
  if (weak) {
    const [what, fix] = missAdvice[weak.topMiss!]
    return { title: `From ${bandLabel(weak.band)} yards, most misses ${what}.`, body: `You hit ${pc(weak.greens / weak.shots)} of greens from that distance. ${fix}` }
  }
  const a = v.approach
  const missed = a.total - a.green
  if (missed >= 4) {
    const top = (['short', 'long', 'left', 'right', 'bunker'] as const).map((k) => [k, a[k]] as const).sort((x, y) => y[1] - x[1])[0]
    if (top[1] / missed >= 0.4) {
      const [what, fix] = missAdvice[top[0]]
      return { title: `${pc(top[1] / missed)} of your missed greens ${what}.`, body: fix }
    }
  }
  if (s.gir == null || a.total < 5) return null
  const typical = benchmarkFor(index).gir
  return s.gir >= typical
    ? { title: 'Iron play is a strength.', body: `You hit ${pc(s.gir)} of greens against ${pc(typical)} for a typical ${hcpLabel(index)}.` }
    : { title: `Greens: ${pc(s.gir)} against a typical ${pc(typical)}.`, body: 'Aim for the middle of the green rather than the flag.' }
}

export function shortGameTip(v: StatsView, index: number): Tip | null {
  const b = benchmarkFor(index)
  const sc = v.scramble.chances >= 3 ? v.scramble.saved / v.scramble.chances : null
  const sd = v.sand.chances >= 2 ? v.sand.saved / v.sand.chances : null
  if (sc == null && sd == null) return null
  const scGap = sc == null ? -1 : b.scrambling - sc
  const sdGap = sd == null ? -1 : b.sandSaves - sd
  if (sdGap > 0 && sdGap >= scGap)
    return { title: 'Bunkers are the weak spot.', body: `${v.sand.saved} of ${v.sand.chances} saved. A 15-minute bunker session would pay off fastest.` }
  if (scGap > 0)
    return { title: `You get up and down ${v.scramble.saved} times in ${v.scramble.chances}.`, body: 'Practise chips to a 3-foot circle until 7 out of 10 finish inside it.' }
  return { title: 'Your short game is a strength.', body: `You save par more often than a typical ${hcpLabel(index)}.` }
}

export function puttingTip(s: Summary, index: number): Tip | null {
  if (s.puttsPerRound == null) return null
  const typical = benchmarkFor(index).putts
  const band = (id: string) => s.puttsByBand.find((b) => b.band === id)
  const long = [band('20-40'), band('40+')].filter((b) => b && b.holes >= 2 && b.avgPutts != null)
  const lag = long.length ? long.reduce((a, b) => a + b!.avgPutts! * b!.holes, 0) / long.reduce((a, b) => a + b!.holes, 0) : null
  if ((s.threePuttsPerRound ?? 0) >= 1.5 && lag != null && lag >= 2.2)
    return { title: 'Lag putting is the quick win.', body: `From 20 ft or more you average ${lag.toFixed(1)} putts. Getting those inside 3 ft cuts out three-putts.` }
  const short = [band('u3'), band('3-10')].find((b) => b && b.holes >= 3 && b.avgPutts != null && b.avgPutts > (b.band === 'u3' ? 1.1 : 1.7))
  if (short)
    return { title: 'Short putts are leaking shots.', body: `From ${PUTT_BANDS.find((x) => x.id === short.band)!.label.replace(/^Under/, 'under')} you average ${short.avgPutts!.toFixed(1)} putts. Hole 20 in a row from 3 ft before each round.` }
  if (s.puttsPerRound <= typical) return { title: 'Putting is a strength.', body: `${s.puttsPerRound.toFixed(1)} putts a round against ${typical.toFixed(1)} for a typical ${hcpLabel(index)}.` }
  return { title: `${s.puttsPerRound.toFixed(1)} putts a round against a typical ${typical.toFixed(1)}.`, body: 'Spend 10 minutes on long putts before you play, judging pace to finish just past the hole.' }
}
