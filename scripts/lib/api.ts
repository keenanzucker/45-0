import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface CachedFetcherOptions {
  cacheDir: string
  fetchImpl?: typeof fetch
  /** Extra attempts after the first for 5xx/429/network errors. */
  retries?: number
  retryDelayMs?: number
  /** Sent with every request (e.g. a User-Agent for scraping). */
  headers?: Record<string, string>
  /** Minimum gap between network requests, however many are asked for at once. Cached pages never wait. */
  minIntervalMs?: number
}

export interface CachedFetcher {
  getJson<T>(url: string): Promise<T>
  getText(url: string): Promise<string>
  getBinary(url: string): Promise<Buffer>
}

const cacheFile = (cacheDir: string, url: string, ext: string) => {
  const { pathname, search } = new URL(url)
  const name = `${pathname}${search}`.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return join(cacheDir, `${name}.${ext}`)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function createCachedFetcher(options: CachedFetcherOptions): CachedFetcher {
  const { cacheDir, fetchImpl = fetch, retries = 3, retryDelayMs = 500, headers, minIntervalMs = 0 } = options

  // Each network attempt takes the next free slot, `minIntervalMs` after the previous one.
  let nextSlot = 0
  async function pace(): Promise<void> {
    const now = Date.now()
    const start = Math.max(now, nextSlot)
    nextSlot = start + minIntervalMs
    if (start > now) await sleep(start - now)
  }

  async function request(url: string): Promise<Response> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(retryDelayMs * attempt)
      await pace()
      try {
        const res = await fetchImpl(url, headers ? { headers } : undefined)
        if (res.ok) return res
        lastError = new Error(`GET ${url} failed: ${res.status}`)
        if (res.status < 500 && res.status !== 429) throw lastError
      } catch (err) {
        if (err === lastError) throw err
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
    throw lastError ?? new Error(`GET ${url} failed`)
  }

  async function cachedText(url: string, ext: string): Promise<string> {
    const file = cacheFile(cacheDir, url, ext)
    try {
      return await readFile(file, 'utf8')
    } catch {
      // cache miss: fall through to the network
    }
    const body = await (await request(url)).text()
    await mkdir(cacheDir, { recursive: true })
    await writeFile(file, body)
    return body
  }

  return {
    async getJson<T>(url: string): Promise<T> {
      return JSON.parse(await cachedText(url, 'json')) as T
    },

    getText: (url) => cachedText(url, 'txt'),

    async getBinary(url: string): Promise<Buffer> {
      return Buffer.from(await (await request(url)).arrayBuffer())
    },
  }
}

/** Like Promise.all(items.map(fn)) but with at most `limit` calls in flight. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
