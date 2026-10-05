import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCachedFetcher, mapLimit } from './api.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('createCachedFetcher', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'pokeapi-cache-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
  })

  it('should fetch once and serve repeat requests from the disk cache', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: 1 }))
    const first = createCachedFetcher({ cacheDir, fetchImpl })
    const url = 'https://pokeapi.co/api/v2/pokemon/6/'
    expect(await first.getJson(url)).toEqual({ ok: 1 })

    const second = createCachedFetcher({ cacheDir, fetchImpl })
    expect(await second.getJson(url)).toEqual({ ok: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('should cache different urls separately', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => json({ url: String(url) }))
    const f = createCachedFetcher({ cacheDir, fetchImpl })
    const a = await f.getJson('https://pokeapi.co/api/v2/pokemon/1/')
    const b = await f.getJson('https://pokeapi.co/api/v2/pokemon/2/')
    expect(a).not.toEqual(b)
  })

  it('should wait at least minIntervalMs between network requests, even when asked for at once', async () => {
    const starts: number[] = []
    const fetchImpl = vi.fn(async () => {
      starts.push(Date.now())
      return json({ ok: 1 })
    })
    const f = createCachedFetcher({ cacheDir, fetchImpl, minIntervalMs: 60 })
    await Promise.all([1, 2, 3].map((n) => f.getJson(`https://pokemondb.net/page/${n}`)))
    expect(starts).toHaveLength(3)
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(55)
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(55)
  })

  it('should not wait for pages already in the disk cache', async () => {
    const fetchImpl = vi.fn(async () => json({ ok: 1 }))
    const url = 'https://pokemondb.net/page/cached'
    await createCachedFetcher({ cacheDir, fetchImpl }).getJson(url)
    const slow = createCachedFetcher({ cacheDir, fetchImpl, minIntervalMs: 5000 })
    const t0 = Date.now()
    await slow.getJson(url)
    await slow.getJson(url)
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('should not delay anything by default', async () => {
    const starts: number[] = []
    const fetchImpl = vi.fn(async () => {
      starts.push(Date.now())
      return json({})
    })
    const f = createCachedFetcher({ cacheDir, fetchImpl })
    await Promise.all([1, 2, 3].map((n) => f.getJson(`https://pokeapi.co/api/v2/pokemon/${n}/`)))
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(50)
  })

  it('should retry transient server errors and then succeed', async () => {
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ ok: 2 }))
    const f = createCachedFetcher({ cacheDir, fetchImpl, retryDelayMs: 0 })
    expect(await f.getJson('https://pokeapi.co/api/v2/pokemon/3/')).toEqual({ ok: 2 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('should throw with the status once retries are exhausted', async () => {
    const fetchImpl = vi.fn(async () => json({}, 500))
    const f = createCachedFetcher({ cacheDir, fetchImpl, retries: 2, retryDelayMs: 0 })
    await expect(f.getJson('https://pokeapi.co/api/v2/pokemon/4/')).rejects.toThrow(/500/)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('should not retry 404s', async () => {
    const fetchImpl = vi.fn(async () => json({}, 404))
    const f = createCachedFetcher({ cacheDir, fetchImpl, retryDelayMs: 0 })
    await expect(f.getJson('https://pokeapi.co/api/v2/pokemon/nope/')).rejects.toThrow(/404/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('should cache text bodies on disk like json', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>hi</html>'))
    const url = 'https://pokemondb.net/red-blue/gymleaders-elitefour'
    expect(await createCachedFetcher({ cacheDir, fetchImpl }).getText(url)).toBe('<html>hi</html>')
    expect(await createCachedFetcher({ cacheDir, fetchImpl }).getText(url)).toBe('<html>hi</html>')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('should send configured headers with every request', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => json({}))
    const f = createCachedFetcher({ cacheDir, fetchImpl, headers: { 'user-agent': 'test-agent' } })
    await f.getJson('https://pokeapi.co/api/v2/pokemon/9/')
    expect(fetchImpl.mock.calls[0][1]).toEqual({ headers: { 'user-agent': 'test-agent' } })
  })

  it('should download binary bodies without caching them', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
    const f = createCachedFetcher({ cacheDir, fetchImpl })
    const buf = await f.getBinary('https://example.test/6.png')
    expect([...buf]).toEqual([1, 2, 3])
  })
})

describe('mapLimit', () => {
  it('should preserve input order in the results', async () => {
    const out = await mapLimit([30, 5, 15], 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms))
      return i
    })
    expect(out).toEqual([0, 1, 2])
  })

  it('should never run more than the limit concurrently', async () => {
    let inFlight = 0
    let max = 0
    await mapLimit(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      inFlight++
      max = Math.max(max, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
    })
    expect(max).toBe(3)
  })
})
