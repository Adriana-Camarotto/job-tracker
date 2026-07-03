import { safeHttpUrl } from '../utils/url'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

// The CV/profile lives in the local profile server (server/data/profile.json,
// not committed to git). Fetched once and cached for the session.
let profilePromise = null
export function getProfile() {
  if (!profilePromise) {
    profilePromise = fetch('/api/profile')
      .then(res => {
        if (!res.ok) throw new Error(`Profile server error (HTTP ${res.status})`)
        return res.json()
      })
      .catch(err => {
        profilePromise = null // allow retry once the server is up
        throw new Error(
          `Could not load your profile (${err.message}). ` +
          'Start the profile server with `pnpm dev` and make sure server/data/profile.json exists.',
        )
      })
  }
  return profilePromise
}

const MODEL = 'claude-sonnet-5'

// Claude Sonnet 5 pricing (per million tokens).
// Introductory pricing of $2/$10 applies through 2026-08-31; $3/$15 after.
const SONNET_5_INTRO_ENDS = new Date('2026-09-01T00:00:00Z')
const isIntroPricing = () => new Date() < SONNET_5_INTRO_ENDS
export const PRICE_INPUT_PER_M = () => (isIntroPricing() ? 2.0 : 3.0)
export const PRICE_OUTPUT_PER_M = () => (isIntroPricing() ? 10.0 : 15.0)

// Web search server tool: $10 per 1,000 searches
export const WEB_SEARCH_COST_PER_SEARCH = 0.01
const SEARCH_MAX_USES = 5

// Anthropic bills in USD; the UI displays costs in GBP.
// Rate as of 2026-07-02 (frankfurter.dev) — override with VITE_USD_TO_GBP.
export const USD_TO_GBP = Number(import.meta.env.VITE_USD_TO_GBP) || 0.75

// Rough token estimates per operation (Sonnet 5 tokenizer produces ~30% more
// tokens for the same text than the previous generation)
export const COST_ESTIMATES = {
  analyse: {
    label: 'Analyse job match',
    inputTokens: 2400,
    outputTokens: 650,
    description: 'Scores your CV against the job, shows matching skills, gaps and recommendation',
  },
  coverLetter: {
    label: 'Generate cover letter',
    inputTokens: 2400,
    outputTokens: 600,
    description: 'Writes a tailored cover letter for the specific role',
  },
  adaptCV: {
    label: 'Adapt CV',
    inputTokens: 2500,
    outputTokens: 1200,
    description: 'Rewrites your CV optimised for the job keywords and requirements',
  },
  search: {
    label: 'Search jobs (per batch)',
    inputTokens: 6000, // search results are billed as input tokens
    outputTokens: 1500,
    searches: SEARCH_MAX_USES,
    description: 'Searches the live web for real job listings and scores them against your profile',
  },
}

export function estimateCost(operationKey, quantity = 1) {
  const op = COST_ESTIMATES[operationKey]
  if (!op) return 0
  const inputCost = (op.inputTokens * quantity * PRICE_INPUT_PER_M()) / 1_000_000
  const outputCost = (op.outputTokens * quantity * PRICE_OUTPUT_PER_M()) / 1_000_000
  const searchCost = (op.searches || 0) * quantity * WEB_SEARCH_COST_PER_SEARCH
  return inputCost + outputCost + searchCost
}

// Estimates are computed in USD (Anthropic's billing currency) and
// converted to GBP for display.
export function formatCost(usd) {
  const gbp = usd * USD_TO_GBP
  if (gbp < 0.001) return '< £0.001'
  return `£${gbp.toFixed(4)}`
}

// Full application bundle: analyse + cover letter + adapt CV
export function estimateFullApplication() {
  return estimateCost('analyse') + estimateCost('coverLetter') + estimateCost('adaptCV')
}

async function requestClaude(body) {
  if (!API_KEY) {
    throw new Error('Missing API key. Copy .env.example to .env and set VITE_ANTHROPIC_API_KEY.')
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let message = `API error (HTTP ${res.status})`
    try {
      const err = await res.json()
      message = err.error?.message || message
    } catch {
      // non-JSON error body — keep the generic message
    }
    if (res.status === 401) {
      message += ' — check VITE_ANTHROPIC_API_KEY in .env, and restart `pnpm dev` after changing it (Vite only reads .env at startup).'
    }
    throw new Error(message)
  }

  return res.json()
}

function extractText(data) {
  return (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

// Runs one model turn (resuming across pause_turn for server-side tools) and
// returns { text, allContent } — text from the final response, allContent from
// every hop so callers can inspect tool results/errors.
async function callClaude(systemPrompt, userPrompt, maxTokens = 2000, { tools } = {}) {
  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  }
  if (tools) {
    body.tools = tools
  } else {
    // Deterministic, cost-predictable single-shot calls don't need thinking
    body.thinking = { type: 'disabled' }
  }

  let data = await requestClaude(body)
  let allContent = [...(data.content || [])]

  // Server-side tools can pause mid-turn; resume until the turn completes
  let continuations = 0
  while (data.stop_reason === 'pause_turn' && continuations < 3) {
    body.messages = [...body.messages, { role: 'assistant', content: data.content }]
    data = await requestClaude(body)
    allContent = [...allContent, ...(data.content || [])]
    continuations++
  }

  if (data.stop_reason === 'refusal') {
    throw new Error('The request was declined by the model. Try rephrasing the job description.')
  }

  return { text: extractText(data), allContent }
}

function parseJson(raw, errorMessage) {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  // The model may add prose around the JSON — extract the outermost object
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error(errorMessage)
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new Error(errorMessage)
  }
}

export async function analyseJobMatch(jobText) {
  const { cv } = await getProfile()
  const system = `You are an expert recruiter and career coach. Analyse job descriptions and compare them against a candidate's CV. Always respond in valid JSON only, no markdown.`

  const prompt = `
Analyse this job description against the candidate's CV and return a JSON object with this exact structure:
{
  "score": <number 0-100>,
  "title": "<extracted job title>",
  "company": "<extracted company name>",
  "location": "<extracted location>",
  "summary": "<2-3 sentence summary of the role>",
  "matching_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "recommendation": "<brief recommendation on whether to apply>"
}

CANDIDATE CV:
${cv}

JOB DESCRIPTION:
${jobText}
`
  const { text } = await callClaude(system, prompt, 1500)
  return parseJson(text, 'Failed to parse job analysis')
}

export async function generateCoverLetter(jobText, jobTitle, company) {
  const { cv } = await getProfile()
  const system = `You are an expert career coach who writes compelling, personalised cover letters. Write in a professional yet warm tone. Never use generic phrases like "I am writing to express my interest". Be specific and confident.`

  const prompt = `
Write a tailored cover letter for this job application.

CANDIDATE CV:
${cv}

JOB TITLE: ${jobTitle}
COMPANY: ${company}

JOB DESCRIPTION:
${jobText}

Requirements:
- 3-4 paragraphs, under 400 words
- Opening that hooks immediately with a relevant achievement
- Middle paragraphs connecting specific CV experience to job requirements
- Closing with a confident call to action
- Professional but personable tone
- Do NOT use "I am writing to", "passionate about", "team player", or other clichés
- Output only the cover letter text, no subject line or metadata
`
  return (await callClaude(system, prompt, 1000)).text
}

export async function adaptCV(jobText, jobTitle, company) {
  const { cv } = await getProfile()
  const system = `You are an expert CV writer and ATS optimisation specialist. Rewrite CVs to be highly relevant for specific job postings while keeping all information truthful. Format output as clean plain text.`

  const prompt = `
Rewrite and adapt the candidate's CV to be optimised for this specific job posting.

Rules:
- Keep all facts truthful — do not invent experience or skills
- Reorder and emphasise skills and experience most relevant to this role
- Use keywords from the job description naturally throughout
- Adjust the professional summary to speak directly to this role
- Keep the same structure but prioritise relevant content
- If the job requires skills the candidate has but hasn't emphasised, bring them forward
- Output the full adapted CV as clean plain text ready to copy

CANDIDATE CV:
${cv}

TARGET JOB: ${jobTitle} at ${company}

JOB DESCRIPTION:
${jobText}
`
  return (await callClaude(system, prompt, 2500)).text
}

// Search-results/listing pages are not job adverts — reject them so the UI
// only ever shows direct links to a single vacancy.
const SEARCH_PAGE_PATTERNS = [
  /[?&](q|query|keywords|search|term)=/i, // ...?q=react+developer
  /\/(search|find-?jobs?|vacancies)([/?]|$)/i, // .../search, /find-jobs
  /\/jobs\/?([?#]|$)/i, // bare .../jobs index page
]

export function isDirectJobUrl(url) {
  const safe = safeHttpUrl(url)
  if (!safe) return false
  if (SEARCH_PAGE_PATTERNS.some(p => p.test(safe))) return false
  // Board listing pages like totaljobs.com/jobs/react-developer/in-cambridge:
  // a /jobs/ path with no digits anywhere is a category/location index, not a
  // single advert (real adverts carry a numeric ID — reed, linkedin, indeed).
  const { pathname } = new URL(safe)
  if (/\/jobs\//i.test(pathname) && !/\d/.test(pathname)) return false
  return true
}

export async function searchJobs(keywords, location = 'UK', timeFilter = 'week', limit = 5) {
  const { profile } = await getProfile()
  const timeLabels = {
    '24h': 'posted in the last 24 hours',
    'week': 'posted in the last 7 days',
    'month': 'posted in the last 30 days',
    'any': 'any posting date',
  }
  const timeLabel = timeLabels[timeFilter] || timeLabels['week']

  const system = `You are a job search assistant with access to web search. You MUST use the web_search tool to find real, currently advertised job listings before answering — never invent listings or URLs. Only include jobs you actually found in search results, with their real URLs. Respond with valid JSON only, no markdown.`

  const prompt = `
Search the web for up to ${limit} real, current job listings matching: "${keywords}" in ${location}, ${timeLabel}.

How to search effectively — run several distinct searches targeting INDIVIDUAL job adverts:
- "${keywords} ${location} site:linkedin.com/jobs/view"
- "${keywords} ${location} site:uk.indeed.com/viewjob"
- "${keywords} ${location} site:reed.co.uk/jobs"
- company career pages ("${keywords} careers ${location}")

STRICT URL RULES:
- "url" MUST link directly to ONE specific job advert (a page describing a single vacancy).
- NEVER return search-results pages, category pages or job-board indexes. Reject any URL containing search parameters (?q=, ?keywords=, ?search=) or paths like /search or a bare /jobs.
- If you cannot find the direct advert URL for a job, leave that job out entirely.

Return the jobs you found as JSON in this format:
{
  "jobs": [
    {
      "title": "<job title>",
      "company": "<company>",
      "location": "<location>",
      "type": "<full-time/hybrid/remote>",
      "posted": "<e.g. 2 days ago, if known>",
      "description": "<2-3 sentence description>",
      "url": "<direct link to the specific job advert>",
      "match_score": <estimated 0-100 based on candidate profile>
    }
  ],
  "search_tips": ["<tip 1>", "<tip 2>"]
}

If you find fewer than ${limit} qualifying listings, return only what you found — do not fabricate entries and do not pad with search pages.

Candidate profile: ${profile.title}, skills: ${(profile.skills || []).slice(0, 10).join(', ')}, based in ${profile.location}, ${profile.experience_years} years experience.
Prioritise roles that match React, TypeScript, Next.js experience. Score honestly.
`
  const { text, allContent } = await callClaude(system, prompt, 6000, {
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: SEARCH_MAX_USES }],
  })

  // A web_search_tool_result whose content is an object (not a results array)
  // is an error, e.g. {error_code: "too_many_requests"} when the search tool
  // is rate-limited. Surface that clearly instead of the model's apology text.
  const searchErrors = allContent
    .filter(b => b.type === 'web_search_tool_result' && b.content && !Array.isArray(b.content))
    .map(b => b.content.error_code || 'unknown')

  let data
  try {
    data = parseJson(text, 'Failed to parse job search results')
  } catch (err) {
    if (searchErrors.length > 0) {
      throw new Error(
        `Live web search is temporarily unavailable (${searchErrors[0]}). Wait a minute and try again.`,
      )
    }
    throw err
  }
  // Web-search citations leak <cite index="..."> tags into the JSON strings —
  // strip them so the UI shows clean text.
  const stripCites = v => (typeof v === 'string' ? v.replace(/<\/?cite[^>]*>/g, '') : v)
  // Belt and braces: drop anything that is not a direct job advert link
  data.jobs = (data.jobs || [])
    .filter(job => isDirectJobUrl(job.url))
    .map(job => Object.fromEntries(Object.entries(job).map(([k, v]) => [k, stripCites(v)])))
  data.search_tips = (data.search_tips || []).map(stripCites)

  if (data.jobs.length === 0 && searchErrors.length > 0) {
    throw new Error(
      `Live web search is temporarily unavailable (${searchErrors[0]}). Wait a minute and try again.`,
    )
  }
  return data
}
