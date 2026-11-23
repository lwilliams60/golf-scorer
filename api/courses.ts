// Vercel serverless function: searches the UK Golf API and turns a club into our Course format.
// The API key stays here on the server (GOLF_API_KEY), never in the app.

import { toCourse, type J } from '../src/data/ukgolf.js'

const HOST = 'uk-golf-course-data-api.p.rapidapi.com'
const BASES = [`https://${HOST}`, 'https://uk-golf-api.vercel.app']

async function call(path: string): Promise<J> {
  const key = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.GOLF_API_KEY
  if (!key) throw new Error('GOLF_API_KEY is not set in Vercel')
  let last = ''
  for (const base of BASES) {
    const r = await fetch(base + path, { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST } })
    if (r.ok) return unwrap(await r.json())
    last = `${r.status} ${await r.text().catch(() => '')}`.slice(0, 200)
    if (r.status === 429) break
  }
  throw new Error(`Golf API error: ${last}`)
}

function unwrap(j: J): J {
  if (j && typeof j === 'object' && !Array.isArray(j) && 'data' in j && !('id' in j) && !('clubs' in j)) return j.data
  return j
}

async function teeSetsFor(courseId: string): Promise<J[]> {
  const detail = await call(`/courses/${courseId}`)
  const sets: J[] = detail?.tee_sets ?? detail?.course?.tee_sets ?? []
  if (sets.length && sets.every((s) => Array.isArray(s.holes) && s.holes.length)) return sets
  // Holes not included: fetch a scorecard per tee set (costs one request each).
  if (!sets.length) {
    const sc = await call(`/courses/${courseId}/scorecard`)
    if (Array.isArray(sc?.tee_sets)) return sc.tee_sets
    return sc?.tee_set ? [{ ...sc.tee_set, holes: sc.holes }] : []
  }
  const out: J[] = []
  for (const s of sets) {
    const sc = await call(`/courses/${courseId}/scorecard?tee_id=${encodeURIComponent(s.id)}`)
    out.push({ ...s, ...(sc?.tee_set ?? {}), holes: sc?.holes ?? [] })
  }
  return out
}

export async function GET(request: Request) {
  const u = new URL(request.url)
  const q = u.searchParams.get('q')?.trim()
  const club = u.searchParams.get('club')?.trim()
  const headers = { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=2592000, max-age=0' }
  try {
    if (q) {
      if (q.length < 3) return Response.json({ clubs: [] })
      const j = await call(`/clubs?search=${encodeURIComponent(q)}&per_page=15`)
      const list: J[] = Array.isArray(j) ? j : (j?.clubs ?? j?.data ?? [])
      const clubs = list.map((c) => ({ id: String(c.id), name: String(c.name), place: [c.city ?? c.address?.city, c.county ?? c.address?.county].filter(Boolean).join(', ') }))
      return new Response(JSON.stringify({ clubs }), { headers })
    }
    if (club) {
      const d = await call(`/clubs/${encodeURIComponent(club)}`)
      const location = [d?.address?.city ?? d?.city, d?.address?.county ?? d?.county].filter(Boolean).join(', ')
      const list: J[] = (d?.courses ?? []).filter((c: J) => !c.holes || Number(c.holes) === 18)
      const courses = []
      const skipped: string[] = []
      for (const c of list) {
        const course = toCourse(String(d?.name ?? 'Course'), location, c, await teeSetsFor(String(c.id)), list.length > 1)
        if (course) courses.push(course)
        else skipped.push(String(c.name ?? c.id))
      }
      return new Response(JSON.stringify({ courses, skipped }), { headers })
    }
    return Response.json({ error: 'Pass ?q= or ?club=' }, { status: 400 })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
