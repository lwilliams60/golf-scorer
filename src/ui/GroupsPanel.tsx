import type { Round } from '../engine/types'
import { key } from '../store/round'
import type { StoredPlayer } from '../store/round'

const num = (id: string) => Number(/^g(\d+)$/.exec(id)?.[1] ?? 0)

/** Everyone in the round, by group. The organiser can move players between groups. */
export function GroupsPanel({
  round,
  me,
  set,
  onBack,
}: {
  round: Round
  me: string
  set: (k: string, v: unknown) => Promise<void>
  onBack: () => void
}) {
  const organiser = me === round.createdBy
  const newGroup = `g${Math.max(0, ...round.groups.map((g) => num(g.id))) + 1}`
  const started = round.players.some((p) => round.scores[p.id]?.some((s) => s != null))

  async function move(p: StoredPlayer, gid: string) {
    // Fix everyone else where they are first, so filling the gap doesn't shuffle the other groups.
    for (const g of round.groups)
      for (const pid of g.players) {
        const o = round.players.find((x) => x.id === pid) as StoredPlayer | undefined
        if (o && o.id !== p.id && o.group !== g.id) await set(key.player(o.id), { ...o, group: g.id })
      }
    await set(key.player(p.id), { ...p, group: gid })
  }

  return (
    <main className="pad groups">
      <button className="link" onClick={onBack}>
        ‹ Back to scorecard
      </button>
      <h2>
        {round.players.length} {round.players.length === 1 ? 'player' : 'players'} in {round.groups.length}{' '}
        {round.groups.length === 1 ? 'group' : 'groups'}
      </h2>
      <p className="muted small">
        Players who join with the code are put in the next group with a space, up to four a group.
        {organiser ? ' You set up this round, so you can move anyone.' : ' The organiser can move players between groups.'}
      </p>
      {organiser && started && <p className="warn small">Scores have started. Moving a player now changes the Wolf, Six Point and better ball games in both groups.</p>}
      {round.groups.map((g, gi) => (
        <section key={g.id} className="grp">
          <h3>
            Group {gi + 1} <span className="muted small">· {g.players.length} of 4</span>
          </h3>
          <ul className="grp-list">
            {g.players.map((pid) => {
              const p = round.players.find((x) => x.id === pid) as StoredPlayer | undefined
              if (!p) return null
              return (
                <li key={pid}>
                  <span className="grp-name">
                    <strong>{p.name}</strong>
                    {pid === me && <span className="you">You</span>}
                    <span className="muted small">
                      hcp {p.handicapIndex}
                      {!p.profileId ? ' · not joined yet' : ''}
                    </span>
                  </span>
                  {organiser && (
                    <select aria-label={`Move ${p.name}`} value={g.id} onChange={(e) => move(p, e.target.value)}>
                      {round.groups.map((o, oi) => (
                        <option key={o.id} value={o.id}>
                          Group {oi + 1}
                          {o.id !== g.id && o.players.length >= 4 ? ' (full)' : ''}
                        </option>
                      ))}
                      <option value={newGroup}>New group</option>
                    </select>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}
