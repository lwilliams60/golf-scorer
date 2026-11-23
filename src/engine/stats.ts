import { holePar } from './handicap'
import { benchmarkFor, hcpLabel } from '../data/benchmarks'
import type { ApproachBand, ApproachResult, HoleStats, PuttBand, Round, TeeResult } from './types'

/** Expected putts for a scratch-standard putter from the middle of each distance band (from published tour putting averages). */
export const PUTT_BASELINE: Record<PuttBand, number> = { u3: 1.03, '3-10': 1.4, '10-20': 1.78, '20-40': 1.98, '40+': 2.14 }
export const PUTT_BANDS: { id: PuttBand; label: string }[] = [
  { id: 'u3', label: 'Under 3 ft' },
  { id: '3-10', label: '3–10 ft' },
  { id: '10-20', label: '10–20 ft' },
  { id: '20-40', label: '20–40 ft' },
  { id: '40+', label: '40 ft+' },
]
export const APPROACH_BANDS: { id: ApproachBand; label: string }[] = [
  { id: 'u100', label: 'Under 100' },
  { id: '100-125', label: '100–125' },
  { id: '125-150', label: '125–150' },
  { id: '150-175', label: '150–175' },
  { id: '175-200', label: '175–200' },
  { id: '200+', label: '200+' },
]
export const approachBandLabel = (b: ApproachBand) => `${APPROACH_BANDS.find((x) => x.id === b)!.label.replace('Under 100', 'under 100')} yds`

/**
 * Simplified strokes-gained weights against a scratch golfer. These are estimates from typical
 * amateur-vs-scratch differences, not shot-by-shot strokes gained.
 */
const SG = {
  tee: { fairway: 0.1, left: -0.15, right: -0.15, bunker: -0.3, penalty: -1.0 } as Record<TeeResult, number>,
  approachMiss: { short: -0.35, long: -0.35, left: -0.35, right: -0.35, bunker: -0.45 } as Record<Exclude<ApproachResult, 'green'>, number>,
  approachGreen: { u3: 0.5, '3-10': 0.3, '10-20': 0.1, '20-40': -0.05, '40+': -0.2 } as Record<PuttBand, number>,
  approachGreenUnknown: 0.1,
  scrambleMade: 0.35,
  scrambleMissed: -0.45,
  sandMade: 0.5,
  sandMissed: -0.4,
}

export interface HoleFacts {
  par: number
  score: number | null
  tee: TeeResult | null
  approach: ApproachResult | null
  approachDist: ApproachBand | null
  gir: boolean | null
  putts: number | null
  firstPutt: PuttBand | null
  scrambleChance: boolean
  scrambled: boolean
  sandChance: boolean
  sandSaved: boolean
  sg: { tee: number | null; approach: number | null; around: number | null; putting: number | null }
}

function teeFrom(s: HoleStats): TeeResult | null {
  if (s.tee) return s.tee
  if (s.fairway === 'hit') return 'fairway'
  if (s.fairway === 'left' || s.fairway === 'right') return s.fairway
  return null
}

/** Everything we can work out about one hole from the few taps a player makes. */
export function holeFacts(par: number, gross: number | null | undefined, s: HoleStats = {}): HoleFacts {
  const score = gross != null && gross > 0 ? gross : null
  const tee = par >= 4 ? teeFrom(s) : null
  const putts = s.putts ?? null
  let approach: ApproachResult | null = s.approach ?? null
  let gir: boolean | null = null
  if (approach) gir = approach === 'green'
  else if (score != null && putts != null) gir = score - putts <= par - 2
  else if (s.gir != null) gir = s.gir
  if (!approach && gir === true) approach = 'green'
  const firstPutt = s.firstPutt ?? null
  const sandChance = approach === 'bunker' || (gir === false && s.bunker === true)
  const scrambleChance = gir === false && score != null
  const scrambled = scrambleChance && score! <= par
  const sandSaved = sandChance && score != null && score <= par

  const sg: HoleFacts['sg'] = { tee: null, approach: null, around: null, putting: null }
  if (tee) sg.tee = SG.tee[tee]
  if (approach === 'green') sg.approach = firstPutt ? SG.approachGreen[firstPutt] : SG.approachGreenUnknown
  else if (approach) sg.approach = SG.approachMiss[approach]
  if (scrambleChance) {
    if (sandChance) sg.around = sandSaved ? SG.sandMade : SG.sandMissed
    else sg.around = scrambled ? SG.scrambleMade : SG.scrambleMissed
  }
  if (firstPutt && putts != null && putts > 0) sg.putting = Math.round((PUTT_BASELINE[firstPutt] - putts) * 100) / 100

  return { par, score, tee, approach, approachDist: s.approachDist ?? null, gir, putts, firstPutt, scrambleChance, scrambled, sandChance, sandSaved, sg }
}

export interface RoundFacts {
  code: string
  name: string
  date: string
  course: string
  holesPlayed: number
  gross: number
  toPar: number
  holes: HoleFacts[]
}

export function roundFacts(r: Round, pid: string): RoundFacts {
  const p = r.players.find((x) => x.id === pid)!
  const holes = r.course.holes.map((h, i) => holeFacts(holePar(h, p), r.scores[pid]?.[i], r.stats[pid]?.[i] ?? {}))
  const played = holes.filter((h) => h.score != null)
  return {
    code: r.code,
    name: r.name,
    date: r.date,
    course: r.course.name,
    holesPlayed: played.length,
    gross: played.reduce((s, h) => s + h.score!, 0),
    toPar: played.reduce((s, h) => s + h.score! - h.par, 0),
    holes,
  }
}

const pct = (a: number, b: number) => (b ? a / b : null)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export interface Summary {
  rounds: number
  fullRounds: number
  scoringAvg: number | null
  /** Average score to par over full rounds. */
  toParAvg: number | null
  fairways: number | null
  missLeft: number | null
  missRight: number | null
  teePenaltiesPerRound: number | null
  gir: number | null
  scrambling: number | null
  sandSaves: number | null
  puttsPerRound: number | null
  puttsPerGir: number | null
  threePuttsPerRound: number | null
  approachMiss: Record<Exclude<ApproachResult, 'green'>, number>
  /** Strokes gained per 18 holes, per category; null where nothing was logged. */
  sg: { tee: number | null; approach: number | null; around: number | null; putting: number | null }
  puttsByBand: { band: PuttBand; holes: number; avgPutts: number | null }[]
  /** Greens hit and where misses went, by approach distance (only shots with a distance logged). */
  approachByBand: { band: ApproachBand; shots: number; greens: number; topMiss: Exclude<ApproachResult, 'green'> | null; topMissShare: number }[]
}

export function summarise(rounds: RoundFacts[]): Summary {
  const holes = rounds.flatMap((r) => r.holes.filter((h) => h.score != null))
  const full = rounds.filter((r) => r.holesPlayed === 18)
  const tees = holes.filter((h) => h.tee)
  const misses = tees.filter((h) => h.tee === 'left' || h.tee === 'right')
  const girKnown = holes.filter((h) => h.gir != null)
  const girHoles = girKnown.filter((h) => h.gir)
  const puttHoles = holes.filter((h) => h.putts != null)
  const per18 = (total: number, n: number) => (n ? (total / n) * 18 : null)
  const sgCat = (k: keyof HoleFacts['sg']) => {
    const xs = holes.map((h) => h.sg[k]).filter((x): x is number => x != null)
    // Scale by holes played so categories compare fairly per round.
    return xs.length ? Math.round(per18(xs.reduce((a, b) => a + b, 0), holes.length)! * 10) / 10 : null
  }
  const approachMiss = { short: 0, long: 0, left: 0, right: 0, bunker: 0 }
  for (const h of holes) if (h.approach && h.approach !== 'green') approachMiss[h.approach]++
  return {
    rounds: rounds.length,
    fullRounds: full.length,
    scoringAvg: avg(full.map((r) => r.gross)),
    toParAvg: avg(full.map((r) => r.toPar)),
    fairways: pct(tees.filter((h) => h.tee === 'fairway').length, tees.length),
    missLeft: pct(misses.filter((h) => h.tee === 'left').length, misses.length),
    missRight: pct(misses.filter((h) => h.tee === 'right').length, misses.length),
    teePenaltiesPerRound: tees.length ? per18(tees.filter((h) => h.tee === 'penalty').length, holes.length) : null,
    gir: pct(girHoles.length, girKnown.length),
    scrambling: pct(holes.filter((h) => h.scrambled).length, holes.filter((h) => h.scrambleChance).length),
    sandSaves: pct(holes.filter((h) => h.sandSaved).length, holes.filter((h) => h.sandChance).length),
    puttsPerRound: puttHoles.length ? per18(puttHoles.reduce((s, h) => s + h.putts!, 0), puttHoles.length) : null,
    puttsPerGir: avg(girHoles.filter((h) => h.putts != null).map((h) => h.putts!)),
    threePuttsPerRound: puttHoles.length ? per18(puttHoles.filter((h) => h.putts! >= 3).length, puttHoles.length) : null,
    approachMiss,
    sg: { tee: sgCat('tee'), approach: sgCat('approach'), around: sgCat('around'), putting: sgCat('putting') },
    puttsByBand: (['u3', '3-10', '10-20', '20-40', '40+'] as PuttBand[]).map((band) => {
      const hs = holes.filter((h) => h.firstPutt === band && h.putts != null)
      return { band, holes: hs.length, avgPutts: avg(hs.map((h) => h.putts!)) }
    }),
    approachByBand: APPROACH_BANDS.map(({ id: band }) => {
      const hs = holes.filter((h) => h.approachDist === band && h.approach)
      const miss = { short: 0, long: 0, left: 0, right: 0, bunker: 0 }
      for (const h of hs) if (h.approach !== 'green') miss[h.approach!]++
      const missed = hs.length - hs.filter((h) => h.approach === 'green').length
      const top = (Object.entries(miss) as [Exclude<ApproachResult, 'green'>, number][]).sort((a, b) => b[1] - a[1])[0]
      return { band, shots: hs.length, greens: hs.length - missed, topMiss: top[1] ? top[0] : null, topMissShare: missed ? top[1] / missed : 0 }
    }),
  }
}

export interface Focus {
  area: 'tee' | 'approach' | 'around' | 'putting'
  title: string
  body: string
  /** Lower ranks first: strokes gained, or minus the shots lost against the handicap benchmark. */
  sg: number
  /** Shots a round lost against a typical golfer of your handicap, when ranked that way. */
  gap?: number
}

/**
 * Rough shots a round each area costs compared with a typical golfer of this handicap (Shot Scope averages).
 * Tee: each missed fairway ~0.25 shots over ~14 driving holes. Approach: each missed green ~0.6 shots.
 * Around the green: each failed up and down 1 shot, over the greens you actually miss. Putting: putts a round.
 */
export function benchmarkGaps(s: Summary, index: number) {
  const b = benchmarkFor(index)
  const missedGreens = 18 * (1 - (s.gir ?? b.gir))
  return {
    tee: s.fairways == null ? null : (b.fairways - s.fairways) * 14 * 0.25,
    approach: s.gir == null ? null : (b.gir - s.gir) * 18 * 0.6,
    around: s.scrambling == null ? null : (b.scrambling - s.scrambling) * missedGreens,
    putting: s.puttsPerRound == null ? null : s.puttsPerRound - b.putts,
  }
}

/** The three areas costing the most strokes, each with a reason from the player's data and a drill. */
export function focusAreas(s: Summary, index?: number): Focus[] {
  const out: Focus[] = []
  const p = (x: number | null) => (x == null ? '' : `${Math.round(x * 100)}%`)
  if (s.sg.tee != null) {
    if ((s.teePenaltiesPerRound ?? 0) >= 1)
      out.push({ area: 'tee', sg: s.sg.tee, title: 'Penalty shots off the tee', body: `About ${s.teePenaltiesPerRound!.toFixed(1)} tee-shot penalties a round. On tight holes, tee off with the club you hit straightest, even if it's shorter.` })
    else if ((s.missRight ?? 0) >= 0.6)
      out.push({ area: 'tee', sg: s.sg.tee, title: 'Tee shots missing right', body: `${p(s.missRight)} of missed fairways go right. Range: 20 drivers with an alignment stick at your feet, checking your clubface at the top.` })
    else if ((s.missLeft ?? 0) >= 0.6)
      out.push({ area: 'tee', sg: s.sg.tee, title: 'Tee shots missing left', body: `${p(s.missLeft)} of missed fairways go left. Range: hit 20 drives at 80% speed focusing on a full turn through the ball.` })
    else out.push({ area: 'tee', sg: s.sg.tee, title: 'Finding fairways', body: `Hitting ${p(s.fairways)} of fairways. Pick a small target on every tee shot and commit to it in practice.` })
  }
  if (s.sg.approach != null) {
    const m = s.approachMiss
    const total = m.short + m.long + m.left + m.right + m.bunker
    const top = (Object.entries(m) as [string, number][]).sort((a, b) => b[1] - a[1])[0]
    const share = total ? top[1] / total : 0
    const body =
      top[0] === 'short' && share >= 0.4
        ? `${Math.round(share * 100)}% of missed greens come up short. Take one more club into greens and aim for the middle.`
        : top[0] === 'long' && share >= 0.4
          ? `${Math.round(share * 100)}% of missed greens go long. Check your carry distances on a launch monitor or range with yardage markers.`
          : `Hitting ${p(s.gir)} of greens in regulation. Range: 9-shot challenge with your 7-iron, 3 balls each to a short, middle and long target.`
    const banded = (s.approachByBand ?? []).filter((b) => b.shots >= 3)
    const worst = banded.length >= 2 ? [...banded].sort((a, b) => a.greens / a.shots - b.greens / b.shots)[0] : null
    const where = worst
      ? ` Your weakest distance is ${approachBandLabel(worst.band)}: ${worst.greens} of ${worst.shots} greens hit${worst.topMiss && worst.topMissShare >= 0.5 ? `, mostly missing ${worst.topMiss === 'bunker' ? 'into bunkers' : worst.topMiss}` : ''}.`
      : ''
    out.push({ area: 'approach', sg: s.sg.approach, title: worst ? `Approaches from ${approachBandLabel(worst.band)}` : 'Approach shots', body: body + where })
  }
  if (s.sg.around != null) {
    const bm = index == null ? null : benchmarkFor(index)
    const sandWorse =
      s.sandSaves != null &&
      (s.scrambling == null || (bm ? bm.sandSaves - s.sandSaves > bm.scrambling - s.scrambling : s.sandSaves < s.scrambling))
    out.push(
      sandWorse
        ? { area: 'around', sg: s.sg.around, title: 'Bunker play', body: `Saving par from ${p(s.sandSaves)} of greenside bunkers. Drill: draw a line in the sand and hit 20 shots taking sand from the line forward.` }
        : { area: 'around', sg: s.sg.around, title: 'Up and downs', body: `Getting up and down ${p(s.scrambling)} of the time. Drill: 10 balls from 3 different lies around the green, count how many finish inside 3 feet.` },
    )
  }
  if (s.sg.putting != null) {
    out.push(
      (s.threePuttsPerRound ?? 0) >= 1
        ? { area: 'putting', sg: s.sg.putting, title: 'Lag putting', body: `${s.threePuttsPerRound!.toFixed(1)} three-putts a round. Ladder drill: 3 balls from 20, 30 and 40 feet, stop each within a putter length.` }
        : { area: 'putting', sg: s.sg.putting, title: 'Holing out', body: `${s.puttsPerRound?.toFixed(1) ?? '–'} putts a round. Drill: 10 putts in a circle at 4 feet, start again if you miss one.` },
    )
  }
  if (index == null) return out.sort((a, b) => a.sg - b.sg).slice(0, 3)

  // Rank by shots lost against a typical golfer of the same handicap, and only where you're behind.
  const gaps = benchmarkGaps(s, index)
  const b = benchmarkFor(index)
  const p0 = (x: number) => `${Math.round(x * 100)}%`
  const compare: Record<Focus['area'], string> = {
    tee: `fairways ${p(s.fairways)} v ${p0(b.fairways)}`,
    approach: `greens ${p(s.gir)} v ${p0(b.gir)}`,
    around: `up and downs ${p(s.scrambling)} v ${p0(b.scrambling)}`,
    putting: `putts ${s.puttsPerRound?.toFixed(1) ?? '–'} v ${b.putts.toFixed(1)}`,
  }
  return out
    .map((f) => ({ f, gap: gaps[f.area] }))
    .filter((x): x is { f: Focus; gap: number } => x.gap != null && x.gap >= 0.25)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map(({ f, gap }) => ({
      ...f,
      sg: -gap,
      gap,
      body: `About ${gap.toFixed(1)} shots a round behind a typical ${hcpLabel(index)} (${compare[f.area]}). ${f.body}`,
    }))
}
