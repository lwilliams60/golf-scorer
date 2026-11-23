import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Entries = Record<string, unknown>
export type Listener = (k: string, v: unknown) => void

/** Where rounds are stored and synced. Every piece of a round is one key/value "entry". */
export interface Backend {
  kind: 'local' | 'supabase'
  load(code: string): Promise<Entries | null>
  upsert(code: string, k: string, v: unknown): Promise<void>
  subscribe(code: string, cb: Listener): () => void
  /** Round codes a profile has played in. */
  roundsFor(profileId: string): Promise<string[]>
}

// ---------- Local (single device, for testing without a server) ----------
const LS_PREFIX = 'golf:round:'

function readLocal(code: string): Entries | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + code)
    return raw ? (JSON.parse(raw) as Entries) : null
  } catch {
    return null
  }
}

function writeLocal(code: string, e: Entries) {
  try {
    localStorage.setItem(LS_PREFIX + code, JSON.stringify(e))
  } catch {
    /* storage full or blocked */
  }
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('golf-sync') : null

export const localBackend: Backend = {
  kind: 'local',
  async load(code) {
    return readLocal(code)
  },
  async upsert(code, k, v) {
    const e = readLocal(code) ?? {}
    e[k] = v
    writeLocal(code, e)
    channel?.postMessage({ code, k, v })
  },
  subscribe(code, cb) {
    if (!channel) return () => {}
    const h = (ev: MessageEvent) => {
      if (ev.data?.code === code) cb(ev.data.k, ev.data.v)
    }
    channel.addEventListener('message', h)
    return () => channel.removeEventListener('message', h)
  },
  async roundsFor(profileId) {
    const out: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(LS_PREFIX)) continue
      const e = readLocal(key.slice(LS_PREFIX.length))
      if (e && Object.entries(e).some(([k, v]) => k.startsWith('p|') && (v as { profileId?: string })?.profileId === profileId))
        out.push(key.slice(LS_PREFIX.length))
    }
    return out
  },
}

// ---------- Supabase (live sync between phones) ----------
function supabaseBackend(sb: SupabaseClient): Backend {
  return {
    kind: 'supabase',
    async load(code) {
      const { data, error } = await sb.from('entries').select('k,v').eq('code', code)
      if (error) throw error
      if (!data || data.length === 0) return null
      return Object.fromEntries(data.map((r) => [r.k, r.v]))
    },
    async upsert(code, k, v) {
      const { error } = await sb.from('entries').upsert({ code, k, v, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    subscribe(code, cb) {
      const ch = sb
        .channel(`round-${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `code=eq.${code}` }, (payload) => {
          const row = payload.new as { k?: string; v?: unknown }
          if (row?.k) cb(row.k, row.v)
        })
        .subscribe()
      return () => {
        sb.removeChannel(ch)
      }
    },
    async roundsFor(profileId) {
      const { data, error } = await sb.from('entries').select('code').like('k', 'p|%').eq('v->>profileId', profileId)
      if (error) throw error
      return [...new Set((data ?? []).map((r) => r.code as string))]
    },
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const backend: Backend = url && key ? supabaseBackend(createClient(url, key)) : localBackend
