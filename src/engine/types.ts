export type Gender = 'm' | 'w'

export interface Hole {
  n: number
  par_m: number
  si_m: number
  par_w: number
  si_w: number
}

export interface TeeRating {
  par: number
  cr: number
  slope: number
}

export interface Tee {
  name: string
  yards: number[]
  total: number
  ratings: { men?: TeeRating; women?: TeeRating }
}

export interface Course {
  id: string
  name: string
  location?: string
  holes: Hole[]
  tees: Tee[]
}

export interface Player {
  id: string
  name: string
  handicapIndex: number
  gender: Gender
  tee: string
  /** Manual override of course handicap, if the group wants it. */
  courseHandicapOverride?: number
}

export type FairwayResult = 'hit' | 'left' | 'right' | 'na'
export type TeeResult = 'left' | 'fairway' | 'right' | 'bunker' | 'penalty'
export type ApproachResult = 'green' | 'short' | 'long' | 'left' | 'right' | 'bunker'
export type PuttBand = 'u3' | '3-10' | '10-20' | '20-40' | '40+'

export interface HoleStats {
  /** v2 quick entry */
  tee?: TeeResult
  approach?: ApproachResult
  firstPutt?: PuttBand
  putts?: number
  /** v1 fields, still read for older rounds */
  fairway?: FairwayResult
  gir?: boolean
  penalties?: number
  bunker?: boolean
}

/** Gross strokes per player per hole. null = not entered, 0 = picked up (no score). */
export type Scores = Record<string, (number | null)[]>
export type Stats = Record<string, HoleStats[]>

export interface WolfChoice {
  /** Partner chosen by the wolf, or null for Lone Wolf. */
  partner: string | null
}

export type GameType =
  | 'stroke'
  | 'stableford'
  | 'match'
  | 'betterBall'
  | 'skins'
  | 'nassau'
  | 'scramble'
  | 'sixPoint'
  | 'wolf'
  | 'snake'

export interface GameConfig {
  id: string
  type: GameType
  /** Player ids taking part (individual games), in tee order for Wolf. */
  players: string[]
  /** Teams of player ids (betterBall, scramble). */
  teams?: string[][]
  /** Handicap allowance, 0..1. */
  allowance: number
  /** Money per point / skin / bet / stroke. 0 = no money. */
  stake: number
  gross?: boolean
  /** Snake: amount added per three-putt. */
  snakeGrowth?: number
  /** Better ball: 'stableford' or 'match'. */
  betterBallMode?: 'stableford' | 'match'
  /** Six point split. */
  sixPointSplit?: '420' | '321'
}

export interface Round {
  id: string
  code: string
  name: string
  date: string
  course: Course
  players: Player[]
  groups: { id: string; players: string[]; scorer: string | null }[]
  games: GameConfig[]
  scores: Scores
  /** Scramble team scores keyed by team key (player ids joined by '+'). */
  teamScores: Scores
  stats: Stats
  wolf: Record<string, (WolfChoice | null)[]>
  createdBy: string
  updatedAt: number
}
