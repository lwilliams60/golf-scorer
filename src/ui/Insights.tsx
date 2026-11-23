import type { Focus, Summary } from '../engine/stats'
import { PUTT_BANDS } from '../engine/stats'

const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`)
const num = (x: number | null, d = 1) => (x == null ? '–' : x.toFixed(d))

export function Tiles({ s, stableford }: { s: Summary; stableford: number | null }) {
  const missSide =
    s.missRight != null && s.missRight >= 0.6
      ? { text: `${pct(s.missRight)} of misses right`, tone: 'bad' }
      : s.missLeft != null && s.missLeft >= 0.6
        ? { text: `${pct(s.missLeft)} of misses left`, tone: 'bad' }
        : { text: s.missLeft != null ? 'misses both sides' : 'par 4s and 5s', tone: '' }
  const tiles: [string, string, string, string?][] = [
    ['Scoring avg', num(s.scoringAvg), s.fullRounds ? `${s.fullRounds} full round${s.fullRounds > 1 ? 's' : ''}` : 'no full rounds yet'],
    ['Stableford avg', num(stableford), 'pts a round'],
    ['Fairways', pct(s.fairways), missSide.text, missSide.tone],
    ['Greens in reg', pct(s.gir), s.gir != null ? `${Math.round(s.gir * 18)} a round` : ''],
    ['Scrambling', pct(s.scrambling), 'up and downs'],
    ['Sand saves', pct(s.sandSaves), 'from bunkers', s.sandSaves != null && s.sandSaves < 0.3 ? 'bad' : ''],
    ['Putts', num(s.puttsPerRound), 'per round'],
    ['Putts per GIR', num(s.puttsPerGir, 2), 'when on in reg'],
    ['Three-putts', num(s.threePuttsPerRound), 'per round', (s.threePuttsPerRound ?? 0) >= 1.5 ? 'bad' : ''],
  ]
  return (
    <div className="tiles3">
      {tiles.map(([l, v, sub, tone]) => (
        <div className="t3" key={l}>
          <span className="l">{l}</span>
          <span className="v">{v}</span>
          <span className={`s ${tone ?? ''}`}>{sub}</span>
        </div>
      ))}
    </div>
  )
}

export function SgBars({ s }: { s: Summary }) {
  const rows: [string, number | null][] = [
    ['Off the tee', s.sg.tee],
    ['Approach', s.sg.approach],
    ['Around green', s.sg.around],
    ['Putting', s.sg.putting],
  ]
  const max = Math.max(3, ...rows.map(([, v]) => Math.abs(v ?? 0)))
  return (
    <section className="card">
      <div className="sechead">
        <h2>Strokes gained</h2>
      </div>
      <span className="muted small">Estimated, per round, against a scratch golfer</span>
      {rows.map(([label, v]) => {
        const w = v == null ? 0 : Math.min(50, (Math.abs(v) / max) * 50)
        const tone = v == null ? '' : v >= 0 ? 'good' : 'bad'
        return (
          <div className="sgrow" key={label}>
            <span>{label}</span>
            <div className="sgtrack">
              {v != null && (
                <div className="sgbar" style={{ left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? 'var(--accent)' : 'var(--bad)' }} />
              )}
            </div>
            <span className={`sgval ${tone}`}>{v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`}</span>
          </div>
        )
      })}
    </section>
  )
}

export function FocusList({ focus }: { focus: Focus[] }) {
  if (!focus.length) return null
  return (
    <section className="card">
      <div className="sechead">
        <h2>What to work on</h2>
      </div>
      <span className="muted small">Biggest strokes to gain first</span>
      {focus.map((f, i) => (
        <div className="focus" key={f.area}>
          <span className="n">{i + 1}</span>
          <div>
            <strong>{f.title}</strong>
            <span>{f.body}</span>
          </div>
        </div>
      ))}
    </section>
  )
}

export function PuttingTable({ s }: { s: Summary }) {
  if (!s.puttsByBand.some((b) => b.holes)) return null
  return (
    <section className="card">
      <div className="sechead">
        <h2>Putting by first-putt distance</h2>
      </div>
      <table className="standings">
        <tbody>
          {s.puttsByBand.map((b) => (
            <tr key={b.band}>
              <td>{PUTT_BANDS.find((x) => x.id === b.band)!.label}</td>
              <td className="muted small">{b.holes} holes</td>
              <td className="val">{b.avgPutts == null ? '–' : `${b.avgPutts.toFixed(2)} putts`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function money(v: number) {
  return `£${Math.abs(v).toFixed(2).replace(/\.00$/, '')}`
}

export function shortDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
