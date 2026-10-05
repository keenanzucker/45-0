import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkEntry } from '../engine/testUtils.ts'
import { loadData } from './load.ts'

afterEach(() => vi.unstubAllGlobals())

const stubFetch = (files: Record<string, unknown>, status = 200) => {
  const fetchMock = vi.fn(async (url: string) => {
    const key = Object.keys(files).find((k) => url.endsWith(k))
    return { ok: status === 200 && key !== undefined, status: key ? status : 404, json: async () => files[key!] }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const goodEntries = [
  mkEntry(1, 1, ['fire']),
  mkEntry(2, 1, ['water'], { category: 'legend', legendKind: 'box-art' }),
  mkEntry(3, 1, ['grass'], { category: 'mega' }),
]
const files = { 'data/pokemon.json': goodEntries, 'data/gauntlet.json': [] }

describe('loadData', () => {
  it('should return the entries and the gauntlet', async () => {
    stubFetch(files)
    await expect(loadData('/')).resolves.toEqual({ entries: goodEntries, gauntlet: [] })
  })

  it('should revalidate both files so a new release never runs against cached old data', async () => {
    const fetchMock = stubFetch(files)
    await loadData('/')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      expect((call as unknown[])[1]).toMatchObject({ cache: 'no-cache' })
    }
  })

  it('should fail clearly when the data uses categories this version does not know', async () => {
    const old = [...goodEntries, { ...mkEntry(4, 1, ['ice'], { name: 'Kyurem' }), category: 'legendary' }]
    stubFetch({ ...files, 'data/pokemon.json': old })
    await expect(loadData('/')).rejects.toThrow(/out of date.*Kyurem.*reload/i)
  })

  it('should fail when a legend-class entry has no legend kind', async () => {
    const broken = [mkEntry(5, 1, ['ice'], { name: 'Mystery', category: 'legend' })]
    stubFetch({ ...files, 'data/pokemon.json': broken })
    await expect(loadData('/')).rejects.toThrow(/out of date.*Mystery/i)
  })

  it('should fail when a file cannot be fetched', async () => {
    stubFetch({ 'data/pokemon.json': goodEntries })
    await expect(loadData('/')).rejects.toThrow(/gauntlet\.json/)
  })
})
