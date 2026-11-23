import { useEffect, useMemo, useState } from 'react'
import { go } from '../nav'
import type { Profile } from '../store/profile'
import { loadMyRounds, type MyRound } from '../store/history'
import { focusAreas, summarise } from '../engine/stats'
import { FocusList, PuttingTable, SgBars, Tiles, shortDate } from './Insights'

export function StatsScreen({ profile }: { profile: Profile }) {
  const [mine, setMine] = useState<MyRound[] | null>(null)
  const [range, setRange] = useState<6 | 20 | 0>(20)
  useEffect(() => {
    loadMyRounds(profile).then(setMine)
  }, [profile])
  const list = useMemo(() => (range ? (mine ?? []).slice(0, range) : (mine ?? [])), [mine, range])
  const s = useMemo(() => summarise(list.map((m) => m.facts)), [list])
  const full = list.filter((m) => m.facts.holesPlayed === 18)
  const byPar = [3, 4, 5].map((par) => {
    const hs = list.flatMap((m) => m.facts.holes.filter((h) => h.par === par && h.score != null))
    return { par, n: hs.length, avg: hs.length ? hs.reduce((a, h) => a + h.score!, 0) / hs.length : null }
  })

  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={() => go('')}>
          ‹ Back
        </button>
        <h1>My stats</h1>
      </header>
      <main className="pad stack">
        {!mine && <p className="muted">Loading…</p>}
        {mine && mine.length === 0 && <p className="muted">Play a round and your stats will appear here.</p>}
        {mine && mine.length > 0 && (
          <>
            <div className="seg">
              {([6, 20, 0] as const).map((r) => (
                <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                  {r ? `Last ${r}` : 'All rounds'}
                </button>
              ))}
            </div>
            <Tiles s={s} stableford={full.length ? full.reduce((a, m) => a + m.points, 0) / full.length : null} />
            <SgBars s={s} />
            <FocusList focus={focusAreas(s)} />
            <PuttingTable s={s} />
            <section className="card">
              <div className="sechead">
                <h2>Scoring by par</h2>
              </div>
              <table className="standings">
                <tbody>
                  {byPar.map((b) => (
                    <tr key={b.par}>
                      <td>Par {b.par}s</td>
                      <td className="val">{b.avg == null ? '–' : `${b.avg.toFixed(2)} (${b.avg - b.par >= 0 ? '+' : ''}${(b.avg - b.par).toFixed(2)})`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="card">
              <div className="sechead">
                <h2>Rounds</h2>
              </div>
              <table className="standings">
                <tbody>
                  {list.map((m) => (
                    <tr key={m.round.code} onClick={() => go(`round/${m.round.code}`)}>
                      <td>
                        {m.round.course.name}
                        <div className="muted small">{shortDate(m.round.date)}</div>
                      </td>
                      <td className="val">
                        {m.facts.gross}
                        {m.facts.holesPlayed < 18 ? ` (${m.facts.holesPlayed})` : ''} · {m.points} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
