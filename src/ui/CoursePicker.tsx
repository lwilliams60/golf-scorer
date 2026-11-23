import { useEffect, useRef, useState } from 'react'
import { fetchUkClub, searchUk, type UkClub } from '../data/courses'
import { teeLabel } from '../engine/handicap'
import type { Course } from '../engine/types'

/** Search box over the shared course library, with a fallback search of every UK club. */
export function CoursePicker({
  courses,
  selected,
  onPick,
  onCheck,
  onAddByHand,
}: {
  courses: Course[]
  selected?: Course
  onPick: (c: Course) => void
  /** A course fetched from the UK database, to review before it's saved. */
  onCheck: (c: Course) => void
  onAddByHand: () => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(!selected)
  const [clubs, setClubs] = useState<UkClub[] | null>(null)
  const [choices, setChoices] = useState<Course[] | null>(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [searching, setSearching] = useState(false)
  const cache = useRef(new Map<string, UkClub[]>())
  const term = q.trim().toLowerCase()
  // Nothing is listed until you start typing; saved courses match instantly.
  const matches = term ? courses.filter((c) => `${c.name} ${c.location ?? ''}`.toLowerCase().includes(term)).slice(0, 6) : []
  const saved = new Set(courses.map((c) => norm(c.name)))
  const ukClubs = (clubs ?? []).filter((c) => !saved.has(norm(c.name)))

  // Search every UK club as you type, once you pause for a moment (each search uses one request of the plan).
  useEffect(() => {
    if (term.length < 3) {
      setClubs(null)
      setSearching(false)
      return
    }
    const hit = cache.current.get(term)
    if (hit) {
      setClubs(hit)
      setSearching(false)
      return
    }
    setSearching(true)
    let live = true
    const t = setTimeout(async () => {
      try {
        const found = await searchUk(term)
        cache.current.set(term, found)
        if (live) setClubs(found)
      } catch (e) {
        if (live) setErr((e as Error).message)
      }
      if (live) setSearching(false)
    }, 600)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [term])

  async function pickClub(c: UkClub) {
    setBusy(c.id)
    setErr('')
    try {
      const { courses: found } = await fetchUkClub(c.id)
      if (!found.length) setErr(`${c.name} has no full scorecard in the UK database yet. You can add it by hand from the club's card.`)
      else if (found.length === 1) onCheck(found[0])
      else setChoices(found)
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy('')
  }

  if (!open && selected)
    return (
      <button className="rrow" onClick={() => setOpen(true)}>
        <span>
          <strong>{selected.name}</strong>
          <span className="muted small">{selected.location ?? `${selected.tees.length} tees`}</span>
        </span>
        <span className="small" style={{ color: 'var(--accent)' }}>
          Change
        </span>
      </button>
    )

  return (
    <div className="stack" style={{ gap: 8 }}>
      <input
        type="search"
        value={q}
        placeholder="Search for a course"
        autoComplete="off"
        autoCorrect="off"
        aria-label="Search courses"
        onChange={(e) => {
          setQ(e.target.value)
          setChoices(null)
          setErr('')
        }}
      />
      {matches.map((c) => (
        <button
          key={c.id}
          className="rrow"
          style={c.id === selected?.id ? { borderColor: 'var(--accent)' } : undefined}
          onClick={() => {
            onPick(c)
            setOpen(false)
            setQ('')
          }}
        >
          <span>
            <strong>{c.name}</strong>
            <span className="muted small">{c.location ?? `${c.tees.length} tees`}</span>
          </span>
        </button>
      ))}
      {term && term.length < 3 && matches.length === 0 && <p className="muted small">Keep typing to search all UK courses…</p>}
      {searching && <p className="muted small">Searching UK courses…</p>}
      {!searching && clubs && matches.length === 0 && ukClubs.length === 0 && (
        <p className="muted small">No UK clubs found for "{q.trim()}". Try part of the name, like "Croham" or "Hurst".</p>
      )}
      {!choices &&
        ukClubs.map((c) => (
          <button key={c.id} className="rrow" disabled={!!busy} onClick={() => pickClub(c)}>
            <span>
              <strong>{c.name}</strong>
              <span className="muted small">{c.place}</span>
            </span>
            <span className="small" style={{ color: 'var(--accent)' }}>
              {busy === c.id ? 'Loading…' : 'Add'}
            </span>
          </button>
        ))}
      {choices && (
        <>
          <p className="muted small">This club has more than one course. Which one?</p>
          {choices.map((c) => (
            <button key={c.id} className="rrow" onClick={() => onCheck(c)}>
              <span>
                <strong>{c.name}</strong>
                <span className="muted small">{c.tees.map((t) => t.name).join(', ')}</span>
              </span>
            </button>
          ))}
        </>
      )}
      {err && <p className="warn small">{err}</p>}
      <button className="link" style={{ color: 'var(--accent)', textAlign: 'left' }} onClick={onAddByHand}>
        + Add a course by hand
      </button>
    </div>
  )
}

/** Shows a course from the UK database so the player can check it against the club's card before saving. */
export function CourseReview({ course, onUse, onFix, onCancel }: { course: Course; onUse: () => void; onFix: () => void; onCancel: () => void }) {
  const front = course.holes.slice(0, 9)
  const back = course.holes.slice(9)
  const womenDiffer = course.holes.some((h) => h.par_w !== h.par_m || h.si_w !== h.si_m)
  const row = (label: string, hs: Course['holes'], f: (h: Course['holes'][number]) => number) => (
    <tr>
      <th>{label}</th>
      {hs.map((h) => (
        <td key={h.n}>{f(h)}</td>
      ))}
    </tr>
  )
  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={onCancel}>
          ‹ Back
        </button>
        <h1>Check the card</h1>
      </header>
      <main className="pad stack">
        <p className="muted" style={{ margin: 0 }}>
          This came from the UK course database. Give it a quick check against the club's scorecard, especially the stroke indexes, because they decide where
          handicap strokes fall.
        </p>
        <section className="card">
          <div className="sechead">
            <h2>{course.name}</h2>
          </div>
          {course.location && <span className="muted small">{course.location}</span>}
          <ul className="payments" style={{ marginTop: 8 }}>
            {course.tees.flatMap((t) =>
              (['m', 'w'] as const)
                .filter((g) => (g === 'm' ? t.ratings.men : t.ratings.women))
                .map((g) => {
                  const r = g === 'm' ? t.ratings.men! : t.ratings.women!
                  return (
                    <li key={t.name + g}>
                      <span>{teeLabel(t, g).replace(' · ', ` ${g === 'm' ? "Men's" : "Women's"} · `)}</span>
                      <span className="muted small" style={{ marginLeft: 'auto' }}>
                        CR {r.cr} · Slope {r.slope}
                      </span>
                    </li>
                  )
                }),
            )}
          </ul>
        </section>
        {[front, back].map((hs, k) => (
          <section className="card" key={k}>
            <div className="gridwrap">
              <table className="grid">
                <tbody>
                  {row('Hole', hs, (h) => h.n)}
                  {row('Par', hs, (h) => h.par_m)}
                  {row('SI', hs, (h) => h.si_m)}
                  {womenDiffer && row("Women's par", hs, (h) => h.par_w)}
                  {womenDiffer && row("Women's SI", hs, (h) => h.si_w)}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <button className="primary" onClick={onUse}>
          Looks right, use this course
        </button>
        <button className="secondary" onClick={onFix}>
          Fix something first
        </button>
        <p className="muted small">Once saved, it's in the app for everyone, so nobody has to look it up again.</p>
      </main>
    </div>
  )
}

/** Club names compared without case, punctuation or "golf club" wording. */
function norm(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(golf|club|country|g\.?c\.?)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}
