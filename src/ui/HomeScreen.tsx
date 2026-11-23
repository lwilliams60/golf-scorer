import { useEffect, useState } from 'react'
import { go } from '../nav'
import { recentRounds, type Profile } from '../store/profile'
import { localBackend, backend } from '../store/backend'
import { assemble } from '../store/round'

interface Row {
  code: string
  name: string
  course: string
  date: string
}

export function HomeScreen({ profile }: { profile: Profile }) {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    ;(async () => {
      const out: Row[] = []
      for (const r of recentRounds()) {
        const e = await localBackend.load(r.code)
        const round = e ? assemble(r.code, e) : null
        if (round) out.push({ code: r.code, name: round.name, course: round.course.name, date: round.date })
      }
      setRows(out)
    })()
  }, [])

  return (
    <div className="screen">
      <header className="top">
        <h1>Golf Scorer</h1>
        <button className="link" onClick={() => go('profile')}>
          {profile.name} · {profile.handicapIndex}
        </button>
      </header>
      <main className="pad">
        <div className="bigbtns">
          <button className="primary" onClick={() => go('create')}>
            Start a round
          </button>
          <button className="secondary" onClick={() => go('join')}>
            Join with a code
          </button>
          <button className="secondary" onClick={() => go('stats')}>
            My stats
          </button>
        </div>
        <h2>Recent rounds</h2>
        {rows.length === 0 && <p className="muted">No rounds yet.</p>}
        <ul className="list">
          {rows.map((r) => (
            <li key={r.code} onClick={() => go(`round/${r.code}`)}>
              <strong>{r.name}</strong>
              <span className="muted">
                {r.course} · {r.date} · {r.code}
              </span>
            </li>
          ))}
        </ul>
        {backend.kind === 'local' && <p className="muted small">Test mode: rounds are saved on this phone only until live sync is switched on.</p>}
      </main>
    </div>
  )
}
