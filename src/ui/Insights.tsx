import type { Focus, RoundFacts, Summary } from '../engine/stats'
import { APPROACH_BANDS, PUTT_BANDS } from '../engine/stats'

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

/** The five headline numbers for the home screen. */
export function KeyStats({ s }: { s: Summary }) {
  const tiles: [string, string, string][] = [
    ['Fairways', pct(s.fairways), 'hit off the tee'],
    ['Greens in reg', pct(s.gir), s.gir != null ? `${Math.round(s.gir * 18)} a round` : ''],
    ['Scrambling', pct(s.scrambling), 'up and downs'],
    ['Putts', num(s.puttsPerRound), 'per round'],
  ]
  return (
    <div className="keystats">
      <div className="t3 hero">
        <div className="hero-text">
          <span className="l">Scoring average</span>
          <span className="s">{s.fullRounds ? `Over ${s.fullRounds} full round${s.fullRounds > 1 ? 's' : ''}` : 'No full rounds yet'}</span>
        </div>
        <span className="v">{num(s.scoringAvg)}</span>
      </div>
      {tiles.map(([l, v, sub]) => (
        <div className="t3" key={l}>
          <span className="l">{l}</span>
          <span className="v">{v}</span>
          <span className="s">{sub}</span>
        </div>
      ))}
    </div>
  )
}

type Row = [label: string, value: string, note?: string, tone?: 'good' | 'bad' | '']

function Section({ title, sg, rows, children }: { title: string; sg?: number | null; rows: Row[]; children?: React.ReactNode }) {
  return (
    <section className="card statsec">
      <div className="sechead">
        <h2>{title}</h2>
        {sg != null && (
          <span className={`small ${sg >= 0 ? 'good' : 'bad'}`} title="Strokes gained per round against a scratch golfer">
            {sg > 0 ? '+' : sg < 0 ? '−' : ''}
            {Math.abs(sg).toFixed(1)} strokes gained
          </span>
        )}
      </div>
      <table className="standings">
        <tbody>
          {rows.map(([l, v, note, tone]) => (
            <tr key={l}>
              <td>
                {l}
                {note && <div className="muted small">{note}</div>}
              </td>
              <td className={`val ${tone ?? ''}`}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </section>
  )
}

/** The deeper dive: one section each for scoring, tee shots, approaches, short game and putting. */
export function StatSections({ s, rounds, stableford }: { s: Summary; rounds: RoundFacts[]; stableford: number | null }) {
  const holes = rounds.flatMap((r) => r.holes.filter((h) => h.score != null && h.score > 0))
  const n = holes.length
  const perRound = (k: number) => (n ? ((k / n) * 18).toFixed(1) : '–')
  const toPar = (h: (typeof holes)[number]) => h.score! - h.par
  const byPar = [3, 4, 5].map((par) => {
    const hs = holes.filter((h) => h.par === par)
    const avg = hs.length ? hs.reduce((a, h) => a + h.score!, 0) / hs.length : null
    return [`Par ${par}s`, avg == null ? '–' : avg.toFixed(2), avg == null ? `${hs.length} holes` : `${avg - par >= 0 ? '+' : ''}${(avg - par).toFixed(2)} a hole`] as Row
  })
  const best = rounds.filter((r) => r.holesPlayed === 18).sort((a, b) => a.gross - b.gross)[0]
  const m = s.approachMiss
  const misses = m.short + m.long + m.left + m.right + m.bunker
  const missPct = (k: number) => (misses ? `${Math.round((k / misses) * 100)}%` : '–')
  const share = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`)
  return (
    <>
      <Section
        title="Scoring"
        rows={[
          ['Scoring average', num(s.scoringAvg), s.fullRounds ? `${s.fullRounds} full round${s.fullRounds > 1 ? 's' : ''}` : 'no full rounds yet'],
          ['Stableford average', num(stableford), 'points a round'],
          ['Best round', best ? String(best.gross) : '–', best ? `${best.course}` : ''],
          ...byPar,
          ['Birdies or better', perRound(holes.filter((h) => toPar(h) <= -1).length), 'per round', 'good'],
          ['Pars', perRound(holes.filter((h) => toPar(h) === 0).length), 'per round'],
          ['Bogeys', perRound(holes.filter((h) => toPar(h) === 1).length), 'per round'],
          ['Double bogey or worse', perRound(holes.filter((h) => toPar(h) >= 2).length), 'per round', 'bad'],
        ]}
      />
      <Section
        title="Off the tee"
        sg={s.sg.tee}
        rows={[
          ['Fairways hit', share(s.fairways), 'par 4s and 5s'],
          ['Missed left', share(s.missLeft), 'of missed fairways'],
          ['Missed right', share(s.missRight), 'of missed fairways'],
          ['Penalties off the tee', num(s.teePenaltiesPerRound), 'per round', (s.teePenaltiesPerRound ?? 0) >= 1 ? 'bad' : ''],
        ]}
      />
      <Section
        title="Approach shots"
        sg={s.sg.approach}
        rows={[
          ['Greens in regulation', share(s.gir), s.gir != null ? `${Math.round(s.gir * 18)} a round` : ''],
          ['Missed short', missPct(m.short), 'of missed greens'],
          ['Missed long', missPct(m.long), 'of missed greens'],
          ['Missed left', missPct(m.left), 'of missed greens'],
          ['Missed right', missPct(m.right), 'of missed greens'],
          ['In a bunker', missPct(m.bunker), 'of missed greens'],
          ...(s.approachByBand ?? [])
            .filter((b) => b.shots)
            .map(
              (b) =>
                [
                  `From ${APPROACH_BANDS.find((x) => x.id === b.band)!.label.replace('Under', 'under')} yds`,
                  `${Math.round((b.greens / b.shots) * 100)}% greens`,
                  `${b.shots} shot${b.shots > 1 ? 's' : ''}${b.topMiss && b.greens < b.shots ? ` · misses mostly ${b.topMiss === 'bunker' ? 'in bunkers' : b.topMiss}` : ''}`,
                  b.greens / b.shots < 0.3 && b.shots >= 3 ? 'bad' : '',
                ] as Row,
            ),
        ]}
      />
      <Section
        title="Short game"
        sg={s.sg.around}
        rows={[
          ['Scrambling', share(s.scrambling), 'par or better after missing the green'],
          ['Sand saves', share(s.sandSaves), 'par or better from a greenside bunker', s.sandSaves != null && s.sandSaves < 0.3 ? 'bad' : ''],
        ]}
      />
      <Section
        title="Putting"
        sg={s.sg.putting}
        rows={[
          ['Putts', num(s.puttsPerRound), 'per round'],
          ['Putts per green in reg', num(s.puttsPerGir, 2), 'when you hit the green'],
          ['Three-putts', num(s.threePuttsPerRound), 'per round', (s.threePuttsPerRound ?? 0) >= 1.5 ? 'bad' : ''],
          ...s.puttsByBand
            .filter((b) => b.holes)
            .map((b) => [`From ${PUTT_BANDS.find((x) => x.id === b.band)!.label.replace(/^Under/, 'under')}`, b.avgPutts == null ? '–' : `${b.avgPutts.toFixed(2)} putts`, `${b.holes} holes`] as Row),
        ]}
      />
    </>
  )
}
