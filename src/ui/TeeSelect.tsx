import type { Course, Gender } from '../engine/types'
import { teeLabel } from '../engine/handicap'

/** One list with every tee colour for men and women, each with par and yardage. Picking one sets tee and card. */
export function TeeSelect({ course, tee, gender, onChange }: { course: Course; tee: string; gender: Gender; onChange: (tee: string, gender: Gender) => void }) {
  const groups: [Gender, string][] = [
    ['m', "Men's"],
    ['w', "Women's"],
  ]
  return (
    <select
      aria-label="Tees"
      value={`${tee}|${gender}`}
      onChange={(e) => {
        const [t, g] = e.target.value.split('|')
        onChange(t, g as Gender)
      }}
    >
      {groups.map(([g, label]) => {
        const tees = course.tees.filter((t) => (g === 'm' ? t.ratings.men : t.ratings.women))
        if (!tees.length) return null
        return (
          <optgroup key={g} label={`${label} tees`}>
            {tees.map((t) => (
              <option key={t.name} value={`${t.name}|${g}`}>
                {teeLabel(t, g).replace(" yds", "y").replace(' · ', ` ${label} · `)}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}
