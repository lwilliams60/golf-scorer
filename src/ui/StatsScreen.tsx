import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { go } from '../nav'
import type { Profile } from '../store/profile'
import { loadMyRounds, SNAPSHOT, type MyRound } from '../store/history'
import { benchmarkGaps, focusAreas, summarise, type Summary } from '../engine/stats'
import { approachTip, puttingTip, shortGameTip, statsView, teeTip, type StatsView, type Tip } from '../engine/statsView'
import { benchmarkFor, hcpLabel, playsLike, playsLikeLabel } from '../data/benchmarks'
import { shortDate } from './Insights'
import { ShareWithCoach } from './CoachShare'
import { CardIcon, ChipIcon, FlagIcon, PuttIcon, TeeIcon } from './GolfIcons'
import { DistanceBars, FairwayGraphic, GreenGraphic, PuttingGraphic, Ring, TipBox, TrendLine } from './StatsCharts'

type Tab = 'overview' | 'tee' | 'approach' | 'short' | 'putting'
const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['tee', 'Off the tee'],
  ['approach', 'Approach'],
  ['short', 'Short game'],
  ['putting', 'Putting'],
]
const RANGES = [6, 10, 20, 0] as const

const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`)
const signed = (x: number | null, d = 1) => (x == null ? '–' : `${x > 0.04 ? '+' : x < -0.04 ? '−' : ''}${Math.abs(x).toFixed(d)}`)

type Tone = 'good' | 'bad' | ''
function tone(mine: number | null, theirs: number, lowerIsBetter = false): Tone {
  if (mine == null) return ''
  if (Math.abs(mine - theirs) < (lowerIsBetter ? 0.5 : 0.03)) return ''
  return (lowerIsBetter ? mine < theirs : mine > theirs) ? 'good' : 'bad'
}

function LevelPill({ stat, mine, t }: { stat: 'gir' | 'scrambling' | 'sandSaves' | 'putts'; mine: number | null; t: Tone }) {
  if (mine == null) return null
  return <span className={`lpill ${t}`}>{t ? `${t === 'good' ? '▲' : '▼'} Like ${playsLikeLabel(playsLike(stat, mine))}` : 'On your level'}</span>
}

function Mini({ label, value, sub, tone: t = '' }: { label: string; value: string; sub: string; tone?: Tone }) {
  return (
    <div className={`mini ${t}`}>
      <span className="l">{label}</span>
      <span className="v">{value}</span>
      <span className="l">{sub}</span>
    </div>
  )
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="legend">
      {items.map(([c, l]) => (
        <span key={l}>
          <i style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="muted small" style={{ margin: '8px 0 0' }}>{children}</p>
}

export function StatsScreen({ profile }: { profile: Profile }) {
  const [mine, setMine] = useState<MyRound[] | null>(null)
  const [range, setRange] = useState<(typeof RANGES)[number]>(SNAPSHOT)
  const [tab, setTab] = useState<Tab>('overview')
  useEffect(() => {
    loadMyRounds(profile).then(setMine)
  }, [profile])
  const list = useMemo(() => (range ? (mine ?? []).slice(0, range) : (mine ?? [])), [mine, range])
  const facts = useMemo(() => list.map((m) => m.facts), [list])
  const s = useMemo(() => summarise(facts), [facts])
  const v = useMemo(() => statsView(facts), [facts])
  const index = profile.handicapIndex
  const pick = (t: Tab) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={() => go('')}>
          ‹ Back
        </button>
        <h1>My stats</h1>
      </header>
      {mine && mine.length > 0 && (
        <div className="stabs-wrap">
          <nav className="stabs" aria-label="Stats sections">
            {TABS.map(([id, label]) => (
              <button key={id} className={tab === id ? 'on' : ''} aria-pressed={tab === id} onClick={() => pick(id)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="srange">
            <label>
              <select value={range} onChange={(e) => setRange(Number(e.target.value) as (typeof RANGES)[number])}>
                {RANGES.map((r) => (
                  <option key={r} value={r}>
                    {r ? `Last ${r} rounds` : 'All rounds'}
                  </option>
                ))}
              </select>
            </label>
            <span>vs typical {hcpLabel(index)}</span>
          </div>
        </div>
      )}
      <main className="pad stack">
        {!mine && <p className="muted">Loading…</p>}
        {mine && mine.length === 0 && <p className="muted">Play a round and your stats will appear here.</p>}
        {mine && mine.length > 0 && (
          <>
            {tab === 'overview' && <Overview s={s} v={v} index={index} list={list} profile={profile} mine={mine} />}
            {tab === 'tee' && <TeeTab s={s} v={v} index={index} />}
            {tab === 'approach' && <ApproachTab s={s} v={v} index={index} />}
            {tab === 'short' && <ShortTab s={s} v={v} index={index} />}
            {tab === 'putting' && <PuttingTab s={s} index={index} />}
          </>
        )}
      </main>
    </div>
  )
}

function Overview({ s, v, index, list, profile, mine }: { s: Summary; v: StatsView; index: number; list: MyRound[]; profile: Profile; mine: MyRound[] }) {
  const b = benchmarkFor(index)
  const gaps = benchmarkGaps(s, index)
  const heroTone = tone(s.toParAvg, b.toPar, true)
  const rows: [string, ReactNode, number | null][] = [
    ['Off the tee', <TeeIcon />, gaps.tee == null ? null : -gaps.tee],
    ['Approach', <FlagIcon />, gaps.approach == null ? null : -gaps.approach],
    ['Short game', <ChipIcon />, gaps.around == null ? null : -gaps.around],
    ['Putting', <PuttIcon />, gaps.putting == null ? null : -gaps.putting],
  ]
  const max = Math.max(1.5, ...rows.map(([, , x]) => Math.abs(x ?? 0)))
  const top = focusAreas(s, index)[0]
  const tip: Tip | null = top
    ? { title: `${top.title}.`, body: top.body }
    : rows.some(([, , x]) => x != null)
      ? { title: 'No weak spots against your handicap.', body: `You're level with or ahead of a typical ${hcpLabel(index)} everywhere.` }
      : null
  const f = v.finish
  const per = (n: number) => (f.holes ? (n / f.holes) * 18 : 0)
  const seg: [string, string, number][] = [
    ['Birdies', 'fin-birdie', per(f.birdies)],
    ['Pars', 'fin-par', per(f.pars)],
    ['Bogeys', 'fin-bogey', per(f.bogeys)],
    ['Doubles+', 'fin-double', per(f.doubles)],
  ]
  return (
    <>
      <section className="card shero">
        <div className="shero-row">
          <div>
            <span className="l">
              <CardIcon /> Scoring average
            </span>
            <span className="big">{s.scoringAvg == null ? '–' : s.scoringAvg.toFixed(1)}</span>
          </div>
          <TrendLine trend={v.trend} typical={b.toPar} />
        </div>
        <div className="shero-foot">
          {s.toParAvg != null && (
            <span className={`ribbon ${heroTone}`}>
              {heroTone === 'good' ? '★ ' : ''}Scoring like {playsLikeLabel(playsLike('toPar', s.toParAvg))}
            </span>
          )}
          <span className="s">
            {s.toParAvg == null ? 'No full rounds yet' : `${signed(s.toParAvg)} to par · typical ${signed(b.toPar)}`}
            {v.best ? ` · best ${v.best.gross}` : ''}
          </span>
        </div>
      </section>

      <section className="card">
        <h2 className="ct">Where you gain and lose shots</h2>
        <p className="cs">Shots a round against a typical {hcpLabel(index)}</p>
        <div className="gl">
          {rows.map(([label, icon, x]) => {
            const w = x == null ? 0 : (Math.abs(x) / max) * 50
            return (
              <div className="gl-row" key={label}>
                <span className="gl-l">
                  <span className="gl-i">{icon}</span>
                  {label}
                </span>
                <div className="gl-track">
                  {x != null && <i className={x >= 0 ? 'up' : 'dn'} style={x >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />}
                </div>
                <span className={`gl-v ${x == null ? '' : x >= 0 ? 'good' : 'bad'}`}>{x == null ? '–' : signed(x)}</span>
              </div>
            )
          })}
          <div className="gl-axis">
            <span>◀ losing</span>
            <span>gaining ▶</span>
          </div>
        </div>
        <TipBox tip={tip} />
      </section>

      <section className="card">
        <h2 className="ct">How your holes finish</h2>
        <p className="cs">Average per round</p>
        {f.holes ? (
          <>
            <div className="finish">
              {seg.map(([l, cls, n]) => (n >= 0.05 ? <div key={l} className={cls} style={{ flex: n }}>{n >= 0.8 ? n.toFixed(1) : ''}</div> : null))}
            </div>
            <div className="finish-key">
              {seg.map(([l, cls, n]) => (
                <span key={l}>
                  <i className={cls} />
                  {l} {n.toFixed(1)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <Empty>No scores yet.</Empty>
        )}
        <div className="minis">
          {v.byPar.map((p) => (
            <Mini
              key={p.par}
              label={`Par ${p.par}s`}
              value={p.avg == null ? '–' : p.avg.toFixed(1)}
              sub={p.avg == null ? 'none yet' : `${signed(p.avg - p.par, 2)} a hole`}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="ct">Rounds</h2>
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
      <ShareWithCoach profile={profile} mine={mine} />
    </>
  )
}

function TeeTab({ s, v, index }: { s: Summary; v: StatsView; index: number }) {
  const b = benchmarkFor(index)
  const t = tone(s.fairways, b.fairways)
  const gap = benchmarkGaps(s, index).tee
  const diff = s.fairways == null ? 0 : Math.round(Math.abs(s.fairways - b.fairways) * 100)
  return (
    <section className="card">
      <div className="chead">
        <div>
          <h2 className="ct">Where your drives finish</h2>
          <p className="cs">Par 4s and 5s · {v.tee.total} drive{v.tee.total === 1 ? '' : 's'}</p>
        </div>
        {s.fairways != null && <span className={`lpill ${t}`}>{t ? `${t === 'good' ? '▲' : '▼'} ${diff}% ${t === 'good' ? 'over' : 'under'}` : 'On your level'}</span>}
      </div>
      {v.tee.total ? (
        <>
          <FairwayGraphic v={v} penaltiesPerRound={s.teePenaltiesPerRound} />
          <Legend items={[['#C9F27B', 'Fairway'], ['#F2C230', 'Left'], ['#F29D52', 'Right'], ['#E8DCC0', 'Bunker'], ['#FF6B57', 'Penalty']]} />
        </>
      ) : (
        <Empty>Tap where each tee shot finished during a round and your drives will show up here.</Empty>
      )}
      <TipBox tip={teeTip(v, s, index)} icon="↗" />
      <div className="minis">
        <Mini label="Penalties" value={s.teePenaltiesPerRound == null ? '–' : s.teePenaltiesPerRound.toFixed(1)} sub="a round" />
        <Mini label="Tee shots" value={signed(gap == null ? null : -gap)} sub="shots vs typical" tone={gap == null ? '' : gap <= 0 ? 'good' : 'bad'} />
        <Mini label={`Typical ${hcpLabel(index)}`} value={pct(b.fairways)} sub="fairways" />
      </div>
    </section>
  )
}

function ApproachTab({ s, v, index }: { s: Summary; v: StatsView; index: number }) {
  const b = benchmarkFor(index)
  const gap = benchmarkGaps(s, index).approach
  return (
    <section className="card">
      <div className="chead">
        <div>
          <h2 className="ct">Where your approaches finish</h2>
          <p className="cs">
            {v.approach.total} approach{v.approach.total === 1 ? '' : 'es'} · typical {hcpLabel(index)} hits {pct(b.gir)}
          </p>
        </div>
        <LevelPill stat="gir" mine={s.gir} t={tone(s.gir, b.gir)} />
      </div>
      {v.approach.total ? (
        <>
          <GreenGraphic v={v} gir={s.gir} />
          <Legend items={[['#C9F27B', 'On the green'], ['#F2C230', 'Missed'], ['#E8DCC0', 'Bunker']]} />
        </>
      ) : (
        <Empty>Tap where each approach finished during a round and they'll show up here.</Empty>
      )}
      <h3 className="csub">Greens hit by distance</h3>
      <DistanceBars s={s} />
      <TipBox tip={approachTip(v, s, index)} icon="⛳" />
      <div className="minis">
        <Mini label="Greens a round" value={s.gir == null ? '–' : (s.gir * 18).toFixed(1)} sub="of 18" />
        <Mini label="Approach" value={signed(gap == null ? null : -gap)} sub="shots vs typical" tone={gap == null ? '' : gap <= 0 ? 'good' : 'bad'} />
        <Mini label={`Typical ${hcpLabel(index)}`} value={pct(b.gir)} sub="greens" />
      </div>
    </section>
  )
}

function ShortTab({ s, v, index }: { s: Summary; v: StatsView; index: number }) {
  const b = benchmarkFor(index)
  const gap = benchmarkGaps(s, index).around
  const scT = tone(s.scrambling, b.scrambling)
  const sdT = tone(s.sandSaves, b.sandSaves)
  return (
    <section className="card">
      <h2 className="ct">Getting up and down</h2>
      <p className="cs">After missing the green</p>
      <div className="rings">
        <div>
          <Ring value={s.scrambling} typical={b.scrambling} good={scT === '' ? null : scT === 'good'} />
          <strong>Scrambling</strong>
          <span className="muted small">
            {v.scramble.saved} of {v.scramble.chances} · typical {pct(b.scrambling)}
          </span>
          {v.scramble.chances >= 3 && <LevelPill stat="scrambling" mine={s.scrambling} t={scT} />}
        </div>
        <div>
          <Ring value={s.sandSaves} typical={b.sandSaves} good={sdT === '' ? null : sdT === 'good'} />
          <strong>Sand saves</strong>
          <span className="muted small">
            {v.sand.saved} of {v.sand.chances} · typical {pct(b.sandSaves)}
          </span>
          {v.sand.chances >= 3 ? <LevelPill stat="sandSaves" mine={s.sandSaves} t={sdT} /> : <span className="muted small">Needs 3 bunker shots</span>}
        </div>
      </div>
      <p className="muted small" style={{ margin: '4px 0 0', textAlign: 'center' }}>
        The black tick on each ring marks a typical {hcpLabel(index)}.
      </p>
      <TipBox tip={shortGameTip(v, index)} icon="✦" />
      <div className="minis two">
        <Mini label="Short game" value={signed(gap == null ? null : -gap)} sub="shots vs typical" tone={gap == null ? '' : gap <= 0 ? 'good' : 'bad'} />
        <Mini label="Missed greens" value={s.gir == null ? '–' : ((1 - s.gir) * 18).toFixed(1)} sub="a round" />
      </div>
    </section>
  )
}

function PuttingTab({ s, index }: { s: Summary; index: number }) {
  const b = benchmarkFor(index)
  const gap = benchmarkGaps(s, index).putting
  const t = tone(s.puttsPerRound, b.putts, true)
  return (
    <section className="card">
      <div className="chead">
        <div>
          <h2 className="ct">Putts a round</h2>
          <p className="cs">Typical {hcpLabel(index)}: {b.putts.toFixed(1)}</p>
        </div>
        <div className="chead-r">
          <span className="bignum">{s.puttsPerRound == null ? '–' : s.puttsPerRound.toFixed(1)}</span>
          <LevelPill stat="putts" mine={s.puttsPerRound} t={t} />
        </div>
      </div>
      <h3 className="csub">Average putts from each first-putt distance</h3>
      {s.puttsByBand.some((x) => x.holes) ? <PuttingGraphic s={s} /> : <Empty>Tap roughly how far your first putt was and you'll see this fill in.</Empty>}
      <div className="minis">
        <Mini label="Three-putts" value={s.threePuttsPerRound == null ? '–' : s.threePuttsPerRound.toFixed(1)} sub="a round" tone={(s.threePuttsPerRound ?? 0) >= 1.5 ? 'bad' : ''} />
        <Mini label="Putts per GIR" value={s.puttsPerGir == null ? '–' : s.puttsPerGir.toFixed(1)} sub="greens hit" />
        <Mini label="Putting" value={signed(gap == null ? null : -gap)} sub="shots vs typical" tone={gap == null ? '' : gap <= 0 ? 'good' : 'bad'} />
      </div>
      <TipBox tip={puttingTip(s, index)} icon="◎" />
    </section>
  )
}
