import { scoreGame, type GameResult } from './games'
import type { Round } from './types'

export interface Payment {
  from: string
  to: string
  amount: number
}

export function roundResults(r: Round): GameResult[] {
  return r.games.map((g) => scoreGame(r, g))
}

export function moneyTotals(results: GameResult[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const res of results) for (const [p, v] of Object.entries(res.money)) out[p] = (out[p] ?? 0) + v
  return out
}

/** Fewest payments that settle everyone up (greedy largest debtor to largest creditor). Amounts in pence-safe rounding. */
export function settle(totals: Record<string, number>): Payment[] {
  const pence = Object.entries(totals).map(([id, v]) => ({ id, v: Math.round(v * 100) }))
  const debtors = pence.filter((x) => x.v < 0).map((x) => ({ ...x, v: -x.v }))
  const creditors = pence.filter((x) => x.v > 0)
  const out: Payment[] = []
  debtors.sort((a, b) => b.v - a.v)
  creditors.sort((a, b) => b.v - a.v)
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v)
    if (amt > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: amt / 100 })
    debtors[i].v -= amt
    creditors[j].v -= amt
    if (debtors[i].v === 0) i++
    if (creditors[j].v === 0) j++
  }
  return out
}
