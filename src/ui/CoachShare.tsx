import { useEffect, useState } from 'react'
import { go } from '../nav'
import type { Profile } from '../store/profile'
import type { MyRound } from '../store/history'
import { buildReport, coachUrl, createShare, loadShare, myShares, revokeShare, SHARE_ROUNDS, type CoachReport } from '../store/share'
import { FocusList, PuttingTable, SgBars, Tiles, shortDate } from './Insights'

export function ShareWithCoach({ profile, mine }: { profile: Profile; mine: MyRound[] }) {
  const [busy, setBusy] = useState(false)
  const [links, setLinks] = useState(myShares)
  const [msg, setMsg] = useState('')
  const n = Math.min(SHARE_ROUNDS, mine.length)

  async function share() {
    setBusy(true)
    setMsg('')
    try {
      const t = await createShare(buildReport(profile, mine))
      setLinks(myShares())
      const url = coachUrl(t)
      const text = `${profile.name}'s golf stats, last ${n} round${n > 1 ? 's' : ''}`
      try {
        if (navigator.share) await navigator.share({ title: text, text, url })
        else {
          await navigator.clipboard.writeText(url)
          setMsg('Link copied. Paste it into a message to your coach.')
        }
      } catch {
        /* share sheet closed */
      }
    } catch {
      setMsg("Couldn't make the link. Check you have signal and try again.")
    }
    setBusy(false)
  }

  return (
    <section className="card">
      <div className="sechead">
        <h2>Share with your coach</h2>
      </div>
      <p className="muted small" style={{ margin: '4px 0 12px' }}>
        Sends a private link to a report of your last {n} round{n > 1 ? 's' : ''}: every stat on this page plus hole-by-hole detail. No sign-in needed to view
        it, and you can switch the link off at any time.
      </p>
      <button className="primary" style={{ width: '100%' }} disabled={busy} onClick={share}>
        {busy ? 'Making link…' : 'Share my last rounds'}
      </button>
      {msg && <p className="small">{msg}</p>}
      {links.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="muted small">Links you've shared ({links.length})</summary>
          <ul className="payments">
            {links.map((l) => (
              <li key={l.token}>
                <span className="small">Shared {shortDate(l.createdAt.slice(0, 10))}</span>
                <button
                  className="link small"
                  style={{ marginLeft: 'auto', color: 'var(--bad)' }}
                  onClick={async () => {
                    await revokeShare(l.token).catch(() => setMsg("Couldn't switch it off. Try again with signal."))
                    setLinks(myShares())
                  }}
                >
                  Switch off
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

const TEE: Record<string, string> = { fairway: 'FW', left: '←', right: '→', bunker: 'B', penalty: 'P' }
const APP: Record<string, string> = { green: 'G', short: 'S', long: 'L', left: '←', right: '→', bunker: 'B' }

export function CoachScreen({ token }: { token: string }) {
  const [rep, setRep] = useState<CoachReport | null | 'revoked' | undefined>(undefined)
  useEffect(() => {
    loadShare(token)
      .then(setRep)
      .catch(() => setRep(null))
  }, [token])

  if (rep === undefined) return <Wrap title="Loading report…" />
  if (rep === null) return <Wrap title="Report not found">Check the link and try again.</Wrap>
  if (rep === 'revoked') return <Wrap title="Link switched off">The player has switched this link off.</Wrap>
  return (
    <div className="screen">
      <header className="top">
        <div className="hello">
          <strong>{rep.player}</strong>
          <span>
            Handicap Index {rep.handicapIndex} · last {rep.rounds.length} rounds · shared {shortDate(rep.createdAt.slice(0, 10))}
          </span>
        </div>
      </header>
      <main className="pad stack">
        <Tiles s={rep.summary} stableford={rep.stableford} />
        <SgBars s={rep.summary} />
        <FocusList focus={rep.focus} />
        <PuttingTable s={rep.summary} />
        <section className="card">
          <div className="sechead">
            <h2>Approach misses</h2>
          </div>
          <table className="standings">
            <tbody>
              {Object.entries(rep.summary.approachMiss).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ textTransform: 'capitalize' }}>{k}</td>
                  <td className="val">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {rep.rounds.map((r, ri) => (
          <section className="card" key={ri}>
            <div className="sechead">
              <h2>{r.course}</h2>
              <span className="muted small">{shortDate(r.date)}</span>
            </div>
            <p className="muted small" style={{ margin: '4px 0 8px' }}>
              {r.gross} ({r.toPar >= 0 ? '+' : ''}
              {r.toPar}){r.holesPlayed < 18 ? ` over ${r.holesPlayed} holes` : ''} · {r.points} Stableford pts
            </p>
            <div className="gridwrap">
              <table className="grid">
                <tbody>
                  <tr className="muted">
                    <th>Hole</th>
                    {r.holes.map((_, i) => (
                      <th key={i}>{i + 1}</th>
                    ))}
                  </tr>
                  {(
                    [
                      ['Par', (h) => h.par],
                      ['Score', (h) => h.score ?? '–'],
                      ['Tee', (h) => (h.tee ? TEE[h.tee] : '')],
                      ['Appr', (h) => (h.approach ? APP[h.approach] : '')],
                      ['1st putt', (h) => h.firstPutt ?? ''],
                      ['Putts', (h) => h.putts ?? ''],
                    ] as [string, (h: CoachReport['rounds'][number]['holes'][number]) => string | number][]
                  ).map(([label, f]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      {r.holes.map((h, i) => (
                        <td key={i}>{f(h)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <p className="muted small">
          Tee: FW fairway, ← left, → right, B bunker, P penalty. Approach: G green, S short, L long, B bunker. Strokes gained are estimated from these taps, not
          shot tracking.
        </p>
      </main>
    </div>
  )
}

function Wrap({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="screen">
      <header className="top">
        <h1>{title}</h1>
      </header>
      <main className="pad">
        <p className="muted">{children}</p>
        <button className="secondary" onClick={() => go('')}>
          Open the app
        </button>
      </main>
    </div>
  )
}
