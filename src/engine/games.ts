import { holePar, holeSI, playingHandicap, strokesOnHole, courseHandicap } from './handicap'
import type { GameConfig, Player, Round } from './types'

export interface Standing {
  id: string
  label: string
  /** Main number shown on the leaderboard (points, strokes, skins, match status). */
  value: number
  display: string
  detail?: string
}

export interface GameResult {
  game: GameConfig
  title: string
  /** Sorted best first. */
  standings: Standing[]
  /** Money per player id: positive = receives, negative = pays. */
  money: Record<string, number>
  /** Per-hole notes, e.g. who won the hole, who is wolf. */
  holeNotes: (string | null)[]
  /** Extra live info, e.g. snake holder. */
  note?: string
}

export const GAME_LABELS: Record<GameConfig['type'], string> = {
  stroke: 'Stroke play',
  stableford: 'Stableford',
  match: 'Match play',
  betterBall: 'Better ball',
  skins: 'Skins',
  nassau: 'Nassau',
  scramble: 'Texas scramble',
  sixPoint: 'Six Point',
  wolf: 'Wolf',
  snake: 'Snake',
}

export const DEFAULT_ALLOWANCE: Record<GameConfig['type'], number> = {
  stroke: 1,
  stableford: 1,
  match: 1,
  betterBall: 0.85,
  skins: 1,
  nassau: 1,
  scramble: 1,
  sixPoint: 1,
  wolf: 1,
  snake: 0,
}

const PICKUP = Number.POSITIVE_INFINITY
const NHOLES = (r: Round) => r.course.holes.length

function player(r: Round, id: string): Player {
  const p = r.players.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown player ${id}`)
  return p
}

export function gross(r: Round, pid: string, i: number): number | null {
  const v = r.scores[pid]?.[i]
  return v === undefined ? null : v
}

/** Net score per hole: null = not entered, Infinity = picked up. */
function netScore(r: Round, pid: string, i: number, ph: number): number | null {
  const g = gross(r, pid, i)
  if (g === null) return null
  if (g === 0) return PICKUP
  const p = player(r, pid)
  return g - strokesOnHole(ph, holeSI(r.course.holes[i], p), NHOLES(r))
}

function phFor(r: Round, g: GameConfig, pid: string): number {
  if (g.gross) return 0
  return playingHandicap(r.course, player(r, pid), g.allowance)
}

export function stablefordPoints(r: Round, pid: string, i: number, ph: number): number | null {
  const n = netScore(r, pid, i, ph)
  if (n === null) return null
  if (n === PICKUP) return 0
  const par = holePar(r.course.holes[i], player(r, pid))
  return Math.max(0, par + 2 - n)
}

/** Each player receives stake × (their points − each other player's points). */
function pairwiseMoney(values: Record<string, number>, stake: number, members?: Record<string, string[]>): Record<string, number> {
  const out: Record<string, number> = {}
  const ids = Object.keys(values)
  for (const a of ids) {
    let amt = 0
    for (const b of ids) if (a !== b) amt += (values[a] - values[b]) * stake
    if (members) for (const m of members[a]) out[m] = (out[m] ?? 0) + amt
    else out[a] = amt
  }
  return out
}

function name(r: Round, id: string) {
  return player(r, id).name
}

function teamKey(team: string[]) {
  return team.join('+')
}

function teamName(r: Round, team: string[]) {
  return team.map((id) => name(r, id)).join(' & ')
}

function sortStandings(s: Standing[], lowerIsBetter: boolean) {
  return s.sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value))
}

function fmtMoney(n: number) {
  const v = Math.round(n * 100) / 100
  return v
}

// ---------- Stroke play ----------
function strokePlay(r: Round, g: GameConfig): GameResult {
  const standings: Standing[] = []
  const totals: Record<string, number> = {}
  let allComplete = true
  for (const pid of g.players) {
    const ph = phFor(r, g, pid)
    let total = 0
    let thru = 0
    let nr = false
    let parSoFar = 0
    for (let i = 0; i < NHOLES(r); i++) {
      const gs = gross(r, pid, i)
      if (gs === null) continue
      if (gs === 0) nr = true
      total += gs
      thru++
      parSoFar += holePar(r.course.holes[i], player(r, pid))
    }
    if (thru < NHOLES(r) || nr) allComplete = false
    const strokesSoFar = r.course.holes
      .map((h, i) => (gross(r, pid, i) !== null ? strokesOnHole(ph, holeSI(h, player(r, pid)), NHOLES(r)) : 0))
      .reduce((a, b) => a + b, 0)
    const net = total - strokesSoFar
    const toPar = net - parSoFar
    totals[pid] = net
    standings.push({
      id: pid,
      label: name(r, pid),
      value: nr ? 9999 : toPar,
      display: nr ? 'NR' : thru === 0 ? '-' : toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`,
      detail: nr ? 'Picked up' : `${g.gross ? 'Gross' : 'Net'} ${net} thru ${thru}`,
    })
  }
  // Stroke play money: stake per stroke, only once everyone has a full card.
  const money = allComplete && g.stake ? pairwiseMoney(Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, -v])), g.stake) : {}
  return { game: g, title: `${GAME_LABELS.stroke}${g.gross ? ' (gross)' : ''}`, standings: sortStandings(standings, true), money, holeNotes: [] }
}

// ---------- Stableford ----------
function stableford(r: Round, g: GameConfig): GameResult {
  const pts: Record<string, number> = {}
  const standings: Standing[] = []
  for (const pid of g.players) {
    const ph = phFor(r, g, pid)
    let total = 0
    let thru = 0
    for (let i = 0; i < NHOLES(r); i++) {
      const p = stablefordPoints(r, pid, i, ph)
      if (p === null) continue
      total += p
      thru++
    }
    pts[pid] = total
    standings.push({ id: pid, label: name(r, pid), value: total, display: `${total}`, detail: `thru ${thru} · PH ${ph}` })
  }
  return { game: g, title: GAME_LABELS.stableford, standings: sortStandings(standings, false), money: g.stake ? pairwiseMoney(pts, g.stake) : {}, holeNotes: [] }
}

// ---------- Match play (singles) and Nassau ----------
interface MatchHole {
  /** +1 = first player won, -1 = second won, 0 = halved, null = not complete. */
  result: number | null
}

function singlesHoles(r: Round, g: GameConfig): { holes: MatchHole[]; a: string; b: string; strokesA: number; strokesB: number } {
  const [a, b] = g.players
  const pa = phFor(r, g, a)
  const pb = phFor(r, g, b)
  const low = Math.min(pa, pb)
  const strokesA = pa - low
  const strokesB = pb - low
  const holes: MatchHole[] = []
  for (let i = 0; i < NHOLES(r); i++) {
    const na = netScore(r, a, i, strokesA)
    const nb = netScore(r, b, i, strokesB)
    if (na === null || nb === null) holes.push({ result: null })
    else holes.push({ result: na < nb ? 1 : nb < na ? -1 : 0 })
  }
  return { holes, a, b, strokesA, strokesB }
}

export interface MatchStatus {
  /** Positive = first side up. */
  up: number
  played: number
  remaining: number
  finished: boolean
  text: string
}

export function matchStatus(holes: MatchHole[], sideA: string, sideB: string): MatchStatus {
  let up = 0
  let played = 0
  let finished = false
  let decidedText = ''
  const total = holes.length
  for (let i = 0; i < total; i++) {
    const h = holes[i]
    if (h.result === null) break
    up += h.result
    played++
    const remaining = total - played
    if (Math.abs(up) > remaining) {
      finished = true
      const leader = up > 0 ? sideA : sideB
      decidedText = remaining === 0 ? `${leader} wins ${Math.abs(up)} up` : `${leader} wins ${Math.abs(up)} & ${remaining}`
      break
    }
  }
  const remaining = total - played
  if (!finished && played === total) {
    finished = true
    decidedText = up === 0 ? 'Match halved' : `${up > 0 ? sideA : sideB} wins ${Math.abs(up)} up`
  }
  let text = decidedText
  if (!finished) {
    if (played === 0) text = 'Not started'
    else if (up === 0) text = `All square after ${played}`
    else if (Math.abs(up) === remaining) text = `${up > 0 ? sideA : sideB} dormie ${Math.abs(up)}`
    else text = `${up > 0 ? sideA : sideB} ${Math.abs(up)} up after ${played}`
  }
  return { up, played, remaining, finished, text }
}

function matchMoney(st: MatchStatus, teamA: string[], teamB: string[], stake: number, money: Record<string, number>) {
  if (!st.finished || !stake || st.up === 0) return
  const [win, lose] = st.up > 0 ? [teamA, teamB] : [teamB, teamA]
  for (const p of win) money[p] = (money[p] ?? 0) + stake
  for (const p of lose) money[p] = (money[p] ?? 0) - stake
}

function matchPlay(r: Round, g: GameConfig): GameResult {
  const { holes, a, b, strokesA, strokesB } = singlesHoles(r, g)
  const st = matchStatus(holes, name(r, a), name(r, b))
  const money: Record<string, number> = {}
  matchMoney(st, [a], [b], g.stake, money)
  const getter = strokesA > 0 ? `${name(r, a)} gets ${strokesA}` : strokesB > 0 ? `${name(r, b)} gets ${strokesB}` : 'Level'
  return {
    game: g,
    title: `${GAME_LABELS.match}: ${name(r, a)} v ${name(r, b)}`,
    standings: [
      { id: a, label: name(r, a), value: st.up, display: st.up > 0 ? `${st.up} up` : st.up === 0 ? 'AS' : '' },
      { id: b, label: name(r, b), value: -st.up, display: st.up < 0 ? `${-st.up} up` : st.up === 0 ? 'AS' : '' },
    ].sort((x, y) => y.value - x.value),
    money,
    holeNotes: holes.map((h) => (h.result === null ? null : h.result === 0 ? 'Halved' : h.result > 0 ? name(r, a) : name(r, b))),
    note: `${st.text} · ${getter}`,
  }
}

function nassau(r: Round, g: GameConfig): GameResult {
  const { holes, a, b } = singlesHoles(r, g)
  const n = holes.length
  const half = Math.floor(n / 2)
  const segs: [string, MatchHole[]][] = [
    ['Front 9', holes.slice(0, half)],
    ['Back 9', holes.slice(half)],
    ['Overall', holes],
  ]
  const money: Record<string, number> = {}
  const lines: string[] = []
  let netA = 0
  for (const [label, hs] of segs) {
    const st = matchStatus(hs, name(r, a), name(r, b))
    matchMoney(st, [a], [b], g.stake, money)
    if (st.finished) netA += Math.sign(st.up)
    lines.push(`${label}: ${st.text}`)
  }
  return {
    game: g,
    title: `${GAME_LABELS.nassau}: ${name(r, a)} v ${name(r, b)}`,
    standings: [
      { id: a, label: name(r, a), value: netA, display: `${netA >= 0 ? '+' : ''}${netA} bets` },
      { id: b, label: name(r, b), value: -netA, display: `${-netA >= 0 ? '+' : ''}${-netA} bets` },
    ].sort((x, y) => y.value - x.value),
    money,
    holeNotes: holes.map((h) => (h.result === null ? null : h.result === 0 ? 'Halved' : h.result > 0 ? name(r, a) : name(r, b))),
    note: lines.join(' · '),
  }
}

// ---------- Better ball ----------
function betterBall(r: Round, g: GameConfig): GameResult {
  const teams = g.teams ?? []
  const mode = g.betterBallMode ?? 'stableford'
  if (mode === 'match' && teams.length === 2) {
    const all = teams.flat()
    const phs = Object.fromEntries(all.map((p) => [p, phFor(r, g, p)]))
    const low = Math.min(...Object.values(phs))
    const holes: MatchHole[] = []
    for (let i = 0; i < NHOLES(r); i++) {
      const best = teams.map((t) => {
        const nets = t.map((p) => netScore(r, p, i, phs[p] - low))
        if (nets.some((x) => x === null)) return null
        return Math.min(...(nets as number[]))
      })
      if (best[0] === null || best[1] === null) holes.push({ result: null })
      else holes.push({ result: best[0] < best[1] ? 1 : best[1] < best[0] ? -1 : best[0] === PICKUP ? 0 : 0 })
    }
    const [ta, tb] = teams
    const st = matchStatus(holes, teamName(r, ta), teamName(r, tb))
    const money: Record<string, number> = {}
    matchMoney(st, ta, tb, g.stake, money)
    return {
      game: g,
      title: `${GAME_LABELS.betterBall} match`,
      standings: [
        { id: teamKey(ta), label: teamName(r, ta), value: st.up, display: st.up > 0 ? `${st.up} up` : st.up === 0 ? 'AS' : '' },
        { id: teamKey(tb), label: teamName(r, tb), value: -st.up, display: st.up < 0 ? `${-st.up} up` : st.up === 0 ? 'AS' : '' },
      ].sort((x, y) => y.value - x.value),
      money,
      holeNotes: holes.map((h) => (h.result === null ? null : h.result === 0 ? 'Halved' : h.result > 0 ? teamName(r, ta) : teamName(r, tb))),
      note: st.text,
    }
  }
  const pts: Record<string, number> = {}
  const members: Record<string, string[]> = {}
  const standings: Standing[] = []
  for (const t of teams) {
    const key = teamKey(t)
    members[key] = t
    let total = 0
    let thru = 0
    for (let i = 0; i < NHOLES(r); i++) {
      const ps = t.map((p) => stablefordPoints(r, p, i, phFor(r, g, p)))
      const entered = ps.filter((x): x is number => x !== null)
      if (entered.length === 0) continue
      total += Math.max(...entered)
      if (entered.length === t.length) thru++
    }
    pts[key] = total
    standings.push({ id: key, label: teamName(r, t), value: total, display: `${total}`, detail: `thru ${thru}` })
  }
  return {
    game: g,
    title: `${GAME_LABELS.betterBall} Stableford`,
    standings: sortStandings(standings, false),
    money: g.stake ? pairwiseMoney(pts, g.stake, members) : {},
    holeNotes: [],
  }
}

// ---------- Skins ----------
function skins(r: Round, g: GameConfig): GameResult {
  const won: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, 0]))
  const notes: (string | null)[] = []
  let carry = 0
  const phs = Object.fromEntries(g.players.map((p) => [p, phFor(r, g, p)]))
  for (let i = 0; i < NHOLES(r); i++) {
    const nets = g.players.map((p) => netScore(r, p, i, phs[p]))
    if (nets.some((x) => x === null)) {
      notes.push(null)
      continue
    }
    const vals = nets as number[]
    const best = Math.min(...vals)
    const winners = g.players.filter((_, k) => vals[k] === best)
    const pot = 1 + carry
    if (best !== PICKUP && winners.length === 1) {
      won[winners[0]] += pot
      carry = 0
      notes.push(`${name(r, winners[0])} wins ${pot} skin${pot > 1 ? 's' : ''}`)
    } else {
      carry = pot
      notes.push(`Tied, ${carry} carried`)
    }
  }
  const standings = g.players.map((p) => ({ id: p, label: name(r, p), value: won[p], display: `${won[p]}` }))
  return {
    game: g,
    title: GAME_LABELS.skins,
    standings: sortStandings(standings, false),
    money: g.stake ? pairwiseMoney(won, g.stake) : {},
    holeNotes: notes,
    note: carry ? `${carry} skin${carry > 1 ? 's' : ''} carrying over` : undefined,
  }
}

// ---------- Texas scramble ----------
const SCRAMBLE_SHARES: Record<number, number[]> = { 2: [0.35, 0.15], 3: [0.3, 0.2, 0.1], 4: [0.25, 0.2, 0.15, 0.1] }

export function scrambleHandicap(r: Round, team: string[]): number {
  const chs = team.map((p) => courseHandicap(r.course, player(r, p))).sort((a, b) => a - b)
  const shares = SCRAMBLE_SHARES[team.length] ?? chs.map(() => 0.1)
  return Math.round(chs.reduce((s, ch, k) => s + ch * (shares[k] ?? 0), 0) * 10) / 10
}

function scramble(r: Round, g: GameConfig): GameResult {
  const teams = g.teams ?? []
  const standings: Standing[] = []
  const vals: Record<string, number> = {}
  const members: Record<string, string[]> = {}
  let allDone = true
  for (const t of teams) {
    const key = teamKey(t)
    members[key] = t
    const sc = r.teamScores[key] ?? []
    let total = 0
    let thru = 0
    let par = 0
    for (let i = 0; i < NHOLES(r); i++) {
      const v = sc[i]
      if (v == null || v === 0) continue
      total += v
      thru++
      par += r.course.holes[i].par_m
    }
    if (thru < NHOLES(r)) allDone = false
    const th = g.gross ? 0 : scrambleHandicap(r, t)
    const net = Math.round((total - (th * thru) / NHOLES(r)) * 10) / 10
    const toPar = Math.round((net - par) * 10) / 10
    vals[key] = -net
    standings.push({
      id: key,
      label: teamName(r, t),
      value: thru ? toPar : 9999,
      display: thru === 0 ? '-' : toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`,
      detail: `Gross ${total} · team h'cap ${th} · thru ${thru}`,
    })
  }
  // Money: each player wins the stake for every team theirs beats, and pays it for every team that beats them.
  const money: Record<string, number> = {}
  if (allDone && g.stake) {
    for (const a of Object.keys(vals)) {
      let rank = 0
      for (const b of Object.keys(vals)) if (a !== b) rank += Math.sign(vals[a] - vals[b])
      for (const m of members[a]) money[m] = (money[m] ?? 0) + rank * g.stake
    }
  }
  return { game: g, title: GAME_LABELS.scramble, standings: sortStandings(standings, true), money, holeNotes: [], note: 'Team handicap is applied pro rata to holes played' }
}

// ---------- Six Point ----------
export function sixPointSplit(nets: number[], split: '420' | '321' = '420'): number[] {
  const order = nets.map((v, k) => ({ v, k })).sort((x, y) => x.v - y.v)
  const [a, b, c] = order.map((o) => o.v)
  const pts = [0, 0, 0]
  const assign = (vals: number[]) => order.forEach((o, idx) => (pts[o.k] = vals[idx]))
  if (a === PICKUP) {
    assign([2, 2, 2])
    return pts
  }
  if (b - a >= 2) {
    assign([6, 0, 0])
    return pts
  }
  const t = split === '420' ? { win: [4, 2, 0], topTie: [3, 3, 0], botTie: [4, 1, 1] } : { win: [3, 2, 1], topTie: [2.5, 2.5, 1], botTie: [3, 1.5, 1.5] }
  if (a === b && b === c) assign([2, 2, 2])
  else if (a === b) assign(t.topTie)
  else if (b === c) assign(t.botTie)
  else assign(t.win)
  return pts
}

function sixPoint(r: Round, g: GameConfig): GameResult {
  const ids = g.players.slice(0, 3)
  const totals: Record<string, number> = Object.fromEntries(ids.map((p) => [p, 0]))
  const phs = Object.fromEntries(ids.map((p) => [p, phFor(r, g, p)]))
  const notes: (string | null)[] = []
  for (let i = 0; i < NHOLES(r); i++) {
    const nets = ids.map((p) => netScore(r, p, i, phs[p]))
    if (nets.some((x) => x === null)) {
      notes.push(null)
      continue
    }
    const pts = sixPointSplit(nets as number[], g.sixPointSplit)
    ids.forEach((p, k) => (totals[p] += pts[k]))
    notes.push(ids.map((p, k) => `${name(r, p)} ${pts[k]}`).join(', '))
  }
  const standings = ids.map((p) => ({ id: p, label: name(r, p), value: totals[p], display: `${totals[p]}` }))
  return { game: g, title: GAME_LABELS.sixPoint, standings: sortStandings(standings, false), money: g.stake ? pairwiseMoney(totals, g.stake) : {}, holeNotes: notes }
}

// ---------- Wolf ----------
export const WOLF_POINTS = { teamWin: 1, loneWin: 4, loneLossEach: 1 }

/** Who is Wolf on hole i, given points so far. Holes 17 and 18: the player in last place. */
export function wolfFor(order: string[], i: number, pointsSoFar: Record<string, number>, nHoles = 18): string {
  if (i >= nHoles - 2) {
    const min = Math.min(...order.map((p) => pointsSoFar[p] ?? 0))
    const rot = order[i % order.length]
    if ((pointsSoFar[rot] ?? 0) === min) return rot
    return order.find((p) => (pointsSoFar[p] ?? 0) === min)!
  }
  return order[i % order.length]
}

function wolf(r: Round, g: GameConfig): GameResult {
  const order = g.players.slice(0, 4)
  const pts: Record<string, number> = Object.fromEntries(order.map((p) => [p, 0]))
  const phs = Object.fromEntries(order.map((p) => [p, phFor(r, g, p)]))
  const choices = r.wolf[g.id] ?? []
  const notes: (string | null)[] = []
  let nextWolf: string | null = null
  for (let i = 0; i < NHOLES(r); i++) {
    const w = wolfFor(order, i, pts, NHOLES(r))
    const choice = choices[i]
    const nets = Object.fromEntries(order.map((p) => [p, netScore(r, p, i, phs[p])]))
    if (!choice || Object.values(nets).some((x) => x === null)) {
      if (nextWolf === null) nextWolf = w
      notes.push(`${name(r, w)} is Wolf${choice ? (choice.partner ? ` with ${name(r, choice.partner)}` : ' (Lone)') : ''}`)
      // Later holes can't be scored until this one is, since 17/18 depend on standings.
      for (let j = i + 1; j < NHOLES(r); j++) notes.push(null)
      break
    }
    const others = order.filter((p) => p !== w && p !== choice.partner)
    const n = nets as Record<string, number>
    if (choice.partner) {
      const side = [w, choice.partner]
      const a = Math.min(...side.map((p) => n[p]))
      const b = Math.min(...others.map((p) => n[p]))
      if (a < b) side.forEach((p) => (pts[p] += WOLF_POINTS.teamWin))
      else if (b < a) others.forEach((p) => (pts[p] += WOLF_POINTS.teamWin))
      notes.push(`${name(r, w)} & ${name(r, choice.partner)}: ${a < b ? 'won' : b < a ? 'lost' : 'halved'}`)
    } else {
      const a = n[w]
      const b = Math.min(...others.map((p) => n[p]))
      if (a < b) pts[w] += WOLF_POINTS.loneWin
      else if (b < a) others.forEach((p) => (pts[p] += WOLF_POINTS.loneLossEach))
      notes.push(`${name(r, w)} Lone Wolf: ${a < b ? 'won' : b < a ? 'lost' : 'halved'}`)
    }
  }
  const standings = order.map((p) => ({ id: p, label: name(r, p), value: pts[p], display: `${pts[p]}` }))
  return {
    game: g,
    title: GAME_LABELS.wolf,
    standings: sortStandings(standings, false),
    money: g.stake ? pairwiseMoney(pts, g.stake) : {},
    holeNotes: notes,
    note: nextWolf ? `${name(r, nextWolf)} is Wolf next` : undefined,
  }
}

/** Wolf for a given hole, for the scorecard. */
export function currentWolf(r: Round, g: GameConfig, i: number): string {
  const order = g.players.slice(0, 4)
  const pts: Record<string, number> = Object.fromEntries(order.map((p) => [p, 0]))
  const phs = Object.fromEntries(order.map((p) => [p, phFor(r, g, p)]))
  for (let j = 0; j < i; j++) {
    const w = wolfFor(order, j, pts, NHOLES(r))
    const c = (r.wolf[g.id] ?? [])[j]
    const n = Object.fromEntries(order.map((p) => [p, netScore(r, p, j, phs[p])]))
    if (!c || Object.values(n).some((x) => x === null)) break
    const others = order.filter((p) => p !== w && p !== c.partner)
    const nn = n as Record<string, number>
    if (c.partner) {
      const side = [w, c.partner]
      const a = Math.min(...side.map((p) => nn[p]))
      const b = Math.min(...others.map((p) => nn[p]))
      if (a < b) side.forEach((p) => (pts[p] += WOLF_POINTS.teamWin))
      else if (b < a) others.forEach((p) => (pts[p] += WOLF_POINTS.teamWin))
    } else {
      const a = nn[w]
      const b = Math.min(...others.map((p) => nn[p]))
      if (a < b) pts[w] += WOLF_POINTS.loneWin
      else if (b < a) others.forEach((p) => (pts[p] += WOLF_POINTS.loneLossEach))
    }
  }
  return wolfFor(order, i, pts, NHOLES(r))
}

// ---------- Snake ----------
function snake(r: Round, g: GameConfig): GameResult {
  let holder: string | null = null
  let count = 0
  const threes: Record<string, number> = Object.fromEntries(g.players.map((p) => [p, 0]))
  const notes: (string | null)[] = []
  let allDone = true
  for (let i = 0; i < NHOLES(r); i++) {
    const putts = g.players.map((p) => r.stats[p]?.[i]?.putts)
    if (putts.some((x) => x == null)) allDone = false
    const three = g.players.map((p, k) => ({ p, n: putts[k] ?? 0, k })).filter((x) => x.n >= 3)
    if (three.length) {
      count += three.length
      three.forEach((x) => threes[x.p]++)
      // Most putts holds it; on a tie, the later player in the group.
      three.sort((a, b) => a.n - b.n || a.k - b.k)
      holder = three[three.length - 1].p
      notes.push(`${name(r, holder)} takes the snake`)
    } else notes.push(null)
  }
  const value = count ? g.stake + (g.snakeGrowth ?? 0) * (count - 1) : 0
  const money: Record<string, number> = {}
  if (holder && allDone && value) {
    for (const p of g.players) money[p] = p === holder ? -value * (g.players.length - 1) : value
  }
  const standings = g.players.map((p) => ({
    id: p,
    label: name(r, p),
    value: p === holder ? 1 : 0,
    display: p === holder ? 'Holding' : '',
    detail: `${threes[p]} three-putt${threes[p] === 1 ? '' : 's'}`,
  }))
  return {
    game: g,
    title: GAME_LABELS.snake,
    standings: standings.sort((a, b) => a.value - b.value),
    money,
    holeNotes: notes,
    note: holder ? `${name(r, holder)} holds the snake${value ? ` (worth ${fmtMoney(value)} to each player)` : ''}` : 'Nobody has three-putted yet',
  }
}

export function scoreGame(r: Round, g: GameConfig): GameResult {
  switch (g.type) {
    case 'stroke':
      return strokePlay(r, g)
    case 'stableford':
      return stableford(r, g)
    case 'match':
      return matchPlay(r, g)
    case 'nassau':
      return nassau(r, g)
    case 'betterBall':
      return betterBall(r, g)
    case 'skins':
      return skins(r, g)
    case 'scramble':
      return scramble(r, g)
    case 'sixPoint':
      return sixPoint(r, g)
    case 'wolf':
      return wolf(r, g)
    case 'snake':
      return snake(r, g)
  }
}
