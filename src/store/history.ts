import { backend, localBackend } from './backend'
import { assemble, type StoredPlayer } from './round'
import { myPlayerIn, recentRounds, type Profile } from './profile'
import { playingHandicap } from '../engine/handicap'
import { stablefordPoints } from '../engine/games'
import { moneyTotals, roundResults } from '../engine/settle'
import { roundFacts, type RoundFacts } from '../engine/stats'
import { GAME_LABELS } from '../engine/games'
import type { Round } from '../engine/types'

export interface MyRound {
  round: Round
  pid: string
  facts: RoundFacts
  points: number
  money: number
  games: string
}

/** Every round this player has been in, newest first, from this phone and the server. */
export async function loadMyRounds(profile: Profile): Promise<MyRound[]> {
  let codes = recentRounds().map((r) => r.code)
  try {
    codes = [...new Set([...codes, ...(await backend.roundsFor(profile.id))])]
  } catch {
    /* offline: local only */
  }
  const out: MyRound[] = []
  for (const code of codes) {
    let e = await localBackend.load(code)
    if (backend.kind !== 'local') e = (await backend.load(code).catch(() => null)) ?? e
    const round = e ? assemble(code, e) : null
    if (!round) continue
    const pid = (round.players as StoredPlayer[]).find((p) => p.profileId === profile.id)?.id ?? myPlayerIn(code)
    if (!pid || !round.players.some((p) => p.id === pid)) continue
    const facts = roundFacts(round, pid)
    if (facts.holesPlayed === 0) continue
    const p = round.players.find((x) => x.id === pid)!
    const ph = playingHandicap(round.course, p, 0.95)
    const points = round.course.holes.reduce((s, _, i) => s + (stablefordPoints(round, pid, i, ph) ?? 0), 0)
    let money = 0
    try {
      money = moneyTotals(roundResults(round))[pid] ?? 0
    } catch {
      /* incomplete game setup */
    }
    const games = [...new Set(round.games.map((g) => GAME_LABELS[g.type]))].join(', ')
    out.push({ round, pid, facts, points, money, games })
  }
  return out.sort((a, b) => b.round.date.localeCompare(a.round.date))
}
