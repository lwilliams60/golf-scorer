import { useState } from 'react'
import { blankCourse } from '../data/courses'
import type { Course } from '../engine/types'

interface TeeRow {
  name: string
  cr: string
  slope: string
}

export function CourseEditor({ course, onSave, onCancel }: { course?: Course; onSave: (c: Course) => void; onCancel: () => void }) {
  const start = course ?? blankCourse('')
  const [name, setName] = useState(start.name)
  const [par, setPar] = useState(start.holes.map((h) => String(h.par_m)))
  const [si, setSi] = useState(start.holes.map((h) => String(h.si_m)))
  const [tees, setTees] = useState<TeeRow[]>(
    start.tees.map((t) => ({ name: t.name, cr: String(t.ratings.men?.cr ?? ''), slope: String(t.ratings.men?.slope ?? '') })),
  )
  const totalPar = par.reduce((s, p) => s + (Number(p) || 0), 0)
  const siSorted = [...si.map(Number)].sort((a, b) => a - b)
  const siOk = siSorted.every((v, i) => v === i + 1)
  const teesOk = tees.length > 0 && tees.every((t) => t.name.trim() && Number(t.cr) > 50 && Number(t.slope) >= 55 && Number(t.slope) <= 155)
  const valid = name.trim() && par.every((p) => Number(p) >= 3 && Number(p) <= 6) && siOk && teesOk

  function save() {
    onSave({
      id: start.id,
      name: name.trim(),
      holes: par.map((p, i) => ({ n: i + 1, par_m: Number(p), si_m: Number(si[i]), par_w: Number(p), si_w: Number(si[i]) })),
      tees: tees.map((t) => ({
        name: t.name.trim(),
        yards: par.map(() => 0),
        total: 0,
        ratings: { men: { par: totalPar, cr: Number(t.cr), slope: Number(t.slope) } },
      })),
    })
  }

  const cell = (arr: string[], set: (a: string[]) => void, i: number) => (
    <input
      inputMode="numeric"
      value={arr[i]}
      onChange={(e) => {
        const a = [...arr]
        a[i] = e.target.value
        set(a)
      }}
    />
  )

  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={onCancel}>
          ‹ Cancel
        </button>
        <h1>Add a course</h1>
      </header>
      <main className="pad">
        <p className="muted small">Copy these from the club's scorecard. It's saved on this phone and shared with everyone in the round.</p>
        <label className="field">
          Course name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Donnington Valley" />
        </label>
        <table className="holes-edit">
          <thead>
            <tr>
              <th>Hole</th>
              <th>Par</th>
              <th>SI</th>
            </tr>
          </thead>
          <tbody>
            {par.map((_, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{cell(par, setPar, i)}</td>
                <td>{cell(si, setSi, i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={`small ${siOk ? 'muted' : 'warn'}`}>
          Par {totalPar}. {siOk ? 'Stroke indexes look right.' : 'Each stroke index from 1 to 18 must be used once.'}
        </p>
        <h2>Tees</h2>
        {tees.map((t, i) => (
          <div className="prow" key={i}>
            <input className="pname" placeholder="Tee name" value={t.name} onChange={(e) => setTees(tees.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            <input className="pidx" placeholder="CR" inputMode="decimal" value={t.cr} onChange={(e) => setTees(tees.map((x, k) => (k === i ? { ...x, cr: e.target.value } : x)))} />
            <input className="pidx" placeholder="Slope" inputMode="numeric" value={t.slope} onChange={(e) => setTees(tees.map((x, k) => (k === i ? { ...x, slope: e.target.value } : x)))} />
            {tees.length > 1 && (
              <button className="x" onClick={() => setTees(tees.filter((_, k) => k !== i))}>
                ×
              </button>
            )}
          </div>
        ))}
        <button className="secondary" onClick={() => setTees([...tees, { name: '', cr: '', slope: '' }])}>
          + Add tee
        </button>
        <p className="muted small">CR is course rating (e.g. 69.3) and Slope is a number from 55 to 155 (e.g. 130). Both are on the card or the club's handicap table.</p>
        <button className="primary block" disabled={!valid} onClick={save}>
          Save course
        </button>
      </main>
    </div>
  )
}
