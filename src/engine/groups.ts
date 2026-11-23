import type { GameConfig, GameType } from './types'

/** How a game was set up, before it is laid out over the groups. */
export interface GameTemplate {
  type: GameType
  allowance: number
  stake: number
  gross?: boolean
  snakeGrowth?: number
  betterBallMode?: 'stableford' | 'match'
  /** Match play and Nassau: the two players. */
  pair?: [string, string]
}

export interface Group {
  id: string
  players: string[]
}

export interface Placeable {
  id: string
  /** Group chosen by the organiser. Overrides everything else. */
  group?: string
  /** When the player added themselves, for players the organiser did not place. */
  joined?: number
}

const groupNum = (id: string) => Number(/^g(\d+)$/.exec(id)?.[1] ?? 0)

/**
 * Works out every group from what is stored, so players can add themselves at the same time without overwriting each other.
 * Order of precedence: a group the organiser picked, then the groups set when the round was created,
 * then players who joined themselves, in the order they joined, filling groups up to `size`.
 */
export function placeGroups(setupGroups: Group[], players: Placeable[], size = 4): Group[] {
  const groups: Group[] = setupGroups.map((g) => ({ id: g.id, players: [] }))
  const find = (id: string) => groups.find((g) => g.id === id)
  const placed = new Set<string>()
  const add = (gid: string, pid: string) => {
    let g = find(gid)
    if (!g) {
      g = { id: gid, players: [] }
      groups.push(g)
    }
    g.players.push(pid)
    placed.add(pid)
  }
  const byId = new Map(players.map((p) => [p.id, p]))
  // Groups from setup keep their order, with any organiser moves applied.
  for (const g of setupGroups) for (const pid of g.players) {
    const p = byId.get(pid)
    if (p && !p.group) add(g.id, pid)
  }
  for (const p of players) if (p.group && !placed.has(p.id)) add(p.group, p.id)
  const nextId = () => `g${Math.max(0, ...groups.map((g) => groupNum(g.id))) + 1}`
  const joiners = players.filter((p) => !placed.has(p.id)).sort((a, b) => (a.joined ?? 0) - (b.joined ?? 0))
  for (const p of joiners) {
    const open = groups.find((g) => g.players.length < size)
    add(open ? open.id : nextId(), p.id)
  }
  return groups.filter((g) => g.players.length > 0).sort((a, b) => groupNum(a.id) - groupNum(b.id))
}

/** Lays each game out over the current groups. Group games (Wolf, Six Point, better ball) get one game per group that fits. */
export function expandGames(templates: GameTemplate[], groups: Group[]): GameConfig[] {
  const all = groups.flatMap((g) => g.players)
  const cfg: GameConfig[] = []
  for (const tp of templates) {
    const { type: t, pair, ...rest } = tp
    const b = { type: t, allowance: rest.allowance, stake: rest.stake, ...(rest.gross ? { gross: true } : {}) }
    if (t === 'stableford' || t === 'stroke' || t === 'skins') cfg.push({ id: t, players: all, ...b })
    else if (t === 'snake') cfg.push({ id: t, players: all, ...b, snakeGrowth: rest.snakeGrowth ?? 0 })
    else if (t === 'wolf') groups.filter((g) => g.players.length === 4).forEach((g) => cfg.push({ id: `wolf-${g.id}`, players: g.players, ...b }))
    else if (t === 'sixPoint') groups.filter((g) => g.players.length === 3).forEach((g) => cfg.push({ id: `six-${g.id}`, players: g.players, ...b, sixPointSplit: '420' }))
    else if (t === 'scramble') cfg.push({ id: t, players: all, teams: groups.map((g) => g.players), ...b })
    else if (t === 'betterBall') {
      if (rest.betterBallMode === 'match')
        groups
          .filter((g) => g.players.length === 4)
          .forEach((g) => cfg.push({ id: `bb-${g.id}`, players: g.players, teams: [g.players.slice(0, 2), g.players.slice(2)], betterBallMode: 'match', ...b }))
      else {
        const teams = groups.flatMap((g) => (g.players.length >= 2 ? [g.players.slice(0, 2), ...(g.players.length >= 4 ? [g.players.slice(2, 4)] : [])] : []))
        cfg.push({ id: 'bb', players: all, teams, betterBallMode: 'stableford', ...b })
      }
    } else if ((t === 'match' || t === 'nassau') && pair && all.includes(pair[0]) && all.includes(pair[1])) cfg.push({ id: t, players: [...pair], ...b })
  }
  return cfg
}
