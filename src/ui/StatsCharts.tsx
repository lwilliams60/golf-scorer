import type { ReactNode } from 'react'
import type { Summary } from '../engine/stats'
import { APPROACH_BANDS, PUTT_BANDS } from '../engine/stats'
import type { StatsView, Tip } from '../engine/statsView'

const MONO = "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace"
const LIME = '#C9F27B'
const AMBER = '#F2C230'
const ORANGE = '#F29D52'
const RED = '#FF6B57'
const SAND = '#E8DCC0'
const DIM = '#9DB8A5'
const GRIDLINE = '#7FB48F'
const pc = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–')

/** A repeatable 0..1 value, so the dots don't jump about on every render. */
function jitter(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function TipBox({ tip, icon = '!' }: { tip: Tip | null; icon?: ReactNode }) {
  if (!tip) return null
  return (
    <div className="tip">
      <span className="tip-i" aria-hidden="true">{icon}</span>
      <div>
        <b>{tip.title}</b> {tip.body}
      </div>
    </div>
  )
}

function GridDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M16 0H0V16" fill="none" stroke="#1C4A30" strokeWidth="1" />
      </pattern>
    </defs>
  )
}

function Chip({ x, y, value, label, color, anchor = 'start' }: { x: number; y: number; value: string; label: string; color: string; anchor?: 'start' | 'end' }) {
  const w = 76
  const X = anchor === 'end' ? x - w : x
  return (
    <g>
      <rect x={X} y={y} width={w} height={40} rx={8} fill="#0D2A1A" stroke={color} strokeWidth={1} />
      <text x={X + 10} y={y + 19} fill={color} fontSize={16} fontWeight={700} fontFamily={MONO}>
        {value}
      </text>
      <text x={X + 10} y={y + 32} fill={DIM} fontSize={9} letterSpacing=".06em">
        {label}
      </text>
    </g>
  )
}

/** Top-down fairway with one dot per drive in the zone it finished. */
export function FairwayGraphic({ v, penaltiesPerRound }: { v: StatsView; penaltiesPerRound: number | null }) {
  const t = v.tee
  const fw = 'M128 300 C118 220 120 140 132 40 L194 40 C206 140 208 220 198 300Z'
  const dots = (n: number, xc: number, xs: number, color: string, seed: number) =>
    Array.from({ length: Math.min(n, 80) }, (_, i) => (
      <circle key={`${seed}-${i}`} cx={xc + (jitter(seed + i * 2) - 0.5) * xs} cy={84 + jitter(seed + i * 2 + 1) * 130} r={3.1} fill={color} stroke="#123823" strokeWidth={0.8} />
    ))
  const count = (n: number) => `${n} drive${n === 1 ? '' : 's'}`
  return (
    <div className="panel">
      <svg viewBox="0 0 326 300" role="img" aria-label={`Fairways ${pc(t.fairway, t.total)}, left ${pc(t.left, t.total)}, right ${pc(t.right, t.total)}`}>
        <GridDefs id="fwgrid" />
        <defs>
          <linearGradient id="fwfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2F7A45" />
            <stop offset="1" stopColor="#1F5C34" />
          </linearGradient>
          <clipPath id="fwclip">
            <path d={fw} />
          </clipPath>
        </defs>
        <rect width="326" height="300" fill="url(#fwgrid)" />
        <path d={fw} fill="url(#fwfill)" />
        <g clipPath="url(#fwclip)">
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={100} y={40 + i * 26} width={130} height={13} fill="#fff" opacity={0.05} />
          ))}
        </g>
        <path d={fw} fill="none" stroke={LIME} strokeWidth={1.2} opacity={0.8} />
        <line x1={163} y1={292} x2={163} y2={60} stroke="#fff" strokeDasharray="3 4" opacity={0.5} />
        <circle cx={163} cy={292} r={4} fill="#fff" />
        {dots(t.left, 72, 70, AMBER, 11)}
        {dots(t.fairway, 163, 52, LIME, 101)}
        {dots(t.right, 256, 60, ORANGE, 211)}
        {dots(t.penalty, 306, 14, RED, 311)}
        <g fontSize={10} textAnchor="middle" fontFamily={MONO}>
          <text x={72} y={236} fill={AMBER}>{count(t.left)}</text>
          <text x={163} y={236} fill={LIME}>{count(t.fairway)}</text>
          <text x={256} y={236} fill={ORANGE}>{count(t.right)}</text>
        </g>
        <Chip x={8} y={10} value={pc(t.left, t.total)} label="MISS LEFT" color={AMBER} />
        <Chip x={125} y={4} value={pc(t.fairway, t.total)} label="FAIRWAY" color={LIME} />
        <Chip x={318} y={10} value={pc(t.right, t.total)} label="MISS RIGHT" color={ORANGE} anchor="end" />
        <text x={318} y={290} fill={GRIDLINE} fontSize={9} fontFamily={MONO} textAnchor="end">
          PENALTIES {penaltiesPerRound == null ? '–' : penaltiesPerRound.toFixed(1)}/RD
        </text>
        {t.bunker > 0 && (
          <g>
            <path d="M14 268 C30 258 92 258 106 268 C118 280 96 294 60 294 C24 294 2 282 14 268Z" fill={SAND} opacity={0.9} />
            {Array.from({ length: Math.min(t.bunker, 24) }, (_, i) => (
              <circle key={`fb${i}`} cx={26 + jitter(600 + i) * 70} cy={266 + jitter(700 + i) * 20} r={2.8} fill="#8A7A55" stroke={SAND} strokeWidth={0.8} />
            ))}
            <text x={60} y={254} fill={SAND} fontSize={10} textAnchor="middle" fontFamily={MONO}>
              {t.bunker} in bunkers
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

/** Green from above with the miss zones around it, shaded by how often each one happens. */
export function GreenGraphic({ v, gir }: { v: StatsView; gir: number | null }) {
  const a = v.approach
  const missed = a.total - a.green
  const cx = 163
  const cy = 148
  const share = (n: number) => (missed ? n / missed : 0)
  const polar = (deg: number, r: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)]
  const sector = (a0: number, a1: number, n: number, key: string) => {
    const [x0, y0] = polar(a0, 124)
    const [x1, y1] = polar(a1, 124)
    const [x2, y2] = polar(a1, 78)
    const [x3, y3] = polar(a0, 78)
    return <path key={key} d={`M${x0} ${y0} A124 124 0 0 1 ${x1} ${y1} L${x2} ${y2} A78 78 0 0 0 ${x3} ${y3}Z`} fill={AMBER} opacity={0.06 + share(n) * 0.55} />
  }
  const ring = (n: number, a0: number, a1: number, r0: number, r1: number, color: string, seed: number) =>
    Array.from({ length: Math.min(n, 60) }, (_, i) => {
      const [x, y] = polar(a0 + jitter(seed + i * 2) * (a1 - a0), r0 + jitter(seed + i * 2 + 1) * (r1 - r0))
      return <circle key={`${seed}-${i}`} cx={x} cy={y} r={3} fill={color} stroke="#123823" strokeWidth={0.8} />
    })
  const tag = (x: number, y: number, n: number, label: string, anchor: 'start' | 'middle' | 'end') => (
    <g key={label}>
      <text x={x} y={y} fill="#fff" fontSize={15} fontWeight={700} textAnchor={anchor} fontFamily={MONO}>
        {pc(n, missed)}
      </text>
      <text x={x} y={y + 12} fill={DIM} fontSize={8.5} textAnchor={anchor} letterSpacing=".06em">
        {label}
      </text>
    </g>
  )
  return (
    <div className="panel">
      <svg viewBox="0 0 326 300" role="img" aria-label={`Greens in regulation ${gir == null ? 'not recorded' : `${Math.round(gir * 100)}%`}`}>
        <GridDefs id="grgrid" />
        <defs>
          <radialGradient id="grfill">
            <stop offset="0" stopColor="#3C9256" />
            <stop offset="1" stopColor="#25693C" />
          </radialGradient>
        </defs>
        <rect width="326" height="300" fill="url(#grgrid)" />
        {sector(45, 135, a.short, 's')}
        {sector(225, 315, a.long, 'l')}
        {sector(135, 225, a.left, 'lf')}
        {sector(-45, 45, a.right, 'r')}
        {[45, 135, 225, 315].map((d) => {
          const [x1, y1] = polar(d, 78)
          const [x2, y2] = polar(d, 124)
          return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GRIDLINE} strokeWidth={0.8} strokeDasharray="2 3" />
        })}
        <circle cx={cx} cy={cy} r={124} fill="none" stroke={GRIDLINE} strokeWidth={0.8} strokeDasharray="2 4" />
        <path d="M163 82 C210 80 236 112 232 150 C228 190 196 214 160 212 C120 210 92 186 94 148 C96 108 122 84 163 82Z" fill="url(#grfill)" stroke={LIME} strokeWidth={1.2} />
        {[0.8, 0.6, 0.4].map((k, i) => (
          <ellipse key={k} cx={cx + 24 * (1 - k)} cy={cy - 16 * (1 - k)} rx={68 * k} ry={62 * k} fill="none" stroke={LIME} strokeWidth={0.7} opacity={0.35 - i * 0.05} />
        ))}
        <path d="M238 196 C252 186 276 190 280 204 C284 218 258 226 244 220 C232 214 228 204 238 196Z" fill={SAND} opacity={0.9} />
        {ring(a.green, 0, 360, 24, 56, LIME, 7)}
        {ring(a.short, 55, 125, 86, 118, AMBER, 41)}
        {ring(a.long, 240, 300, 86, 110, AMBER, 83)}
        {ring(a.left, 150, 210, 86, 118, AMBER, 127)}
        {ring(a.right, -35, 35, 86, 110, AMBER, 163)}
        {Array.from({ length: Math.min(a.bunker, 12) }, (_, i) => (
          <circle key={`b${i}`} cx={248 + jitter(400 + i) * 24} cy={200 + jitter(500 + i) * 16} r={3} fill="#8A7A55" stroke={SAND} strokeWidth={0.8} />
        ))}
        <line x1={182} y1={150} x2={182} y2={122} stroke="#fff" strokeWidth={1.5} />
        <path d="M182 122 L196 127 L182 132Z" fill={AMBER} />
        <rect x={cx - 30} y={cy - 15} width={60} height={30} rx={8} fill="#0D2A1A" opacity={0.92} />
        <text x={cx} y={cy + 2} fill={LIME} fontSize={16} fontWeight={700} textAnchor="middle" fontFamily={MONO}>
          {gir == null ? '–' : `${Math.round(gir * 100)}%`}
        </text>
        <text x={cx} y={cy + 12} fill={DIM} fontSize={7.5} textAnchor="middle" letterSpacing=".08em">
          GIR
        </text>
        {tag(cx, 16, a.long, 'LONG', 'middle')}
        {tag(cx, 286, a.short, 'SHORT', 'middle')}
        {tag(8, 40, a.left, 'LEFT', 'start')}
        {tag(318, 40, a.right, 'RIGHT', 'end')}
        {tag(318, 276, a.bunker, 'BUNKER', 'end')}
      </svg>
    </div>
  )
}

/** Greens hit from each approach distance, as columns. */
export function DistanceBars({ s }: { s: Summary }) {
  const bands = APPROACH_BANDS.map((b) => {
    const x = s.approachByBand.find((y) => y.band === b.id)
    return { label: b.label.replace('Under 100', '<100'), shots: x?.shots ?? 0, rate: x && x.shots ? x.greens / x.shots : null }
  })
  if (!bands.some((b) => b.shots)) return <p className="muted small">Tap a distance when you log an approach and you'll see greens hit from each yardage here.</p>
  return (
    <div className="dbars">
      {bands.map((b) => (
        <div className="dbar" key={b.label}>
          <span className="dv">{b.rate == null ? '–' : `${Math.round(b.rate * 100)}%`}</span>
          <div className="dtrack">
            {b.rate != null && <i className={b.rate >= 0.5 ? 'hi' : b.rate >= 0.35 ? 'mid' : 'lo'} style={{ height: `${Math.max(4, b.rate * 100)}%` }} />}
          </div>
          <span className="dl">{b.label}</span>
          <span className="dn">{b.shots ? `${b.shots} shot${b.shots > 1 ? 's' : ''}` : ''}</span>
        </div>
      ))}
    </div>
  )
}

/** A percentage ring with a tick for the typical figure. */
export function Ring({ value, typical, good }: { value: number | null; typical: number; good: boolean | null }) {
  const r = 56
  const c = 2 * Math.PI * r
  const color = good == null ? 'var(--muted)' : good ? 'var(--accent)' : 'var(--down)'
  return (
    <svg viewBox="0 0 140 140" className="ring" aria-hidden="true">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#ECE5D3" strokeWidth="14" />
      {value != null && <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0.01, value) * c} ${c}`} transform="rotate(-90 70 70)" />}
      <line x1="70" y1="4" x2="70" y2="22" transform={`rotate(${typical * 360} 70 70)`} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <text x="70" y="78" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--ink)" fontFamily="var(--display)">
        {value == null ? '–' : `${Math.round(value * 100)}%`}
      </text>
    </svg>
  )
}

/** Average putts from each first-putt distance, laid out as rings around the hole. */
export function PuttingGraphic({ s }: { s: Summary }) {
  const xs = [280, 226, 168, 106, 44]
  const radii = [64, 120, 180, 244]
  return (
    <div className="panel">
      <svg viewBox="0 0 326 170" role="img" aria-label="Average putts from each first-putt distance">
        <GridDefs id="ptgrid" />
        <rect width="326" height="170" fill="url(#ptgrid)" />
        {radii.map((r) => (
          <circle key={r} cx={318} cy={85} r={r} fill="none" stroke={GRIDLINE} strokeWidth={0.9} strokeDasharray="2 4" />
        ))}
        <circle cx={318} cy={85} r={7} fill="#0D2A1A" stroke={LIME} strokeWidth={1.5} />
        {PUTT_BANDS.map((b, i) => {
          const x = s.puttsByBand.find((y) => y.band === b.id)
          const v = x?.avgPutts ?? null
          const color = v == null ? DIM : v >= 2.5 ? RED : v >= 2 ? AMBER : LIME
          return (
            <g key={b.id} textAnchor="middle">
              <text x={xs[i]} y={84} fill={color} fontSize={17} fontWeight={700} fontFamily={MONO}>
                {v == null ? '–' : v.toFixed(1)}
              </text>
              <text x={xs[i]} y={100} fill={DIM} fontSize={9} letterSpacing=".04em">
                {b.label.replace('Under 3 ft', '<3 FT').replace(' ft', ' FT')}
              </text>
              <text x={xs[i]} y={113} fill={GRIDLINE} fontSize={8.5} fontFamily={MONO}>
                {x?.holes ? `${x.holes} holes` : ''}
              </text>
            </g>
          )
        })}
        <text x={8} y={160} fill={GRIDLINE} fontSize={9} fontFamily={MONO}>
          AVG PUTTS BY FIRST-PUTT DISTANCE
        </text>
      </svg>
    </div>
  )
}

/** Score to par per full round, oldest to newest, with the typical figure as a dashed line. Up is better. */
export function TrendLine({ trend, typical }: { trend: { toPar: number }[]; typical: number }) {
  if (trend.length < 2) return null
  const pts = trend.slice(-12)
  const vals = [...pts.map((p) => p.toPar), typical]
  const lo = Math.min(...vals) - 1
  const hi = Math.max(...vals) + 1
  const W = 150
  const H = 56
  const y = (v: number) => ((v - lo) / (hi - lo)) * H
  const x = (i: number) => (i / (pts.length - 1)) * W
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="trend" aria-label="Score to par trend">
      <line x1={0} y1={y(typical)} x2={W} y2={y(typical)} stroke="#9CC47A" strokeDasharray="3 4" />
      <polyline points={pts.map((p, i) => `${x(i)},${y(p.toPar)}`).join(' ')} fill="none" stroke="#F6D452" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].toPar)} r={3.5} fill="#F6D452" />
      <text x={W} y={H + 14} textAnchor="end" fill="#D7E7CF" fontSize={10}>
        dashed: typical
      </text>
    </svg>
  )
}
