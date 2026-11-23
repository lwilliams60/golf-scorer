import { useEffect, useState } from 'react'
import { go } from '../nav'
import { backend, localBackend } from '../store/backend'
import { assemble, type StoredPlayer } from '../store/round'
import { myPlayerIn, recentRounds, type Profile } from '../store/profile'
import { holePar, playingHandicap } from '../engine/handicap'
import { stablefordPoints } from '../engine/games'
import type { Round } from '../engine/types'

interface RoundLine {
  code: string
  name: string
  date: string
  gross: number
  holes: number
  points: number
}

interface Agg {
  rounds: RoundLine[]
  fw: { hit: number; left: number; right: number }
  gir: { yes: number; total: number }
  putts: { sum: number; holes: number }
  byPar: Record<number, { sum: number; n: number }>
  penalties: number
}

async function loadMine(profile: Profile): Promise<{ round: Round; pid: string }[]> {
  let codes = recentRounds().map((r) => r.code)
  try {
    codes = [...new Set([...codes, ...(await backend.roundsFor(profile.id))])]
  } catch {
    /* offline: local only */
  }
  const out: { round: Round; pid: string }[] = []
  for (const code of codes) {
    let e = await localBackend.load(code)
    if (!e && backend.kind !== 'local') e = await backend.load(code).catch(() => null)
    const round = e ? assemble(code, e) : null
    if (!round) continue
    const pid = (round.players as StoredPlayer[]).find((p) => p.profileId === profile.id)?.id ?? myPlayerIn(code)
    if (pid && round.players.some((p) => p.id === pid)) out.push({ round, pid })
  }
  return out.sort((a, b) => b.round.date.localeCompare(a.round.date))
}

function aggregate(list: { round: Round; pid: string }[]): Agg {
  const agg: Agg = { rounds: [], fw: { hit: 0, left: 0, right: 0 }, gir: { yes: 0, total: 0 }, putts: { sum: 0, holes: 0 }, byPar: {}, penalties: 0 }
  for (const { round, pid } of list) {
    const p = round.players.find((x) => x.id === pid)!
    const ph = playingHandicap(round.course, p, 0.95)
    let gross = 0
    let holes = 0
    let points = 0
    round.course.holes.forEach((h, i) => {
      const s = round.scores[pid]?.[i]
      const st = round.stats[pid]?.[i]
      const par = holePar(h, p)
      if (s != null && s > 0) {
        gross += s
        holes++
        const b = (agg.byPar[par] ??= { sum: 0, n: 0 })
        b.sum += s - par
        b.n++
      }
      points += stablefordPoints(round, pid, i, ph) ?? 0
      if (st?.fairway && st.fairway !== 'na') agg.fw[st.fairway]++
      if (st?.gir != null) {
        agg.gir.total++
        if (st.gir) agg.gir.yes++
      }
      if (st?.putts != null) {
        agg.putts.sum += st.putts
        agg.putts.holes++
      }
      agg.penalties += st?.penalties ?? 0
    })
    if (holes > 0) agg.rounds.push({ code: round.code, name: round.name, date: round.date, gross, holes, points })
  }
  return agg
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–')

export function StatsScreen({ profile }: { profile: Profile }) {
  const [agg, setAgg] = useState<Agg | null>(null)
  useEffect(() => {
    loadMine(profile).then((l) => setAgg(aggregate(l)))
  }, [profile])

  const full = agg?.rounds.filter((r) => r.holes === 18) ?? []
  const fwTotal = agg ? agg.fw.hit + agg.fw.left + agg.fw.right : 0
  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={() => go('')}>
          ‹ Back
        </button>
        <h1>My stats</h1>
      </header>
      <main className="pad">
        {!agg && <p className="muted">Loading…</p>}
        {agg && agg.rounds.length === 0 && <p className="muted">Play a round and your stats will appear here.</p>}
        {agg && agg.rounds.length > 0 && (
          <>
            <div className="tiles">
              <Tile label="Scoring avg (18 holes)" value={full.length ? (full.reduce((s, r) => s + r.gross, 0) / full.length).toFixed(1) : '–'} />
              <Tile label="Stableford avg" value={full.length ? (full.reduce((s, r) => s + r.points, 0) / full.length).toFixed(1) : '–'} />
              <Tile label="Fairways hit" value={pct(agg.fw.hit, fwTotal)} sub={fwTotal ? `${pct(agg.fw.left, fwTotal)} left · ${pct(agg.fw.right, fwTotal)} right` : undefined} />
              <Tile label="Greens in reg" value={pct(agg.gir.yes, agg.gir.total)} />
              <Tile label="Putts per round" value={agg.putts.holes ? ((agg.putts.sum / agg.putts.holes) * 18).toFixed(1) : '–'} />
              <Tile label="Penalties" value={String(agg.penalties)} sub={`over ${agg.rounds.length} round${agg.rounds.length > 1 ? 's' : ''}`} />
            </div>
            <h2>Scoring by par</h2>
            <table className="standings">
              <tbody>
                {[3, 4, 5].map((par) => {
                  const b = agg.byPar[par]
                  return (
                    <tr key={par}>
                      <td>Par {par}s</td>
                      <td className="val">{b ? `${(par + b.sum / b.n).toFixed(2)} avg (${b.sum / b.n >= 0 ? '+' : ''}${(b.sum / b.n).toFixed(2)})` : '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <h2>Recent rounds</h2>
            <table className="standings">
              <tbody>
                {agg.rounds.map((r) => (
                  <tr key={r.code} onClick={() => go(`round/${r.code}`)}>
                    <td>
                      {r.name}
                      <div className="muted small">{r.date}</div>
                    </td>
                    <td className="val">
                      {r.gross}
                      {r.holes < 18 ? ` (${r.holes})` : ''} · {r.points} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <div className="muted small">{label}</div>
      <div className="big">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  )
}
