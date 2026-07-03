import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  estimateCost, formatCost, estimateFullApplication, COST_ESTIMATES,
  PRICE_INPUT_PER_M, PRICE_OUTPUT_PER_M, WEB_SEARCH_COST_PER_SEARCH, USD_TO_GBP,
  analyseJobMatch, searchJobs, isDirectJobUrl,
} from './ai'

const PROFILE = {
  cv: 'CANDIDATE CV TEXT',
  profile: {
    title: 'Frontend Developer',
    skills: ['React', 'TypeScript'],
    location: 'Cambridge, UK',
    experience_years: 3,
  },
}

const profileResponse = { ok: true, status: 200, json: async () => PROFILE }

// Routes fetch calls: the profile server gets the fixture above, the
// Anthropic API gets `body`.
function mockFetchOnce(body, ok = true, status = 200) {
  global.fetch = vi.fn(url => {
    if (String(url).includes('/api/profile')) return Promise.resolve(profileResponse)
    return Promise.resolve({ ok, status, json: async () => body })
  })
}

const anthropicCalls = () =>
  global.fetch.mock.calls.filter(([url]) => String(url).includes('api.anthropic.com'))

describe('cost estimation', () => {
  it('computes token cost from current Sonnet 5 prices', () => {
    const op = COST_ESTIMATES.analyse
    const expected =
      (op.inputTokens * PRICE_INPUT_PER_M()) / 1_000_000 +
      (op.outputTokens * PRICE_OUTPUT_PER_M()) / 1_000_000
    expect(estimateCost('analyse')).toBeCloseTo(expected, 10)
  })

  it('includes web search fees for the search operation', () => {
    const op = COST_ESTIMATES.search
    const tokenCost =
      (op.inputTokens * PRICE_INPUT_PER_M()) / 1_000_000 +
      (op.outputTokens * PRICE_OUTPUT_PER_M()) / 1_000_000
    expect(estimateCost('search')).toBeCloseTo(tokenCost + op.searches * WEB_SEARCH_COST_PER_SEARCH, 10)
  })

  it('scales linearly with quantity', () => {
    expect(estimateCost('analyse', 3)).toBeCloseTo(estimateCost('analyse') * 3, 10)
  })

  it('returns 0 for unknown operations', () => {
    expect(estimateCost('nope')).toBe(0)
  })

  it('full application bundle is the sum of the three operations', () => {
    expect(estimateFullApplication()).toBeCloseTo(
      estimateCost('analyse') + estimateCost('coverLetter') + estimateCost('adaptCV'),
      10,
    )
  })
})

describe('formatCost', () => {
  it('displays in GBP, converted from the USD estimate', () => {
    expect(formatCost(0.02)).toBe(`£${(0.02 * USD_TO_GBP).toFixed(4)}`)
  })

  it('formats tiny amounts as < £0.001', () => {
    expect(formatCost(0.0001)).toBe('< £0.001')
  })

  it('uses a sane default exchange rate', () => {
    expect(USD_TO_GBP).toBeGreaterThan(0.5)
    expect(USD_TO_GBP).toBeLessThan(1)
  })
})

describe('analyseJobMatch', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('parses a clean JSON response', async () => {
    mockFetchOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"score": 82, "title": "Frontend Dev"}' }],
    })
    const result = await analyseJobMatch('some job description')
    expect(result.score).toBe(82)
    expect(result.title).toBe('Frontend Dev')
  })

  it('parses JSON wrapped in markdown fences and prose', async () => {
    mockFetchOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Here is the analysis:\n```json\n{"score": 70}\n```\nGood luck!' }],
    })
    const result = await analyseJobMatch('job')
    expect(result.score).toBe(70)
  })

  it('sends the retired-model replacement (claude-sonnet-5)', async () => {
    mockFetchOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] })
    await analyseJobMatch('job')
    const body = JSON.parse(anthropicCalls()[0][1].body)
    expect(body.model).toBe('claude-sonnet-5')
  })

  it('includes the CV fetched from the profile server in the prompt', async () => {
    mockFetchOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] })
    await analyseJobMatch('job')
    const body = JSON.parse(anthropicCalls()[0][1].body)
    expect(body.messages[0].content).toContain('CANDIDATE CV TEXT')
  })

  it('throws a readable error when the API returns a non-JSON error body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 529,
      json: async () => { throw new Error('not json') },
    })
    await expect(analyseJobMatch('job')).rejects.toThrow('API error (HTTP 529)')
  })

  it('surfaces the API error message when present', async () => {
    mockFetchOnce({ error: { message: 'rate limited' } }, false, 429)
    await expect(analyseJobMatch('job')).rejects.toThrow('rate limited')
  })

  it('throws a parse error on non-JSON model output', async () => {
    mockFetchOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'sorry, no JSON here' }] })
    await expect(analyseJobMatch('job')).rejects.toThrow('Failed to parse job analysis')
  })
})

describe('isDirectJobUrl', () => {
  it('accepts direct job advert URLs', () => {
    expect(isDirectJobUrl('https://www.linkedin.com/jobs/view/4012345678')).toBe(true)
    expect(isDirectJobUrl('https://uk.indeed.com/viewjob?jk=abc123')).toBe(true)
    expect(isDirectJobUrl('https://www.reed.co.uk/jobs/frontend-developer/55512345')).toBe(true)
    expect(isDirectJobUrl('https://example.com/careers/frontend-engineer')).toBe(true)
  })

  it('rejects search-results and listing pages', () => {
    expect(isDirectJobUrl('https://uk.indeed.com/jobs?q=react+developer&l=Cambridge')).toBe(false)
    expect(isDirectJobUrl('https://www.linkedin.com/jobs/search?keywords=react')).toBe(false)
    expect(isDirectJobUrl('https://www.reed.co.uk/jobs?keywords=frontend')).toBe(false)
    expect(isDirectJobUrl('https://www.totaljobs.com/jobs')).toBe(false)
    expect(isDirectJobUrl('https://example.com/find-jobs/react')).toBe(false)
    expect(isDirectJobUrl('https://example.com/search?term=developer')).toBe(false)
  })

  it('rejects digitless /jobs/ category pages but keeps adverts with IDs', () => {
    expect(isDirectJobUrl('https://www.totaljobs.com/jobs/react-developer/in-cambridge')).toBe(false)
    expect(isDirectJobUrl('https://www.cv-library.co.uk/jobs/frontend/in-london')).toBe(false)
    expect(isDirectJobUrl('https://www.totaljobs.com/job/react-developer/example-corp-job103456')).toBe(true)
    expect(isDirectJobUrl('https://www.reed.co.uk/jobs/react-developer/41126705')).toBe(true)
  })

  it('rejects stale LinkedIn adverts by sequential job ID', () => {
    // old IDs (previous years — long expired)
    expect(isDirectJobUrl('https://uk.linkedin.com/jobs/view/react-developer-at-acme-2806232155')).toBe(false)
    expect(isDirectJobUrl('https://www.linkedin.com/jobs/view/3590296972')).toBe(false)
    // current IDs
    expect(isDirectJobUrl('https://uk.linkedin.com/jobs/view/react-developer-at-zilch-4218690393')).toBe(true)
    expect(isDirectJobUrl('https://www.linkedin.com/jobs/view/4151476620/')).toBe(true)
  })

  it('rejects unsafe or missing URLs', () => {
    expect(isDirectJobUrl('javascript:alert(1)')).toBe(false)
    expect(isDirectJobUrl('')).toBe(false)
    expect(isDirectJobUrl(undefined)).toBe(false)
  })
})

describe('searchJobs', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('strips <cite> tags that web-search citations leak into job fields', async () => {
    mockFetchOnce({
      stop_reason: 'end_turn',
      content: [{
        type: 'text',
        text: JSON.stringify({
          jobs: [{
            title: 'React Developer',
            description: '<cite index="1-1">Great team</cite> building web apps.',
            url: 'https://www.linkedin.com/jobs/view/4218690123',
          }],
          search_tips: ['<cite index="2-1">Apply early</cite>'],
        }),
      }],
    })
    const result = await searchJobs('react')
    expect(result.jobs[0].description).toBe('Great team building web apps.')
    expect(result.search_tips[0]).toBe('Apply early')
  })

  it('filters out search-page URLs from results', async () => {
    mockFetchOnce({
      stop_reason: 'end_turn',
      content: [{
        type: 'text',
        text: JSON.stringify({
          jobs: [
            { title: 'Good', url: 'https://www.linkedin.com/jobs/view/4218690123' },
            { title: 'Bad listing', url: 'https://uk.indeed.com/jobs?q=react' },
            { title: 'No url' },
          ],
          search_tips: [],
        }),
      }],
    })
    const result = await searchJobs('react')
    expect(result.jobs).toHaveLength(1)
    expect(result.jobs[0].title).toBe('Good')
  })

  it('requests the web_search server tool', async () => {
    mockFetchOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"jobs": []}' }] })
    await searchJobs('react developer')
    const body = JSON.parse(anthropicCalls()[0][1].body)
    expect(body.tools).toEqual([
      expect.objectContaining({ type: 'web_search_20250305', name: 'web_search' }),
      expect.objectContaining({ type: 'web_fetch_20250910', name: 'web_fetch' }),
    ])
    expect(body.output_config).toEqual({ effort: 'medium' })
    expect(body.messages[0].content).toContain('Frontend Developer')
  })

  it('joins multiple text blocks around tool results', async () => {
    mockFetchOnce({
      stop_reason: 'end_turn',
      content: [
        { type: 'server_tool_use', id: 'x', name: 'web_search', input: {} },
        { type: 'web_search_tool_result', content: [] },
        { type: 'text', text: '{"jobs": [{"title": "Dev", "url": "https://example.com/careers/dev-role"}' },
        { type: 'text', text: '], "search_tips": []}' },
      ],
    })
    const result = await searchJobs('react')
    expect(result.jobs).toHaveLength(1)
    expect(result.jobs[0].title).toBe('Dev')
  })

  it('reports a clear error when the web search tool is rate-limited', async () => {
    mockFetchOnce({
      stop_reason: 'end_turn',
      content: [
        { type: 'server_tool_use', id: 'x', name: 'web_search', input: {} },
        { type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'too_many_requests' } },
        { type: 'text', text: 'Unable to complete live web searches in this session.' },
      ],
    })
    await expect(searchJobs('react')).rejects.toThrow(/temporarily unavailable \(too_many_requests\)/)
  })

  it('reports the search error even when the model returns empty jobs JSON', async () => {
    mockFetchOnce({
      stop_reason: 'end_turn',
      content: [
        { type: 'web_search_tool_result', content: { error_code: 'unavailable' } },
        { type: 'text', text: '{"jobs": [], "search_tips": []}' },
      ],
    })
    await expect(searchJobs('react')).rejects.toThrow(/temporarily unavailable \(unavailable\)/)
  })

  it('resumes when the server pauses the turn', async () => {
    const paused = {
      stop_reason: 'pause_turn',
      content: [{ type: 'server_tool_use', id: 'x', name: 'web_search', input: {} }],
    }
    const done = { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"jobs": []}' }] }
    let calls = 0
    global.fetch = vi.fn(url => {
      if (String(url).includes('/api/profile')) return Promise.resolve(profileResponse)
      calls++
      return Promise.resolve({ ok: true, status: 200, json: async () => (calls === 1 ? paused : done) })
    })
    const result = await searchJobs('react')
    expect(result.jobs).toEqual([])
    expect(calls).toBe(2)
  })
})
